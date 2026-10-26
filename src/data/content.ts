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
    title: 'Fewer returns',
    description: 'Buyers check the size against their own wall and doorway first, so fewer pieces come back for not fitting.',
  },
  {
    title: 'More confident buyers',
    description: "A piece someone has turned around and placed in their room is far easier to say yes to than a flat photo.",
  },
  {
    title: 'One model, everywhere',
    description: 'The same 3D file powers your product page, AR, QR codes on the shop floor and every colour variant.',
  },
];

export interface Step {
  title: string;
  description: string;
}

export const STEPS: readonly Step[] = [
  {
    title: 'Upload your model',
    description: 'Send a GLB of any piece. We read its real dimensions and work out which parts can take a new colour.',
  },
  {
    title: 'Get a link and a QR code',
    description: 'Every colour gets its own page to link from your site, and a QR to print on a price tag or catalogue.',
  },
  {
    title: 'Buyers place it at home',
    description: 'They open it on their phone and see the piece in their room at true size. No app, on Android or iPhone.',
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
