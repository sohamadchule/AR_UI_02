export const SITE = {
  name: 'Akruti',
  platform: 'Akruti Platform',
} as const;

/** Dedicated "request a demo" page (the form + the pitch around it). */
export const DEMO_PATH = '/request-demo';

export interface NavLink {
  label: string;
  /** Router destination. */
  to: string;
}

/**
 * Primary navigation, shared by the desktop bar and the mobile sheet.
 * All entries must be real routes; in-page anchors belong in the section
 * they live in, not up here.
 */
export const NAV_LINKS: readonly NavLink[] = [
  { label: 'Home', to: '/' },
  { label: '3D Model', to: '/3d-model' },
  { label: 'Experience', to: '/experience' },
  { label: 'About', to: '/about' },
];

/** Real routes only; add Privacy / Terms here once those pages exist. */
export const FOOTER_LINKS: readonly NavLink[] = [
  { label: 'Experience', to: '/experience' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: DEMO_PATH },
];
