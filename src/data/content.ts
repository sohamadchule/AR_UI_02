export interface Swatch {
  id: string;
  name: string;
  /** Swatch colour shown in the picker. */
  hex: string;
  /** Hue/saturation blended onto the upholstery (mix-blend-mode: color). */
  tint: string;
  /** Luminance adjustment applied to the upholstery before tinting. */
  brightness: number;
}

export const SWATCHES: readonly Swatch[] = [
  { id: 'beige', name: 'Beige', hex: '#E5D9C5', tint: '#d9c4a0', brightness: 1.5 },
  { id: 'charcoal', name: 'Charcoal', hex: '#4A4A4A', tint: '#4a4a4a', brightness: 0.55 },
  { id: 'rust', name: 'Rust Red', hex: '#C05A3E', tint: '#c4553a', brightness: 0.95 },
  { id: 'navy', name: 'Navy Blue', hex: '#2C3E50', tint: '#2a3f78', brightness: 0.7 },
];

export interface ValueProp {
  title: string;
  description: string;
}

export const VALUE_PROPS: readonly ValueProp[] = [
  {
    title: 'Reduce Returns',
    description: 'When customers know it fits mathematically and aesthetically, fit-related returns drop drastically.',
  },
  {
    title: 'Increase Conversion',
    description: "Interactive 3D keeps users on-page longer and builds the confidence required to click 'Buy'.",
  },
  {
    title: 'Scale Effortlessly',
    description: 'One 3D model powers web views, AR experiences, and unlimited configuration renders.',
  },
];

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

/** Locally hosted assets (see /public/images). Photos: Unsplash. */
export const IMAGES = {
  heroSofa: asset('images/hero-sofa.jpg'),
  configuratorChair: asset('images/configurator-chair.jpg'),
  /** Alpha mask of the chair upholstery only (wood and backdrop excluded). */
  configuratorChairMask: asset('images/configurator-chair-mask.png'),
} as const;
