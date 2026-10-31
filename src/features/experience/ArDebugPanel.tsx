import type { ItemView, Snapshot } from './roomEngine';

/**
 * Development-only AR readings.
 *
 * Shown only in `vite dev` and only with `?debug` in the URL, so a customer can
 * never see it: in a production build `import.meta.env.DEV` is false and the
 * panel is unreachable. Device testing without it is guesswork — a model at the
 * wrong size, a feature the runtime refused and a tracking failure all look the
 * same through a phone screen.
 *
 * The line that matters most is LISTED vs DRAWN. If they disagree, the size is
 * wrong whatever the rest of the screen says.
 */

/** True only in `vite dev` with ?debug in the URL. Stripped from production builds. */
export function useArDebug(): boolean {
  return import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');
}

const cm = (metres: number) => (metres * 100).toFixed(1);
const cmFromMm = (mm: number | null) => (mm === null ? '—' : (mm / 10).toFixed(1));

function Row({ label, value, bad }: { label: string; value: React.ReactNode; bad?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="opacity-60">{label}</span>
      <span className={bad ? 'font-bold text-red-400' : ''}>{value}</span>
    </div>
  );
}

function SelectedPiece({ item }: { item: ItemView }) {
  const listed = item.variant?.product.dimensionsMm ?? null;
  const source = item.variant?.product.dimensionSource ?? 'UNKNOWN';
  const norm = item.variant?.model.normalization ?? null;
  const drawn = item.sizeM;

  // Worst-side disagreement between what the catalogue lists and what is drawn.
  const off = listed
    ? Math.max(
        ...(['width', 'depth', 'height'] as const).flatMap((a) => {
          const mm = listed[a];
          return mm ? [Math.abs((drawn[a] * 1000 - mm) / mm)] : [];
        }),
        0,
      )
    : null;

  return (
    <>
      <div className="mt-1 border-t border-white/20 pt-1 opacity-60">{item.name}</div>
      <Row label="listed" value={listed ? `${cmFromMm(listed.width)} × ${cmFromMm(listed.depth)} × ${cmFromMm(listed.height)} cm` : 'NONE'} bad={!listed} />
      <Row label="drawn" value={`${cm(drawn.width)} × ${cm(drawn.depth)} × ${cm(drawn.height)} cm`} bad={off !== null && off > 0.05} />
      {off !== null && <Row label="off by" value={`${(off * 100).toFixed(1)}%`} bad={off > 0.05} />}
      <Row label="dim source" value={source} bad={source === 'UNKNOWN' || source === 'ESTIMATED'} />
      <Row label="asset" value={norm ? `normalised v${norm.pipelineVersion} · ${norm.status}` : 'RAW (not normalised)'} bad={!norm || norm.status !== 'verified'} />
      {norm && <Row label="factor" value={`${norm.factor.toExponential(3)}${norm.turned ? ' · turned 90°' : ''}`} />}
      {/* Runtime correction: with a normalised asset this must be ~1.0. Anything
          else means a scale is being applied twice. */}
      {item.scale && <Row label="runtime ×" value={item.scale.scale.toFixed(4)} bad={Math.abs(item.scale.scale - 1) > 0.01 && Boolean(norm)} />}
    </>
  );
}

export default function ArDebugPanel({ snapshot }: { snapshot: Snapshot }) {
  const d = snapshot.diagnostics;
  const denied = d.requested.filter((f) => !d.granted.includes(f));
  const selected = snapshot.items.find((i) => i.id === snapshot.selectedId) ?? null;

  return (
    <div className="pointer-events-none absolute left-2 top-2 z-50 max-w-[76vw] rounded-lg bg-black/80 p-2.5 font-mono text-[10px] leading-relaxed text-white backdrop-blur">
      <Row label="fps" value={d.fps || '—'} bad={d.fps > 0 && d.fps < 20} />
      <Row label="tracking" value={snapshot.tracking} bad={snapshot.tracking !== 'ok'} />
      <Row label="anchored" value={d.anchored ? 'yes' : 'NO'} bad={!d.anchored} />
      <Row label="floor" value={snapshot.floorSet ? 'set' : 'not set'} bad={!snapshot.floorSet} />
      <Row label="surface" value={d.surface ?? '—'} />
      <Row label="target y" value={d.targetY === null ? '—' : `${cm(d.targetY)} cm`} bad={d.targetY !== null && Math.abs(d.targetY) > 0.15} />
      <Row label="pieces" value={snapshot.items.length} />
      <Row label="granted" value={d.granted.join(', ') || 'none'} />
      {denied.length > 0 && <Row label="DENIED" value={denied.join(', ')} bad />}
      {selected ? <SelectedPiece item={selected} /> : <div className="mt-1 border-t border-white/20 pt-1 opacity-50">no piece selected</div>}
    </div>
  );
}
