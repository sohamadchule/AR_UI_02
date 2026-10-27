/**
 * Colour maths for recolouring models.
 *
 * A model's recolourable material renders as `baseColorFactor × texture`. The server
 * measures each texture's average linear colour (`texAvg`), so to make the fabric
 * look like a target colour T on average we set `baseColorFactor = T / texAvg`.
 * Factors are capped at 1 (the glTF range), so a dark or strongly coloured texture
 * cannot reach every colour; `isAchievable` tells which ones it can.
 */

export type Rgb = [number, number, number];
export interface TintMaterial {
  /** glTF material index. */
  index: number;
  /** Average linear colour of its base colour texture ([1,1,1] when untextured). */
  texAvg: Rgb;
  /** Average linear colour it shows as authored. */
  base: Rgb;
  /** Its KHR_materials_sheen colour, or null when it has no sheen. */
  sheen: Rgb | null;
}
export interface PartColour {
  name: string;
  hex: string;
}
/**
 * A separately coloured part of a model ("Seat", "Frame"). The first part follows the
 * catalogue variant's colour; the others offer their own `colours`, the first of which
 * is the part's own colour as uploaded.
 */
export interface TintPart {
  name: string;
  /** glTF material indices drawn as this part. */
  materials: number[];
  colours: PartColour[];
}
export interface Tint {
  materials: TintMaterial[];
  /** Absent on single-part models: every material then changes together. */
  parts?: TintPart[];
}
/** Show some of a model's tint materials in this colour. */
export interface Recolor {
  hex: string;
  tint: Tint;
}
/** Colours chosen for the extra parts (index 1 onwards in `tintParts`), as hex by part index. */
export type PartPicks = Readonly<Record<number, string>>;

/** A model's recolourable parts, main part first. Models without parts are one part. */
export const tintParts = (tint: Tint): TintPart[] =>
  tint.parts?.length ? tint.parts : [{ name: 'Colour', materials: tint.materials.map((m) => m.index), colours: [] }];

/** The tint restricted to one part's materials. */
export const partTint = (tint: Tint, part: TintPart): Tint => ({ materials: tint.materials.filter((m) => part.materials.includes(m.index)) });

/**
 * The recolours a catalogue variant asks for: its colour on the main part, and on each
 * extra part the picked colour (or the part's own). Empty when it is shown as authored.
 */
export function recolorOf(v: { colorHex: string | null; model: { tint: Tint | null } }, picks: PartPicks = {}): Recolor[] {
  const tint = v.model.tint;
  if (!tint) return [];
  return tintParts(tint).flatMap((part, i) => {
    const hex = i === 0 ? v.colorHex : (picks[i] ?? part.colours[0]?.hex ?? null);
    return hex ? [{ hex, tint: partTint(tint, part) }] : [];
  });
}

/** Picks as a short URL value, e.g. "1-1E4FD8.2-C4581F"; only parts moved off their own colour. */
export function encodePicks(tint: Tint | null, picks: PartPicks): string {
  if (!tint) return '';
  return tintParts(tint)
    .flatMap((part, i) => (i > 0 && picks[i] && picks[i] !== part.colours[0]?.hex ? [`${i}-${picks[i].slice(1)}`] : []))
    .join('.');
}

/** The inverse of `encodePicks`, keeping only colours the part actually offers. */
export function decodePicks(tint: Tint | null, value: string | null): Record<number, string> {
  const out: Record<number, string> = {};
  if (!tint || !value) return out;
  const parts = tintParts(tint);
  for (const entry of value.split('.')) {
    const [i, hex] = [Number(entry.split('-')[0]), `#${entry.split('-')[1] ?? ''}`.toUpperCase()];
    if (i > 0 && parts[i]?.colours.some((c) => c.hex === hex)) out[i] = hex;
  }
  return out;
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

export function hexToLinear(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [toLinear(((n >> 16) & 255) / 255), toLinear(((n >> 8) & 255) / 255), toLinear((n & 255) / 255)];
}

export function linearToHex(rgb: Rgb): string {
  return `#${rgb
    .map((v) => Math.round(255 * toSrgb(clamp01(v))).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

/** CIE L*a*b* (D65) of an sRGB hex colour. */
function hexToLab(hex: string): Rgb {
  const [r, g, b] = hexToLinear(hex);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const RAD = Math.PI / 180;
const hueDeg = (b: number, a: number) => {
  const h = Math.atan2(b, a) / RAD;
  return h < 0 ? h + 360 : h;
};

/**
 * Perceptual distance (CIEDE2000 ΔE). ~2 is barely visible; above ~15 reads as a
 * different colour. Unlike plain Lab distance it doesn't overstate gaps between
 * saturated colours, so orange vs burnt orange counts as close.
 */
export function deltaE(hexA: string, hexB: string): number {
  const [L1, a1, b1] = hexToLab(hexA);
  const [L2, a2, b2] = hexToLab(hexB);
  const cMean = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const g = 0.5 * (1 - Math.sqrt(cMean ** 7 / (cMean ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + g);
  const a2p = a2 * (1 + g);
  const c1 = Math.hypot(a1p, b1);
  const c2 = Math.hypot(a2p, b2);
  const h1 = hueDeg(b1, a1p);
  const h2 = hueDeg(b2, a2p);

  let dh = 0;
  if (c1 * c2) {
    dh = h2 - h1;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dL = L2 - L1;
  const dC = c2 - c1;
  const dH = 2 * Math.sqrt(c1 * c2) * Math.sin((dh / 2) * RAD);

  const lMean = (L1 + L2) / 2;
  const cpMean = (c1 + c2) / 2;
  let hMean = h1 + h2;
  if (c1 * c2) hMean = Math.abs(h1 - h2) > 180 ? (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2 : (h1 + h2) / 2;
  const t =
    1 - 0.17 * Math.cos((hMean - 30) * RAD) + 0.24 * Math.cos(2 * hMean * RAD) +
    0.32 * Math.cos((3 * hMean + 6) * RAD) - 0.2 * Math.cos((4 * hMean - 63) * RAD);
  const sL = 1 + (0.015 * (lMean - 50) ** 2) / Math.sqrt(20 + (lMean - 50) ** 2);
  const sC = 1 + 0.045 * cpMean;
  const sH = 1 + 0.015 * cpMean * t;
  const rT = -2 * Math.sqrt(cpMean ** 7 / (cpMean ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hMean - 275) / 25) ** 2)) * RAD);
  return Math.sqrt((dL / sL) ** 2 + (dC / sC) ** 2 + (dH / sH) ** 2 + rT * (dC / sC) * (dH / sH));
}

/** The baseColorFactor (linear RGB) that makes a material with this texture average look like `hex`. */
export function tintFactor(hex: string, texAvg: Rgb): Rgb {
  const target = hexToLinear(hex);
  return target.map((t, c) => (texAvg[c] > 1e-4 ? clamp01(t / texAvg[c]) : 0)) as Rgb;
}

/** How far a recoloured velvet sheen is softened toward white, as authored sheens are. */
const SHEEN_SOFTEN = 0.3;

/**
 * The sheen colour for a recolour, or null when the material has no sheen.
 * Sheen takes the target's hue (softened), and scales its strength with the
 * target's brightness relative to the authored colour, so dark fabrics glow less.
 * The authored colour keeps its authored sheen exactly.
 */
export function sheenFactor(hex: string, m: TintMaterial): Rgb | null {
  if (!m.sheen) return null;
  const authored = linearToHex(m.base);
  if (hex.toUpperCase() === authored) return m.sheen;
  const target = hexToLinear(hex);
  const peak = Math.max(...target);
  if (peak <= 0) return [0, 0, 0];
  const basePeak = Math.max(...m.base);
  const strength = clamp01(Math.max(...m.sheen) * (basePeak > 1e-4 ? peak / basePeak : 1));
  return target.map((c) => (c / peak + (1 - c / peak) * SHEEN_SOFTEN) * strength) as Rgb;
}

/** What the material will actually look like (on average) when asked for `hex`. */
export function achievedHex(hex: string, texAvg: Rgb): string {
  const factor = tintFactor(hex, texAvg);
  return linearToHex(factor.map((f, c) => f * texAvg[c]) as Rgb);
}

/** True when every recoloured material can get visibly close to `hex`. */
export function isAchievable(hex: string, tint: Tint, tolerance = 5): boolean {
  return tint.materials.every((m) => deltaE(hex, achievedHex(hex, m.texAvg)) <= tolerance);
}

export interface NamedColour {
  name: string;
  hex: string;
}

export type PaletteGroup = 'Neutrals' | 'Greys & blacks' | 'Browns & leather' | 'Blues' | 'Greens' | 'Warm & accent';
export interface PaletteColour extends NamedColour {
  group: PaletteGroup;
}

/**
 * The upholstery colours furniture makers offer most, grouped the way fabric
 * catalogues present them; best sellers first within each group. Offered to the
 * uploader as one-click suggestions.
 */
export const FABRIC_PALETTE: readonly PaletteColour[] = [
  // Neutrals: the bulk of sofa and chair sales.
  { group: 'Neutrals', name: 'Off-White', hex: '#F1EEE6' },
  { group: 'Neutrals', name: 'Cream', hex: '#EDE3CC' },
  { group: 'Neutrals', name: 'Oatmeal', hex: '#D9CDB4' },
  { group: 'Neutrals', name: 'Beige', hex: '#CDB892' },
  { group: 'Neutrals', name: 'Greige', hex: '#B9B0A2' },
  { group: 'Neutrals', name: 'Taupe', hex: '#8E7F70' },
  // Greys & blacks
  { group: 'Greys & blacks', name: 'Light Grey', hex: '#C4C4C1' },
  { group: 'Greys & blacks', name: 'Dove Grey', hex: '#9C9C99' },
  { group: 'Greys & blacks', name: 'Slate Grey', hex: '#676E76' },
  { group: 'Greys & blacks', name: 'Charcoal', hex: '#3B3B3D' },
  { group: 'Greys & blacks', name: 'Black', hex: '#1C1C1C' },
  // Browns & leather tones
  { group: 'Browns & leather', name: 'Camel', hex: '#B98A55' },
  { group: 'Browns & leather', name: 'Cognac', hex: '#9A5B2E' },
  { group: 'Browns & leather', name: 'Chocolate', hex: '#4C3226' },
  { group: 'Browns & leather', name: 'Espresso', hex: '#2F2320' },
  // Blues
  { group: 'Blues', name: 'Navy', hex: '#1F2B4D' },
  { group: 'Blues', name: 'Ocean Blue', hex: '#2F5D8A' },
  { group: 'Blues', name: 'Dusty Blue', hex: '#7E97AE' },
  { group: 'Blues', name: 'Teal', hex: '#1E6B73' },
  // Greens
  { group: 'Greens', name: 'Sage Green', hex: '#7D9A78' },
  { group: 'Greens', name: 'Olive', hex: '#6B6E3F' },
  { group: 'Greens', name: 'Emerald', hex: '#1F6B55' },
  { group: 'Greens', name: 'Forest Green', hex: '#2E5636' },
  // Warm & accent colours
  { group: 'Warm & accent', name: 'Mustard', hex: '#C99A2E' },
  { group: 'Warm & accent', name: 'Terracotta', hex: '#B05A3E' },
  { group: 'Warm & accent', name: 'Rust', hex: '#9C3B26' },
  { group: 'Warm & accent', name: 'Burnt Orange', hex: '#C4581F' },
  { group: 'Warm & accent', name: 'Blush Pink', hex: '#D6A39C' },
  { group: 'Warm & accent', name: 'Dusty Rose', hex: '#B07A7E' },
  { group: 'Warm & accent', name: 'Burgundy', hex: '#6B1F2D' },
  { group: 'Warm & accent', name: 'Plum', hex: '#5C3552' },
];

/** Extra basic names, so any detected colour gets a sensible label. */
const BASIC_NAMES: readonly NamedColour[] = [
  { name: 'White', hex: '#F7F7F5' },
  { name: 'Red', hex: '#C62828' },
  { name: 'Orange', hex: '#E25A10' },
  { name: 'Yellow', hex: '#EDC232' },
  { name: 'Green', hex: '#3C8D40' },
  { name: 'Blue', hex: '#2459B8' },
  { name: 'Purple', hex: '#6A3D9A' },
  { name: 'Pink', hex: '#E07BA0' },
  { name: 'Brown', hex: '#6F4A2F' },
  { name: 'Grey', hex: '#8C8C8C' },
];

/** The closest human name for a colour, e.g. "#E23100" → "Orange". */
export function nameColour(hex: string): string {
  let best: NamedColour = FABRIC_PALETTE[0];
  let bestD = Infinity;
  for (const c of [...FABRIC_PALETTE, ...BASIC_NAMES]) {
    const d = deltaE(hex, c.hex);
    if (d < bestD) [best, bestD] = [c, d];
  }
  return best.name;
}

/** Below this distance a colour counts as "the same" as the model's own or an already-added one. */
export const SAME_COLOUR_DE = 15;

/**
 * Palette colours worth offering for this model: not the model's own colour,
 * not a near-duplicate of one already added, and reachable with its texture.
 */
export function suggestColours(baseHex: string, tint: Tint, taken: readonly string[]): PaletteColour[] {
  return FABRIC_PALETTE.filter(
    (c) =>
      deltaE(c.hex, baseHex) >= SAME_COLOUR_DE &&
      taken.every((t) => deltaE(c.hex, t) >= SAME_COLOUR_DE) &&
      isAchievable(c.hex, tint),
  );
}
