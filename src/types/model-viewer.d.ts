import type React from "react";

/**
 * Minimal typing for the <model-viewer> custom element and the attributes /
 * DOM API this app uses. `@google/model-viewer` ships runtime code but no React
 * JSX typings, so we augment React's JSX namespace here.
 */

/** The slice of model-viewer's scene-graph material API this app uses. */
export interface ModelViewerMaterial {
  name: string;
  /** Linear RGB. */
  readonly emissiveFactor: [number, number, number];
  setEmissiveFactor: (rgb: [number, number, number] | string) => void;
  /** Linear RGB; [0,0,0] when the material has no sheen. */
  readonly sheenColorFactor: [number, number, number];
  setSheenColorFactor: (rgb: [number, number, number] | string) => void;
  pbrMetallicRoughness: {
    /** Linear RGBA. */
    readonly baseColorFactor: [number, number, number, number];
    setBaseColorFactor: (rgba: [number, number, number, number] | string) => void;
  };
}

export interface ModelViewerElement extends HTMLElement {
  /** The loaded model; `materials` follow the glTF materials array order. */
  readonly model?: { readonly materials: ModelViewerMaterial[] };
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
  "camera-orbit"?: string;
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
