export const SITE = {
  name: 'Akruti',
  platform: 'Akruti Platform',
} as const;

export interface NavLink {
  label: string;
  /** Router destination. Hash targets scroll to a section on the home page. */
  to: string;
}

export const NAV_LINKS: readonly NavLink[] = [
  { label: 'About', to: '/about' },
  { label: 'Experience', to: '/experience' },
  { label: '3D Model', to: '/3d-model' },
  { label: 'Value', to: '/#value' },
];

export const FOOTER_LINKS: readonly NavLink[] = [
  { label: 'Privacy', to: '#' },
  { label: 'Terms', to: '#' },
  { label: 'Contact', to: '#' },
];
