/**
 * WebXR capability detection and session configuration.
 *
 * In-page AR (the camera compositing inside our own page, with our own UI on
 * top) requires the `immersive-ar` session mode plus the `hit-test` feature for
 * real-world surface detection. Support today means Android Chrome and other
 * Chromium-based mobile browsers; iOS Safari ships no WebXR at all, so callers
 * MUST keep the `<model-viewer>` Quick Look / Scene Viewer path as a fallback
 * rather than treating a false result here as "no AR".
 */

/** Session mode used for in-page AR. */
export const AR_SESSION_MODE = "immersive-ar" as const;

/**
 * Session options.
 *
 * `hit-test` is required — without it there is no surface to place onto.
 * `dom-overlay` is optional so the session still starts on runtimes that lack
 * it; we simply lose the HTML controls and fall back to tap-to-place.
 */
export const AR_REQUIRED_FEATURES = ["hit-test"] as const;
export const AR_OPTIONAL_FEATURES = ["dom-overlay", "light-estimation", "anchors"] as const;
/** Everything we ask for. What the runtime GRANTS is read back from the session. */
export const AR_FEATURES: string[] = [...AR_REQUIRED_FEATURES, ...AR_OPTIONAL_FEATURES];

export function arSessionInit(overlayRoot: HTMLElement): XRSessionInit {
  return {
    requiredFeatures: [...AR_REQUIRED_FEATURES],
    optionalFeatures: [...AR_OPTIONAL_FEATURES],
    domOverlay: { root: overlayRoot },
  };
}

/** Whether this browser can run in-page AR. Never throws. */
export async function isImmersiveArSupported(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.xr) return false;
  try {
    return await navigator.xr.isSessionSupported(AR_SESSION_MODE);
  } catch {
    return false;
  }
}
