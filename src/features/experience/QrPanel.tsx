import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { fetchShareUrl, qrUrl, viewPath, type Variant } from '@/lib/api';
import { encodePicks, type PartPicks } from '@/lib/color';
import { useAsync } from '@/hooks/useAsync';
import { buttonClasses } from '@/components/ui/Button';

/**
 * QR code for a variant's public page, with the URL it encodes and download links.
 * Colours picked for the extra parts travel with it, so the phone opens the same mix.
 */
export function QrPanel({ variant, picks = {} }: { variant: Variant; picks?: PartPicks }) {
  const [copied, setCopied] = useState(false);
  const mix = encodePicks(variant.model.tint, picks);
  // The server decides the host (PUBLIC_BASE_URL, tunnel, or LAN IP) so the phone can reach it.
  const shared = useAsync(() => fetchShareUrl(variant.id, mix), `${variant.id}?${mix}`);
  const publicUrl = shared.status === 'ready' ? shared.data : `${window.location.origin}${viewPath(variant.id)}${mix ? `?mix=${mix}` : ''}`;

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (insecure context or denied): nothing to do.
    }
  }

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
      <img
        // Re-keyed per variant and mix so the old code never lingers while the new one loads.
        key={`${variant.id}?${mix}`}
        src={qrUrl(variant.id, { mix })}
        alt={`QR code that opens ${variant.product.name} (${variant.name}) in 3D`}
        width={176}
        height={176}
        className="h-44 w-44 shrink-0 rounded-xl border border-line/15 bg-white p-2"
      />

      <div className="min-w-0 flex-1 space-y-4">
        <div className="space-y-2">
          <p className="eyebrow text-fg-subtle">Scan to view in 3D / AR</p>
          <div className="flex items-center gap-2">
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 flex-1 items-center gap-2 truncate rounded-lg border border-line/15 px-3 py-2 text-sm text-fg-muted transition-colors hover:text-fg"
            >
              <span className="truncate">{publicUrl}</span>
              <ExternalLink size={14} aria-hidden className="shrink-0" />
            </a>
            <button
              type="button"
              onClick={copyUrl}
              aria-label="Copy link"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line/15 text-fg-soft transition-colors hover:border-fg/40 hover:text-fg"
            >
              {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
            </button>
          </div>
          <p className="text-xs leading-relaxed text-fg-subtle">
            The code points to this page, not the model file, so updating the model never invalidates a printed code.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a href={qrUrl(variant.id, { download: true, mix })} className={buttonClasses('primary', 'md')}>
            Download PNG
          </a>
          <a href={qrUrl(variant.id, { format: 'svg', download: true, mix })} className={buttonClasses('outline', 'md')}>
            Download SVG
          </a>
        </div>
      </div>
    </div>
  );
}
