/**
 * The brand kit: everything that differs between one client storefront and the next.
 *
 * Colour, type and corner radius live in CSS, as a `[data-brand="<slug>"]` block in
 * src/styles/index.css that redefines the same semantic tokens the rest of the app
 * uses (--surface, --fg, --line, …). StoreLayout sets that attribute, so every
 * Tailwind utility inside the store re-skins without a single conditional class.
 *
 * This file holds the rest: the words. Onboarding a client means adding one entry
 * here, one CSS block, and their catalogue rows — nothing else.
 */

export interface Brand {
  slug: string;
  /** Wordmark, split so the second half can take the accent colour. */
  mark: [string, string];
  /** Legal name for the footer. */
  legalName: string;
  city: string;
  hero: {
    eyebrow: string;
    /** `<em>` is rendered as the accent-coloured emphasis. */
    title: string;
    titleEm: string;
    titleAfter: string;
    lede: string;
  };
  /** Catalogue heading above the product grid. */
  catalogue: { eyebrow: string; title: string };
  /** Delivery promise shown on the product page. */
  deliveryNote: string;
  returnsDays: number;
  /** The shop's story, for the About page. */
  about: {
    since: number;
    story: string[];
    /** Short facts shown as large figures: [value, label]. */
    facts: [string, string][];
  };
  /**
   * How to reach the shop. The numbers are demo placeholders: replace them with
   * the client's real ones when onboarding.
   */
  contact: {
    phone: string;
    /** International format, digits only, for wa.me links. */
    whatsapp: string;
    email: string;
    address: string[];
    /** What the embedded map searches for. */
    mapQuery: string;
    hours: string[];
  };
  /** How the walk-in entrance draws the shop front. Defaults to a high-street shop. */
  facade?: 'shop' | 'haveli';
  /** The fuller, story-led home page. Shops without it get the catalogue home. */
  flagship?: Flagship;
}

export interface Flagship {
  /** Product slug shown live in "place it in your room". */
  featured: string;
  /** Product slugs in the order the collection shows them; anything else stays off the home page. */
  collection: string[];
  /** Variants left out of the collection and the live stage, by product slug → variant names. */
  hiddenFinishes?: Record<string, string[]>;
  /** How a piece gets from the catalogue to the buyer's home: [title, detail, how long]. */
  process: [string, string, string][];
  /** What the pieces are made of. `swatch` is a CSS background drawn as the sample. */
  materials: { name: string; note: string; swatch: string }[];
}

export const BRANDS: readonly Brand[] = [
  {
    slug: 'nivaas',
    mark: ['Nivaas', 'Living'],
    legalName: 'Nivaas Living',
    city: 'Pune',
    hero: {
      eyebrow: 'New · Monsoon collection',
      title: 'Sit with it ',
      titleEm: 'before',
      titleAfter: ' you buy it.',
      lede: 'Every piece in the catalogue is a real 3D model. Scan it into your own room, check it against your wall, then decide.',
    },
    catalogue: { eyebrow: 'The catalogue', title: 'Every piece, scannable' },
    deliveryNote: 'Free delivery and assembly',
    returnsDays: 10,
    about: {
      since: 2009,
      story: [
        'Nivaas started as a single room of sofas on a Koregaon Park lane. It is still a family shop: the people who pick the fabrics are the people who answer the phone.',
        'Every piece on the floor is also in the catalogue as a real 3D model, so you can walk the showroom, then check the same piece against your own wall at home before deciding.',
      ],
      facts: [
        ['15+', 'years on the same lane'],
        ['4,000', 'homes furnished in Pune'],
        ['10 days', 'no-questions returns'],
      ],
    },
    contact: {
      phone: '+91 98765 43210',
      whatsapp: '919876543210',
      email: 'hello@nivaas.example',
      address: ['Lane 6, Koregaon Park', 'Pune, Maharashtra 411001'],
      mapQuery: 'Koregaon Park, Pune',
      hours: ['Mon–Sat · 10:30 am – 8:30 pm', 'Sunday · 11 am – 7 pm'],
    },
  },
  {
    slug: 'saaj',
    mark: ['Saaj', '& Co.'],
    legalName: 'Saaj & Co.',
    city: 'Jaipur',
    hero: {
      eyebrow: 'Jaipur atelier · made to order',
      title: 'Measured twice. ',
      titleEm: 'Delivered once.',
      titleAfter: '',
      lede: 'Every Saaj piece is built after you order it. So before the saw touches wood, you place it in your own room, at its true size.',
    },
    catalogue: { eyebrow: 'The collection', title: 'Made to order, sized to you' },
    deliveryNote: 'Made to order · 3–4 weeks',
    returnsDays: 7,
    about: {
      since: 1987,
      story: [
        'Saaj is a Jaipur atelier: three generations of carpenters and upholsterers working a few streets from MI Road. Nothing is made until it is ordered.',
        'Because every piece is built to order, we show it to you in 3D and in your room first. You approve the size and the finish; then the saw touches wood.',
      ],
      facts: [
        ['3', 'generations of makers'],
        ['3–4 wks', 'from order to doorstep'],
        ['100%', 'made to order'],
      ],
    },
    contact: {
      phone: '+91 98765 43211',
      whatsapp: '919876543211',
      email: 'atelier@saaj.example',
      address: ['MI Road', 'Jaipur, Rajasthan 302001'],
      mapQuery: 'MI Road, Jaipur',
      hours: ['Mon–Sat · 11 am – 8 pm', 'Sunday · by appointment'],
    },
    facade: 'haveli',
    // Demo content: the figures are illustrative until a real client's replace them. Reviews live in the database (store_review).
    flagship: {
      featured: 'mahal-3-seater-sofa',
      collection: [
        'mahal-3-seater-sofa',
        'upholstered-dining-chair',
        'ira-lounge-chair',
        'sabha-dining-table',
        'alcove-wardrobe',
        'perch-bar-stool',
        'nook-side-table',
        'kaam-writing-desk',
        'halo-floor-lamp',
        'table-lamp',
      ],
      hiddenFinishes: { 'ira-lounge-chair': ['Ochre'] },
      process: [
        ['Choose a piece', 'Pick the design, the wood and the fabric — online or on our floor.', 'Today'],
        ['Place it at home', 'See it in your room at its true size. Change the finish until it is right.', '5 minutes'],
        ['Made by hand in Jaipur', 'Cut, joined, upholstered and polished in our workshop near MI Road.', '3–4 weeks'],
        ['Delivered and set up', 'Blanket-wrapped, carried in and assembled where you placed it.', 'One visit'],
      ],
      materials: [
        {
          name: 'Sheesham',
          note: 'Indian rosewood. Dense, dark-grained, and it darkens with the years.',
          swatch: 'repeating-linear-gradient(100deg, #5b3720 0 6px, #6e4428 6px 9px, #4e2e1a 9px 15px, #7a4d2e 15px 17px)',
        },
        {
          name: 'Mango wood',
          note: 'Lighter and warmer, with soft streaks. Takes a hand-rubbed oil finish.',
          swatch: 'repeating-linear-gradient(95deg, #b98a5a 0 8px, #c99c6b 8px 11px, #a97b4d 11px 18px, #d2a877 18px 20px)',
        },
        {
          name: 'Hand-block cotton',
          note: 'Printed by hand in Bagru and Sanganer, a few kilometres from the workshop.',
          swatch:
            'radial-gradient(circle at 50% 50%, #8e2b35 0 22%, transparent 24%) 0 0 / 22px 22px, radial-gradient(circle at 50% 50%, #c98f5a 0 12%, transparent 14%) 11px 11px / 22px 22px, #f1e6d6',
        },
        {
          name: 'Cane',
          note: 'Woven by hand into backs and doors; light, cool and repairable.',
          swatch:
            'repeating-linear-gradient(45deg, #c8a46a 0 3px, transparent 3px 9px), repeating-linear-gradient(-45deg, #c8a46a 0 3px, transparent 3px 9px), #8a6a3c',
        },
      ],
    },
  },
  {
    slug: 'kadam',
    mark: ['Kadam', 'Works'],
    legalName: 'Kadam Works',
    city: 'Belagavi',
    hero: {
      eyebrow: 'Built in Belagavi · 10-year frame warranty',
      title: 'Honest frames. ',
      titleEm: 'Exact sizes.',
      titleAfter: '',
      lede: 'Solid sheesham, steel fixings, no veneer. Every listing carries the true carcass size — check it against your doorway first.',
    },
    catalogue: { eyebrow: 'The workshop', title: 'Nine pieces, built to last' },
    deliveryNote: 'Free delivery · flat-packed',
    returnsDays: 14,
    about: {
      since: 2014,
      story: [
        'Kadam Works is a workshop and showroom in one, in the Udyambag industrial area. You can see the frames being cut through the glass at the back of the shop.',
        'We build in solid sheesham with steel fixings, and list the true carcass size of every piece. Check it in AR against your doorway before you visit.',
      ],
      facts: [
        ['10 yr', 'frame warranty'],
        ['9', 'pieces, all made here'],
        ['14 days', 'free returns'],
      ],
    },
    contact: {
      phone: '+91 98765 43212',
      whatsapp: '919876543212',
      email: 'workshop@kadam.example',
      address: ['Udyambag Industrial Area', 'Belagavi, Karnataka 590008'],
      mapQuery: 'Udyambag, Belagavi',
      hours: ['Mon–Sat · 9:30 am – 7 pm', 'Sunday · closed'],
    },
  },
];

export const DEFAULT_BRAND = BRANDS[0];

export const brandBySlug = (slug: string | undefined): Brand | undefined =>
  BRANDS.find((b) => b.slug === slug);

/** Route helpers, so the store's URL shape lives in one place. */
export const storePath = (brand: string) => `/store/${brand}`;
export const storeProductPath = (brand: string, productSlug: string) => `/store/${brand}/p/${productSlug}`;
export const storeExperiencePath = (brand: string) => `/store/${brand}/experience`;
/** The Craft page; `product` opens it on that piece. */
export const storeCraftPath = (brand: string, product?: string) => `/store/${brand}/craft${product ? `?p=${product}` : ''}`;
export const storeAboutPath = (brand: string) => `/store/${brand}/about`;
export const storeContactPath = (brand: string) => `/store/${brand}/about#contact`;

/** A WhatsApp chat with the shop, optionally with the first message typed in. */
export const whatsappLink = (brand: Brand, message?: string) =>
  `https://wa.me/${brand.contact.whatsapp}${message ? `?text=${encodeURIComponent(message)}` : ''}`;

/** A tel: link; the display number keeps its spaces, the link does not. */
export const telLink = (brand: Brand) => `tel:${brand.contact.phone.replace(/\s/g, '')}`;
