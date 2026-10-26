
import { useCallback, useEffect, useRef, useState } from "react";

import { sheenFactor, tintFactor, type Recolor, type Rgb } from "@/lib/color";
import type { ModelViewerElement, ModelViewerMaterial } from "@/types/model-viewer";

type Status = "loading" | "loaded" | "error";

/** How long a colour change fades for. */
const RECOLOR_MS = 350;
type ArStatus =
  | "not-presenting"
  | "session-started"
  | "object-placed"
  | "failed";

export interface ModelViewerProps {
  /** URL of the GLB to load (e.g. the stable /api/variants/<id>/model route). */
  src: string;
  /** Accessible description of the model. */
  alt?: string;
  /** Optional poster image shown while the model loads. */
  poster?: string;
  /** Extra classes for the outer container. */
  className?: string;
  /** Enable AR affordances (Scene Viewer / Quick Look / WebXR). */
  ar?: boolean;
  /** Optional iOS USDZ source for Quick Look. */
  iosSrc?: string;
  /** Auto-rotate the model when idle. */
  autoRotate?: boolean;
  /** Render the built-in "View in AR" button / unavailable message. */
  showArButton?: boolean;
  /** Notified when AR availability is determined (after the model loads). */
  onArAvailabilityChange?: (supported: boolean) => void;
  /** Show the model's recolourable materials in this colour (applied without reloading). */
  recolor?: Recolor | null;
  /** glTF material index to make glow, so a person can see which part it is; null for none. */
  highlight?: number | null;
  /** Stop the scroll wheel zooming, so it scrolls the page instead (pinch still works on touch). */
  disableZoom?: boolean;
  /** With `showArButton`, also explain when AR is unavailable (off for desktop heroes that offer a QR instead). */
  showArUnavailable?: boolean;
  /** Starting (and reset) camera position, e.g. "180deg 75deg 105%" for a model authored facing away. */
  cameraOrbit?: string;
}

/**
 * Set each tint material's base colour for `recolor`, fading from the current
 * colour when `fadeMs` > 0. Returns a function that cancels the fade.
 */
function applyRecolor(el: ModelViewerElement, recolor: Recolor, fadeMs: number): () => void {
  const materials = el.model?.materials ?? [];
  let steps;
  try {
    steps = recolorSteps(materials, recolor);
  } catch (err) {
    console.error("Recolour failed", err);
    return () => {};
  }
  return runRecolor(steps, fadeMs);
}

function recolorSteps(materials: ModelViewerMaterial[], recolor: Recolor) {
  return recolor.tint.materials.flatMap((m) => {
    const material = materials[m.index];
    if (!material) return [];
    const [r, g, b, a] = material.pbrMetallicRoughness.baseColorFactor;
    // Only materials authored with KHR_materials_sheen have a sheen colour: reading it on
    // any other material throws inside model-viewer (three.js has no sheenColor there).
    const sheenTo = m.sheen ? sheenFactor(recolor.hex, m) : null;
    return [{
      material,
      from: [r, g, b] as Rgb,
      to: tintFactor(recolor.hex, m.texAvg),
      alpha: a,
      sheenFrom: sheenTo ? ([...material.sheenColorFactor] as Rgb) : null,
      sheenTo,
    }];
  });
}

function runRecolor(steps: ReturnType<typeof recolorSteps>, fadeMs: number): () => void {
  const mix = (from: Rgb, to: Rgb, t: number) => from.map((f, i) => f + (to[i] - f) * t) as Rgb;
  let frame = 0;
  const start = performance.now();
  const tick = (now: number) => {
    const t = fadeMs > 0 ? Math.min(1, (now - start) / fadeMs) : 1;
    const eased = 1 - (1 - t) ** 3;
    try {
      for (const s of steps) {
        s.material.pbrMetallicRoughness.setBaseColorFactor([...mix(s.from, s.to, eased), s.alpha]);
        if (s.sheenFrom && s.sheenTo) s.material.setSheenColorFactor(mix(s.sheenFrom, s.sheenTo, eased));
      }
    } catch (err) {
      // A model the colour API can't handle must never take the page down with it.
      console.error("Recolour failed", err);
      return;
    }
    if (t < 1) frame = requestAnimationFrame(tick);
  };
  if (fadeMs > 0) frame = requestAnimationFrame(tick);
  else tick(start);
  return () => cancelAnimationFrame(frame);
}

/**
 * Reusable 3D + AR viewer built on <model-viewer>.
 *
 * Loads the web component on the client only, exposes camera controls
 * (rotate/zoom/pan), and handles loading, load failure, retry, and camera reset.
 * When `ar` is set, it wires platform AR (Scene Viewer on Android, Quick Look on
 * iOS, WebXR where available), detects support after the model loads, and — when
 * `showArButton` is on — renders a prominent "View in AR" button or a clear
 * "AR unavailable" message. The 3D viewer always keeps working regardless of AR
 * support.
 */
export default function ModelViewer({
  src,
  alt,
  poster,
  className,
  ar = false,
  iosSrc,
  autoRotate = false,
  showArButton = true,
  onArAvailabilityChange,
  recolor,
  highlight = null,
  disableZoom = false,
  showArUnavailable = true,
  cameraOrbit = "0deg 75deg 105%",
}: ModelViewerProps) {
  const ref = useRef<ModelViewerElement>(null);
  const [defined, setDefined] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const [progress, setProgress] = useState(0);
  const [arSupported, setArSupported] = useState<boolean | null>(null);
  const [arStatus, setArStatus] = useState<ArStatus>("not-presenting");
  const [trackedSrc, setTrackedSrc] = useState(src);
  // Latest colour, read by the load handler so a fresh model never flashes its authored colour.
  const recolorRef = useRef(recolor);
  recolorRef.current = recolor;

  // Reset visual state when the model source changes (render-time adjustment,
  // the React-recommended alternative to a resetting effect).
  if (src !== trackedSrc) {
    setTrackedSrc(src);
    setStatus("loading");
    setProgress(0);
    setArSupported(null);
  }

  // Register the custom element on the client only.
  useEffect(() => {
    let active = true;
    import("@google/model-viewer")
      .then(() => {
        if (active) setDefined(true);
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  // Wire model-viewer events once the element is present.
  useEffect(() => {
    const el = ref.current;
    if (!el || !defined) return;

    const onLoad = () => {
      if (recolorRef.current) applyRecolor(el, recolorRef.current, 0);
      setStatus("loaded");
      if (ar) {
        const supported = Boolean(el.canActivateAR);
        setArSupported(supported);
        onArAvailabilityChange?.(supported);
      }
    };
    const onError = () => setStatus("error");
    const onProgress = (event: Event) => {
      const detail = (event as CustomEvent<{ totalProgress?: number }>).detail;
      if (detail?.totalProgress !== undefined) {
        setProgress(Math.round(detail.totalProgress * 100));
      }
    };
    const onArStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ status?: ArStatus }>).detail;
      if (detail?.status) setArStatus(detail.status);
    };

    el.addEventListener("load", onLoad);
    el.addEventListener("error", onError);
    el.addEventListener("progress", onProgress as EventListener);
    el.addEventListener("ar-status", onArStatus as EventListener);
    return () => {
      el.removeEventListener("load", onLoad);
      el.removeEventListener("error", onError);
      el.removeEventListener("progress", onProgress as EventListener);
      el.removeEventListener("ar-status", onArStatus as EventListener);
    };
  }, [defined, src, ar, onArAvailabilityChange]);

  // Colour switches on an already-loaded model: fade, no reload.
  const recolorHex = recolor?.hex;
  const recolorTint = recolor?.tint;
  useEffect(() => {
    const el = ref.current;
    if (!el || status !== "loaded" || !recolorHex || !recolorTint) return;
    return applyRecolor(el, { hex: recolorHex, tint: recolorTint }, RECOLOR_MS);
  }, [status, recolorHex, recolorTint]);

  // Pulse the highlighted material's glow, then put its own emissive colour back.
  useEffect(() => {
    const material = highlight === null || status !== "loaded" ? undefined : ref.current?.model?.materials[highlight];
    if (!material) return;
    let original: [number, number, number];
    try {
      original = [...material.emissiveFactor] as [number, number, number];
    } catch {
      return;
    }
    let frame = 0;
    const tick = (now: number) => {
      const glow = 0.55 + 0.4 * Math.sin(now / 180);
      try {
        material.setEmissiveFactor([glow, glow * 0.55, 0]);
      } catch {
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      try {
        material.setEmissiveFactor(original);
      } catch {
        // model already gone
      }
    };
  }, [highlight, status]);

  const handleReset = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.cameraOrbit = cameraOrbit;
    el.cameraTarget = "auto auto auto";
    el.fieldOfView = "auto";
  }, [cameraOrbit]);

  const handleRetry = useCallback(() => {
    const el = ref.current;
    setStatus("loading");
    setProgress(0);
    if (!el) return;
    el.removeAttribute("src");
    requestAnimationFrame(() => {
      el.setAttribute("src", src);
    });
  }, [src]);

  const handleActivateAr = useCallback(() => {
    ref.current?.activateAR();
  }, []);

  // Fills its wrapper by absolute positioning rather than `h-full`: callers may
  // size the box with `min-height` alone (no definite height), against which a
  // percentage height collapses to zero and the viewer disappears entirely.
  return (
    <div
      className={`absolute inset-0 overflow-hidden ${className ?? ""}`}
      data-status={status}
      data-ar-status={arStatus}
    >
      {defined && (
        <model-viewer
          ref={ref}
          src={src}
          alt={alt ?? "Interactive 3D model"}
          poster={poster}
          camera-controls
          // Spread, not `={false}`: React 18 writes "false" onto custom elements, which still enables it.
          {...(disableZoom ? { "disable-zoom": true } : {})}
          touch-action="pan-y"
          shadow-intensity="1"
          exposure="1"
          reveal="auto"
          auto-rotate={autoRotate}
          camera-orbit={cameraOrbit}
          // The prompt's wiggle takes over the camera and stops auto-rotate; the spin already says "3D".
          interaction-prompt={autoRotate ? "none" : "auto"}
          {...(ar
            ? {
                ar: true,
                "ar-modes": "webxr scene-viewer quick-look",
                "ar-scale": "fixed" as const,
                ...(iosSrc ? { "ios-src": iosSrc } : {}),
              }
            : {})}
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "transparent",
          }}
        >
          {/* Suppress model-viewer's default AR button; we manage AR ourselves. */}
          {ar && <div slot="ar-button" style={{ display: "none" }} />}
        </model-viewer>
      )}

      {status === "loading" && (
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3"
          role="status"
          aria-live="polite"
        >
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60"
            aria-hidden
          />
          <p className="text-xs text-current opacity-60">
            Loading model{progress > 0 ? ` — ${progress}%` : "…"}
          </p>
        </div>
      )}

      {status === "error" && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
          role="alert"
        >
          <p className="text-sm font-medium">Couldn&apos;t load the 3D model</p>
          <p className="max-w-xs text-xs opacity-70">
            The model may be missing, corrupted, or unavailable right now.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="rounded-full border border-current px-4 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
          >
            Try again
          </button>
        </div>
      )}

      {status === "loaded" && (
        <button
          type="button"
          onClick={handleReset}
          className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition-opacity hover:opacity-80"
          aria-label="Reset camera view"
        >
          Reset view
        </button>
      )}

      {ar && showArButton && status === "loaded" && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 p-3">
          {arSupported ? (
            <button
              type="button"
              onClick={handleActivateAr}
              className="flex items-center gap-2 rounded-full bg-fg px-6 py-3 text-sm font-semibold text-surface shadow-lg transition-transform active:scale-95"
            >
              <span aria-hidden>◈</span> View in AR
            </button>
          ) : arSupported === false && showArUnavailable ? (
            <p className="max-w-xs rounded-full bg-black/60 px-4 py-2 text-center text-xs text-white backdrop-blur">
              AR isn&apos;t available on this device or browser. You can still
              explore the 3D model above.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
