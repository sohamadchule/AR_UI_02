
import { useCallback, useEffect, useRef, useState } from "react";

import type { ModelViewerElement } from "@/types/model-viewer";

type Status = "loading" | "loaded" | "error";
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
}: ModelViewerProps) {
  const ref = useRef<ModelViewerElement>(null);
  const [defined, setDefined] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const [progress, setProgress] = useState(0);
  const [arSupported, setArSupported] = useState<boolean | null>(null);
  const [arStatus, setArStatus] = useState<ArStatus>("not-presenting");
  const [trackedSrc, setTrackedSrc] = useState(src);

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

  const handleReset = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.cameraOrbit = "0deg 75deg 105%";
    el.cameraTarget = "auto auto auto";
    el.fieldOfView = "auto";
  }, []);

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
          touch-action="pan-y"
          shadow-intensity="1"
          exposure="1"
          reveal="auto"
          auto-rotate={autoRotate}
          interaction-prompt="auto"
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
          ) : arSupported === false ? (
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
