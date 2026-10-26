import { useState } from 'react';
import type { Variant } from '@/lib/api';
import { cn } from '@/lib/cn';

/** A still of the variant rendered from its own GLB, in its own colour (public/posters/<id>.webp). */
export const posterUrl = (variant: Variant) => `/posters/${variant.id}.webp`;

/**
 * Catalogue-tile artwork.
 *
 * Deliberately NOT a <model-viewer>: each one takes its own WebGL context and
 * browsers cap those around sixteen, so a grid of them starts dropping canvases
 * and pulls every GLB down at once. The live 3D belongs on the product page,
 * where there is exactly one.
 *
 * Shows a still rendered from the model when one exists in public/posters.
 * Without one (a new upload, or a sample row) it draws a tile tinted with the
 * variant's finish colour, so the grid still reads as a shop.
 */
export function ModelThumb({
  variant,
  alt,
  large = false,
}: {
  variant: Variant | undefined;
  alt: string;
  large?: boolean;
}) {
  const hex = variant?.colorHex ?? null;
  const [posterFailed, setPosterFailed] = useState<string | null>(null);
  const poster = variant && posterFailed !== variant.id ? posterUrl(variant) : null;

  return (
    <div
      role="img"
      aria-label={alt ? `${alt} — 3D model` : '3D model'}
      className={cn(
        'relative grid h-full w-full place-items-center overflow-hidden rounded-store',
        large ? 'min-h-[180px]' : '',
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: hex
            ? `radial-gradient(70% 60% at 50% 42%, ${hex}2E, transparent 70%)`
            : 'radial-gradient(70% 60% at 50% 42%, rgb(var(--accent) / 0.16), transparent 70%)',
        }}
      />
      {poster ? (
        <img
          src={poster}
          alt=""
          loading="lazy"
          onError={() => setPosterFailed(variant!.id)}
          className="relative h-full w-full object-contain transition-transform duration-500 ease-out-expo group-hover:scale-[1.04]"
        />
      ) : (
        <div className="relative flex flex-col items-center gap-2 text-fg-subtle">
          <svg
            width={large ? 72 : 42}
            height={large ? 72 : 42}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
            aria-hidden
          >
            <path d="M21 16V8l-9-5-9 5v8l9 5 9-5Z" />
            <path d="m3.3 7.3 8.7 4.7 8.7-4.7M12 12v9.5" />
          </svg>
          {variant && (
            <span className="text-[11px] uppercase tracking-[0.14em]">{variant.name}</span>
          )}
        </div>
      )}
    </div>
  );
}
