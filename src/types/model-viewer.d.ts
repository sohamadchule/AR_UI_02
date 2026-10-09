import type React from "react";

/**
 * Minimal typing for the <model-viewer> custom element and the attributes /
 * DOM API this app uses. `@google/model-viewer` ships runtime code but no React
 * JSX typings, so we augment React's JSX namespace here.
 */

export interface ModelViewerElement extends HTMLElement {
  /** e.g. "0deg 75deg 105%". Setting it re-frames the camera. */
  cameraOrbit: string;
  cameraTarget: string;
  fieldOfView: string;
  /** True when the platform can enter AR for the current model. */
  readonly canActivateAR: boolean;
  /** Programmatically enter AR (must be called from a user gesture). */
  activateAR: () => void;
  resetTurntableRotation: (radians?: number) => void;
}

export interface ModelViewerAttributes
  extends React.DetailedHTMLProps<
    React.HTMLAttributes<ModelViewerElement>,
    ModelViewerElement
  > {
  src?: string;
  alt?: string;
  poster?: string;
  "camera-controls"?: boolean;
  "auto-rotate"?: boolean;
  "disable-zoom"?: boolean;
  "touch-action"?: string;
  "shadow-intensity"?: string | number;
  exposure?: string | number;
  "environment-image"?: string;
  loading?: "auto" | "lazy" | "eager";
  reveal?: "auto" | "manual" | "interaction";
  "interaction-prompt"?: "auto" | "none";
  // AR (used in the AR milestone)
  ar?: boolean;
  "ar-modes"?: string;
  "ar-scale"?: "auto" | "fixed";
  "ar-placement"?: "floor" | "wall";
  "ios-src"?: string;
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerAttributes;
    }
  }
}
