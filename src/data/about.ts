export interface Principle {
  title: string;
  description: string;
}

export const PRINCIPLES: readonly Principle[] = [
  {
    title: 'Confidence before checkout',
    description:
      'Every feature exists to answer the two questions buyers ask first: will it fit, and how will it look in my home.',
  },
  {
    title: 'Fidelity over flash',
    description:
      'Accurate dimensions, true-to-life materials and honest lighting. A render should never promise what the product cannot deliver.',
  },
  {
    title: 'Built for catalogs, not demos',
    description:
      'One model should power the web viewer, the AR experience and every configuration, so growing a catalog never means starting over.',
  },
];

export interface Step {
  step: string;
  title: string;
  description: string;
}

export const PROCESS: readonly Step[] = [
  { step: '01', title: 'Digitize', description: 'We turn your existing products into production-ready 3D models.' },
  { step: '02', title: 'Configure', description: 'Define the fabrics, colors and finishes shoppers can explore.' },
  { step: '03', title: 'Deliver', description: 'Publish to your storefront as an interactive 3D and AR experience.' },
];
