import type { StoreProduct } from './catalog';

const row = (
  slug: string,
  name: string,
  blurb: string,
  cat: [string, string],
  priceInr: number,
  mrpInr: number,
  dims: [number, number, number],
  finishes: { name: string; hex: string }[],
): StoreProduct => ({
  slug,
  name,
  blurb,
  description: '',
  category: { slug: cat[0], name: cat[1] },
  priceInr,
  mrpInr,
  variants: [],
  sampleFinishes: finishes,
  sampleDimsCm: { width: dims[0], depth: dims[1], height: dims[2] },
  isSample: true,
});

/**
 * Shown only when the catalogue API returns nothing, so a fresh checkout still
 * renders a believable store. These rows have no GLB: the product page says so
 * rather than pretending. `npm run db:seed:store` replaces them with real models.
 */
export const SAMPLE_PRODUCTS: StoreProduct[] = [
  row('mahal-3-seater-sofa', 'Mahal 3-seater sofa', 'Feather-blend seat, mango-wood frame', ['living', 'Living'], 64900, 79900, [212, 88, 76],
    [{ name: 'Rust', hex: '#D4502A' }, { name: 'Forest', hex: '#2F4F4A' }, { name: 'Mist', hex: '#7D8794' }]),
  row('ira-lounge-chair', 'Ira lounge chair', 'Deep seat, low arms', ['living', 'Living'], 27500, 32000, [78, 82, 94],
    [{ name: 'Ochre', hex: '#C7CE46' }, { name: 'Indigo', hex: '#24415F' }, { name: 'Tan', hex: '#A8714C' }]),
  row('sabha-dining-table', 'Sabha round dining table', 'Seats four, 122 cm top', ['dining', 'Dining'], 41200, 48000, [122, 122, 75],
    [{ name: 'Walnut', hex: '#6B4A32' }]),
  row('nook-side-table', 'Nook side table', 'Tucks beside any sofa', ['living', 'Living'], 8900, 11000, [55, 55, 48],
    [{ name: 'Natural oak', hex: '#C89F72' }]),
  row('kaam-writing-desk', 'Kaam writing desk', 'Cable tray, two drawers', ['study', 'Study'], 22400, 26500, [140, 65, 75],
    [{ name: 'Chalk', hex: '#E4DED6' }]),
  row('grid-bookshelf', 'Grid bookshelf', '25 cubes, wall-anchored', ['study', 'Study'], 18700, 22900, [180, 32, 185],
    [{ name: 'Snow', hex: '#F2F2F0' }]),
  row('alcove-wardrobe', 'Alcove wardrobe', 'Two doors, open shelving', ['bedroom', 'Bedroom'], 58000, 69000, [120, 58, 190],
    [{ name: 'Honey', hex: '#B08451' }]),
  row('perch-bar-stool', 'Perch bar stool', '74 cm seat, leather top', ['dining', 'Dining'], 6450, 7800, [36, 36, 74],
    [{ name: 'Espresso', hex: '#4A3426' }]),
  row('halo-floor-lamp', 'Halo floor lamp', 'E27, dimmable, 1.5 m cord', ['living', 'Living'], 5200, 6400, [40, 40, 152],
    [{ name: 'Poppy', hex: '#E03B2F' }]),
];
