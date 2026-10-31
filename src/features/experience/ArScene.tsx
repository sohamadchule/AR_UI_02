import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";

import { fetchVariants, type Variant } from "@/lib/api";
import type { PartPicks } from "@/lib/color";
import { placementOf } from "@/lib/placement";
import { resolveTrueScale } from "@/lib/trueScale";
import ArDebugPanel, { useArDebug } from "./ArDebugPanel";
import ResizePanel from "./ResizePanel";
import { RoomEngine, type ItemView, type Snapshot } from "./roomEngine";

export interface ArSceneProps {
  /** Live XRSession, created from the user gesture by the caller. */
  session: XRSession;
  /** Called once the session has ended, for any reason. */
  onEnd: () => void;
  /** The product AR was opened from; it is ready to place as soon as the floor is found. */
  variant: Variant;
  /** Colours the shopper chose for that product's extra parts. */
  picks?: PartPicks;
}

/** Movement under this many pixels still counts as a tap, not a drag. */
const TAP_SLOP_PX = 10;
/** One press of a turn button. */
const TURN_STEP = Math.PI / 12;

const cm = (m: number) => Math.round(m * 100);
const sizeText = ({ width, depth, height }: ItemView["sizeM"]) => `${cm(width)} × ${cm(depth)} × ${cm(height)} cm`;
/** The catalogue's W × D × H, with any side it doesn't list shown as "?". */
const listedSize = (v: Variant) => {
  const d = v.product.dimensionsMm;
  if (!d || (d.width === null && d.depth === null && d.height === null)) return null;
  const side = (mm: number | null) => (mm === null ? "?" : Math.round(mm / 10));
  return `${side(d.width)} × ${side(d.depth)} × ${side(d.height)} cm`;
};

/** How honestly AR can show this product, from the model size the catalogue reports. */
const sizeQuality = (v: Variant) => {
  const m = v.model.dimensionsM;
  if (!m) return null;
  const status = resolveTrueScale(m, v.product.dimensionsMm).status;
  return status === "verified" ? null : status === "approximate" ? "approximate size" : "size not listed";
};

const pill = "rounded-full bg-black/70 px-4 py-2 text-xs text-white backdrop-blur";
const primary = "rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-lg active:scale-95 disabled:opacity-40";
const secondary = "rounded-full bg-white/15 px-4 py-2.5 text-sm font-medium text-white backdrop-blur active:scale-95 disabled:opacity-40";
const sheet = "w-full max-w-md max-h-[62vh] overflow-y-auto rounded-3xl bg-black/80 p-4 text-left text-white backdrop-blur";

/**
 * In-page WebXR AR room — simplified for easy product placement.
 *
 * No room measurement, no overlap checks, no fit constraints.
 * Just place products, move them, rotate them, resize them.
 */
export default function ArScene({ session, onEnd, variant, picks }: ArSceneProps) {
  const engineRef = useRef<RoomEngine | null>(null);
  const initial = useRef(variant);
  const initialPicks = useRef(picks);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<"none" | "add">("none");
  const [catalogue, setCatalogue] = useState<Variant[]>([variant]);
  const showDebug = useArDebug();

  useEffect(() => {
    let engine: RoomEngine | null = null;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      engine = new RoomEngine(session, setSnap);
      engineRef.current = engine;
      engine.arm(initial.current, initialPicks.current);
      engine.start().catch(() => setError("Couldn't start the AR session."));
    });
    session.addEventListener("end", onEnd);
    return () => {
      cancelled = true;
      session.removeEventListener("end", onEnd);
      engine?.dispose();
      engineRef.current = null;
    };
  }, [session, onEnd]);

  useEffect(() => {
    let active = true;
    fetchVariants()
      .then((all) => active && all.length && setCatalogue(all))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const engine = () => engineRef.current;

  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const cancel = (e: Event) => e.preventDefault();
    root.addEventListener("beforexrselect", cancel);
    return () => root.removeEventListener("beforexrselect", cancel);
  }, []);

  // --- gestures ----------------------------------------------------------
  const touch = useRef({ startX: 0, startY: 0, moved: false, dragging: false, twist: null as number | null, twisted: false });
  const onUi = (e: React.TouchEvent) => Boolean((e.target as HTMLElement).closest("[data-ui]"));
  const angle = (e: React.TouchEvent) =>
    Math.atan2(e.touches[1].clientY - e.touches[0].clientY, e.touches[1].clientX - e.touches[0].clientX);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (onUi(e)) return;
    const t = touch.current;
    if (e.touches.length === 1) {
      const p = e.touches[0];
      Object.assign(t, { startX: p.clientX, startY: p.clientY, moved: false, twisted: false, twist: null });
      t.dragging = engine()?.dragStart(p.clientX, p.clientY) ?? false;
    } else if (e.touches.length === 2) {
      if (t.dragging) engine()?.dragEnd();
      t.dragging = false;
      t.twist = angle(e);
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const t = touch.current;
    if (e.touches.length === 2 && t.twist !== null) {
      const now = angle(e);
      let delta = now - t.twist;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;
      engine()?.rotateSelected(-delta);
      t.twist = now;
      t.twisted = true;
    } else if (e.touches.length === 1) {
      const p = e.touches[0];
      if (Math.hypot(p.clientX - t.startX, p.clientY - t.startY) > TAP_SLOP_PX) t.moved = true;
      if (t.dragging && t.moved) engine()?.dragMove(p.clientX, p.clientY);
    }
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const t = touch.current;
    if (t.dragging && e.touches.length === 0) {
      engine()?.dragEnd();
      t.dragging = false;
    }
    if (e.touches.length < 2) t.twist = null;
    if (onUi(e) || e.touches.length > 0) return;
    const p = e.changedTouches[0];
    if (p && !t.moved && !t.twisted) engine()?.tap(p.clientX, p.clientY);
  }, []);

  const stopSession = useCallback(() => {
    session.end().catch(() => onEnd());
  }, [session, onEnd]);

  const selected = snap?.items.find((i) => i.id === snap.selectedId) ?? null;
  const notices = [
    error,
    snap?.notice,
    snap?.loading ? "Loading model…" : null,
  ].filter((n): n is string => Boolean(n));

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 flex flex-col justify-between"
      style={{ touchAction: "none" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {showDebug && snap && <ArDebugPanel snapshot={snap} />}
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex min-w-0 flex-col items-start gap-2">
          {notices.map((n) => (
            <p key={n} role="status" className={pill}>
              {n}
            </p>
          ))}
        </div>
        <button data-ui type="button" onClick={stopSession} className="shrink-0 rounded-full bg-black/70 px-4 py-2 text-sm font-medium text-white backdrop-blur">
          Close
        </button>
      </div>

      <div className="flex flex-col items-center gap-3 p-4 pb-8 text-center">
        {snap && panel === "add" && (
          <AddSheet
            catalogue={catalogue}
            onPick={(v) => {
              engine()?.arm(v);
              setPanel("none");
            }}
            onClose={() => setPanel("none")}
          />
        )}

        {snap && panel === "none" && <Controls snap={snap} selected={selected} catalogue={catalogue} engine={engine} openAdd={() => setPanel("add")} />}
      </div>
    </div>
  );
}

// ---- bottom controls, by mode ---------------------------------------------

function Controls({
  snap,
  selected,
  catalogue,
  engine,
  openAdd,
}: {
  snap: Snapshot;
  selected: ItemView | null;
  catalogue: Variant[];
  engine: () => RoomEngine | null;
  openAdd: () => void;
}) {
  const hint = <p className={pill}>{snap.hint}</p>;

  if (snap.mode === "placing") {
    return (
      <div data-ui className="flex flex-col items-center gap-3">
        {hint}
        <div className="flex gap-2">
          <button type="button" disabled={!snap.canPlace} onClick={() => engine()?.mark()} className={primary}>
            {snap.floorSet ? (snap.moving ? "Put it here" : "Place here") : "Set floor here"}
          </button>
          {(snap.items.length > 0 || snap.moving) && (
            <button type="button" onClick={() => engine()?.cancel()} className={secondary}>
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  if (selected) {
    return (
      <ItemCard
        item={selected}
        catalogue={catalogue}
        engine={engine}
        onAdd={() => {
          engine()?.select(null);
          openAdd();
        }}
      />
    );
  }

  return (
    <div data-ui className="flex flex-col items-center gap-3">
      {hint}
      {snap.items.length > 0 && (
        <p className={pill}>
          {snap.items.length} {snap.items.length === 1 ? "piece" : "pieces"}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={openAdd} className={primary}>
          + Add furniture
        </button>
        <button type="button" onClick={() => engine()?.resetAll()} className={secondary}>
          Start over
        </button>
      </div>
    </div>
  );
}

function ItemCard({
  item,
  catalogue,
  engine,
  onAdd,
}: {
  item: ItemView;
  catalogue: Variant[];
  engine: () => RoomEngine | null;
  onAdd: () => void;
}) {
  const siblings = item.variant ? catalogue.filter((v) => v.product.id === item.variant!.product.id) : [];
  const [resizing, setResizing] = useState(false);

  const listed = item.variant ? listedSize(item.variant) : null;
  const scaleNotice =
    item.scale?.status === "no-dimensions"
      ? "This product's size isn't listed, so it's shown at the 3D model's own size, which may not be accurate."
      : item.scale?.status === "approximate"
        ? `This 3D model's shape differs from the listed size${listed ? ` (${listed})` : ""} by up to ${Math.round(item.scale.deviation * 100)}%, so it's shown approximately.`
        : null;

  return (
    <div data-ui className={sheet}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {item.name}
            {item.variant && item.variant.name ? <span className="font-normal text-white/60"> · {item.variant.name}</span> : null}
          </p>
          <p className="text-xs tabular-nums text-white/70">
            {sizeText(item.sizeM)} (W × D × H)
            {item.resized ? "" : item.scale?.status === "verified" ? " · real size" : ""}
          </p>
          {item.resized && (
            <p className="text-[11px] font-medium text-amber-300">
              Resized · original {sizeText(item.originalM)}
              {item.variant && listedSize(item.variant) ? ` · the shop lists ${listedSize(item.variant)}` : ""}
            </p>
          )}
        </div>
        <button type="button" onClick={() => engine()?.select(null)} className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium">
          Done
        </button>
      </div>

      {scaleNotice && <p className="mt-2 rounded-xl bg-amber-500/90 px-3 py-2 text-xs font-medium text-black">{scaleNotice}</p>}

      {siblings.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
          {siblings.map((v) => (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={v.id === item.variant?.id}
              aria-label={v.name}
              onClick={() => void engine()?.changeVariant(v)}
              className={`h-7 w-7 rounded-full border-2 ${v.id === item.variant?.id ? "border-white" : "border-white/20"}`}
              style={{ backgroundColor: v.colorHex ?? "#999" }}
            />
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {item.placement !== "wall" && (
          <>
            <button type="button" aria-label="Turn left" onClick={() => engine()?.rotateSelected(TURN_STEP)} className={secondary}>
              ⟲ 15°
            </button>
            <button type="button" aria-label="Turn right" onClick={() => engine()?.rotateSelected(-TURN_STEP)} className={secondary}>
              ⟳ 15°
            </button>
          </>
        )}
        <button type="button" aria-expanded={resizing} onClick={() => setResizing((v) => !v)} className={item.resized ? `${secondary} text-amber-300` : secondary}>
          Resize
        </button>
        <button type="button" onClick={() => void engine()?.duplicateSelected()} className={secondary}>
          Duplicate
        </button>
        <button type="button" onClick={() => engine()?.deleteSelected()} className={`${secondary} text-red-300`}>
          Delete
        </button>
      </div>

      {resizing && <ResizePanel item={item} engine={engine} />}

      <button type="button" onClick={onAdd} className={`${primary} mt-3 w-full`}>
        + Add another piece
      </button>
    </div>
  );
}

// ---- add sheet --------------------------------------------------------------

function AddSheet({
  catalogue,
  onPick,
  onClose,
}: {
  catalogue: Variant[];
  onPick: (v: Variant) => void;
  onClose: () => void;
}) {
  const products = useMemo(() => {
    const byProduct = new Map<string, Variant>();
    for (const v of catalogue) {
      const current = byProduct.get(v.product.id);
      if (!current || (v.isDefault && !current.isDefault)) byProduct.set(v.product.id, v);
    }
    return [...byProduct.values()].sort((a, b) => a.product.name.localeCompare(b.product.name));
  }, [catalogue]);

  return (
    <div data-ui className={sheet}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Add to your room</p>
        <button type="button" onClick={onClose} className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium">
          Close
        </button>
      </div>
      <ul className="flex flex-col gap-1">
        {products.map((v) => {
          const where = placementOf(v);
          return (
            <li key={v.product.id}>
              <button type="button" onClick={() => onPick(v)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/10 active:bg-white/15">
                <span className="min-w-0">
                  <span className="block truncate text-sm">{v.product.name}</span>
                  <span className="block text-xs text-white/60">
                    {listedSize(v) ?? "Size not listed"}
                    {where !== "floor" ? ` · ${where === "wall" ? "on a wall" : "on a table"}` : ""}
                    {sizeQuality(v) && <span className="text-amber-300"> · {sizeQuality(v)}</span>}
                  </span>
                </span>
                <span aria-hidden className="text-lg text-white/60">+</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
