/**
 * The immersive showroom site: a one-shop website, mounted on a store's own URL
 * (e.g. /store/kadam), that walks the visitor into the shop before the catalogue.
 *
 * Everything shop-specific lives in two places, so onboarding another shopkeeper
 * never means editing components:
 *   - the shop's name, city, phone, WhatsApp, address, hours and map query come
 *     from its `Brand` entry in brands.ts (the same data the rest of the store uses);
 *   - the showroom's own copy, photographs and featured product live here.
 *
 * Products themselves are never listed here: they come from the live catalogue
 * (/api/variants), so prices, sizes, colours and 3D models are always the real ones.
 */

/** A photograph shipped in two widths: `<base>-1000.jpg` for phones, `<base>-2000.jpg` for desktop. */
export interface Photo {
  /** Path under /public without the width suffix, e.g. 'showroom/kadam/photos/hero'. */
  base: string;
  alt: string;
  /** Where the camera pushes in to (CSS transform-origin), e.g. '50% 60%' for a sofa low in the frame. */
  focus?: string;
}

/**
 * What the "enter the shop" section is built from. Pick the best real asset the shop has:
 *  - `frames`: a few showroom photographs. The section draws a shop front with the first
 *    photo seen through its glass doors, walks through the doors, then moves from photo to
 *    photo. Works with a single photo; reads best with 3–5 taken walking in.
 *  - `video`: one continuous walkthrough video, scrubbed by scroll. Encode it with a
 *    keyframe every few frames (e.g. ffmpeg -g 6) or seeking will stutter.
 */
export type Walkthrough =
  | { kind: 'frames'; frames: (Photo & { caption: string })[] }
  | { kind: 'video'; src: string; poster: Photo };

export type HighlightIcon = 'sofa' | 'ruler' | 'hand' | 'store' | 'scan';

export interface Showroom {
  /** The `Brand.slug` this showroom belongs to. */
  brandSlug: string;
  /** Show the small "Powered by Akruti" label next to the shop name. */
  poweredByLabel: boolean;
  seo: { title: string; description: string };
  hero: {
    eyebrow: string;
    /** Two lines; the second is set in the accent style. */
    title: [string, string];
    lede: string;
    photo: Photo;
  };
  walkthrough: Walkthrough;
  /** Signage on the drawn shop front in the walkthrough. */
  signage: { line: string };
  collection: {
    eyebrow: string;
    title: [string, string];
    lede: string;
    /** Folder of per-product images named `<product-slug>.webp`; a missing one falls back to a drawn tile. */
    imageDir: string;
  };
  featured: {
    /** Catalogue product slug; the section hides if it is not in the catalogue. */
    productSlug: string;
    eyebrow: string;
    /** Starting camera for the live 3D view (some models are authored facing away). */
    cameraOrbit?: string;
  };
  highlights: {
    title: [string, string];
    items: { icon: HighlightIcon; title: string; text: string }[];
  };
  about: {
    title: string;
    /** Paragraphs. */
    story: string[];
    owner: string | null;
    specialties: string[];
    photo: Photo;
    teamPhoto: Photo | null;
  };
  visit: { title: [string, string] };
  /** One-line description for the footer. */
  footerBlurb: string;
  social: { label: string; url: string }[];
  /**
   * What is still placeholder content. In development each of these shows a small
   * dashed "placeholder" label on the page, so nothing fake ships unnoticed.
   */
  placeholders: { photos: boolean; story: boolean; contact: boolean; highlights: boolean };
}

const photos = 'showroom/kadam/photos';

export const SHOWROOMS: readonly Showroom[] = [
  {
    brandSlug: 'kadam',
    poweredByLabel: true,
    seo: {
      title: 'Kadam Works · Furniture showroom in Belagavi',
      description:
        'Step inside the Kadam Works furniture showroom online. Explore sofas, chairs, tables and storage in 3D, and place them in your own room with AR.',
    },
    hero: {
      eyebrow: 'Your neighbourhood furniture destination',
      title: ['Find the furniture', 'that feels like home.'],
      lede: 'Explore our collection, discover your favourite designs, and imagine them in your own space.',
      photo: { base: `${photos}/hero`, alt: 'Sofas, armchairs and tables arranged on a sunlit showroom floor', focus: '45% 60%' },
    },
    walkthrough: {
      kind: 'frames',
      frames: [
        { base: `${photos}/entrance`, alt: 'A bright showroom floor with armchairs and a modular sofa', caption: 'Step inside', focus: '50% 70%' },
        { base: `${photos}/living`, alt: 'A living room set with a leather sofa, armchairs and a round coffee table', caption: 'Living', focus: '55% 65%' },
        { base: `${photos}/dining`, alt: 'A dining table with green velvet chairs under a pendant light', caption: 'Dining', focus: '45% 70%' },
        { base: `${photos}/lounge`, alt: 'A calm lounge corner with a cream sofa and a rounded armchair', caption: 'The collection', focus: '50% 65%' },
      ],
    },
    signage: { line: 'Furniture showroom' },
    collection: {
      eyebrow: 'The collection',
      title: ['Discover furniture.', 'Find your style.'],
      lede: 'Explore carefully selected furniture designed to bring comfort, character and function into your home.',
      imageDir: 'showroom/kadam/products',
    },
    featured: {
      productSlug: 'mahal-3-seater-sofa',
      eyebrow: 'A closer look',
      cameraOrbit: '200deg 78deg 105%',
    },
    highlights: {
      title: ['Furniture chosen with care.', 'Service you can trust.'],
      items: [
        { icon: 'sofa', title: 'Designs for every home', text: 'Living, dining, bedroom and study pieces, from compact to statement.' },
        { icon: 'ruler', title: 'Transparent product information', text: 'Every piece lists its real width, depth and height, so you can measure before you visit.' },
        { icon: 'scan', title: 'See it in your room first', text: 'Open any piece in 3D, or place it at true size in your room with your phone.' },
        { icon: 'hand', title: 'Personal assistance', text: 'Ask us anything on WhatsApp or by phone, before and after you buy.' },
        { icon: 'store', title: 'A showroom you can visit', text: 'Come and see, touch and sit on the pieces you liked online.' },
      ],
    },
    about: {
      title: 'A little about our store.',
      story: [
        'We believe choosing furniture should feel personal. At Kadam Works, we help customers discover pieces that suit their homes, their taste and their everyday needs.',
        'Visit our showroom to explore the collection and speak with our team.',
      ],
      owner: null,
      specialties: ['Living room', 'Dining', 'Bedroom', 'Study'],
      photo: { base: `${photos}/about`, alt: 'A furnished room with a sectional sofa, armchair and round table' },
      teamPhoto: null,
    },
    visit: { title: ['See it in person.', 'We’d love to welcome you.'] },
    footerBlurb: 'A furniture showroom in Belagavi. Explore the collection online in 3D, then come and see it in person.',
    social: [],
    placeholders: { photos: true, story: true, contact: true, highlights: true },
  },
];

export const showroomBySlug = (slug: string | undefined): Showroom | undefined =>
  SHOWROOMS.find((s) => s.brandSlug === slug);

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

/** `src` + `srcSet` for a two-width photo; `sizes` defaults to full viewport width. */
export const photoProps = (photo: Photo, sizes = '100vw') => ({
  src: asset(`${photo.base}-2000.jpg`),
  srcSet: `${asset(`${photo.base}-1000.jpg`)} 1000w, ${asset(`${photo.base}-2000.jpg`)} 2000w`,
  sizes,
  alt: photo.alt,
  // Lets dark mode tone photography down (index.css), so bright rooms don't glare off a dark page.
  'data-photo': true,
});

export const productImage = (showroom: Showroom, productSlug: string) => asset(`${showroom.collection.imageDir}/${productSlug}.webp`);

/** Section ids, shared by the header links and the sections they scroll to. */
export const SECTION = {
  top: 'top',
  showroom: 'showroom',
  collection: 'collection',
  featured: 'featured',
  about: 'about',
  visit: 'visit',
} as const;
