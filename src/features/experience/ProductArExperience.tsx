import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";

import ModelViewer from "./ModelViewer";
import type { Recolor } from "@/lib/color";
import { AR_SESSION_MODE, arSessionInit, isImmersiveArSupported } from "@/lib/webxr";

// three.js and the AR scene are only ever needed once someone taps into AR, so
// they stay out of the initial page payload.
const ArScene = lazy(() => import("./ArScene"));

export interface ProductArExperienceProps {
  /** Stable model URL — /api/variants/<id>/model. */
  src: string;
  /** Accessible description of the model. */
  alt: string;
  /** Colours for the model's recolourable materials, part by part, in 3D and in AR. */
  recolor?: readonly Recolor[] | null;
  /** Passed through to ModelViewer. */
  autoRotate?: boolean;
  disableZoom?: boolean;
  showArUnavailable?: boolean;
  cameraOrbit?: string;
}

/**
 * Chooses the best AR path this device can actually run, and owns the session.
 *
 * - WebXR (Android Chrome and friends): the camera composites INSIDE this page,
 *   with our own controls on top — see ArScene.
 * - Otherwise (iOS Safari above all, which ships no WebXR): fall back to
 *   `<model-viewer>`'s own button, which hands off to Quick Look or Scene
 *   Viewer. Same product, same GLB, platform-native AR.
 *
 * The 3D preview renders identically either way, so the page is never blocked
 * on AR support.
 */
export default function ProductArExperience({
  src,
  alt,
  recolor,
  autoRotate,
  disableZoom,
  showArUnavailable,
  cameraOrbit,
}: ProductArExperienceProps) {
  const [webXrSupported, setWebXrSupported] = useState<boolean | null>(null);
  const [session, setSession] = useState<XRSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Must exist in the DOM before requestSession: it is the dom-overlay root.
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    isImmersiveArSupported().then((supported) => {
      if (active) setWebXrSupported(supported);
    });
    return () => {
      active = false;
    };
  }, []);

  const startAr = useCallback(() => {
    const root = overlayRef.current;
    if (!root || !navigator.xr) return;
    setError(null);
    // Called synchronously from the tap: requestSession needs user activation.
    navigator.xr
      .requestSession(AR_SESSION_MODE, arSessionInit(root))
      .then(setSession)
      .catch(() => setError("Couldn't start AR. Camera permission may be blocked."));
  }, []);

  const handleEnd = useCallback(() => setSession(null), []);

  return (
    <>
      <div className="absolute inset-0">
        {/* When WebXR is available we present our own button instead, so
            model-viewer's built-in AR affordance is suppressed. */}
        <ModelViewer
          src={src}
          alt={alt}
          ar
          showArButton={webXrSupported === false}
          recolor={recolor}
          autoRotate={autoRotate}
          disableZoom={disableZoom}
          showArUnavailable={showArUnavailable}
          cameraOrbit={cameraOrbit}
        />
      </div>

      {webXrSupported && !session && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 p-3">
          <button
            type="button"
            onClick={startAr}
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-fg px-6 py-3 text-sm font-semibold text-surface shadow-lg transition-transform active:scale-95"
          >
            <span aria-hidden>◈</span> View in your room
          </button>
          {error && (
            <p className="pointer-events-auto max-w-xs rounded-full bg-black/70 px-4 py-2 text-center text-xs text-white">
              {error}
            </p>
          )}
        </div>
      )}

      {/* dom-overlay root. Present from first render, empty until AR starts. */}
      <div ref={overlayRef}>
        {session && (
          <Suspense fallback={null}>
            <ArScene src={src} session={session} onEnd={handleEnd} recolor={recolor} />
          </Suspense>
        )}
      </div>
    </>
  );
}
