// Material colour analysis for recolourable models.
//
// A glTF base colour is `baseColorFactor × baseColorTexture` (texture decoded from
// sRGB to linear). For each material the scene actually renders we report:
//   * texAvg     average linear colour of its base colour texture ([1,1,1] if none)
//   * factor     its baseColorFactor (linear RGB)
//   * base       the colour a viewer perceives on average: factor × texAvg (linear)
//   * hex        that colour as sRGB hex
//   * sheen      its KHR_materials_sheen colour, or null. Velvet sheen is tinted to
//                match the fabric, so a recolour has to move it too
//   * glows      true when the material is emissive (a light): its glow hides the
//                base colour, so recolouring it barely shows
//   * share      fraction of the model's surface drawn with it (0–1), and
//   * parts      the parts drawn with it, [{ node, name, share }], biggest first:
//                together with share they tell "body" from "handles" when
//                material names are meaningless ("lambert3SG")
//   * patterned  true when the texture carries its own colour cast (e.g. a red
//                damask), which tinting cannot fully override
//
// Recolouring to a target T then sets factor = T / texAvg (clamped to 1), so the
// average perceived colour becomes T while the texture keeps its weave and shading.
import { createRequire } from 'node:module';
import { identity, mul, nodeMatrix, readGlb } from './glb.mjs';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const jpeg = require('jpeg-js');

const CHUNK_BIN = 0x004e4942; // "BIN\0"
const SAMPLE_BUDGET = 262_144; // pixels averaged per texture; plenty for a mean

/** Material names that usually mean "upholstery": pre-selected as recolourable. */
const FABRIC_NAME = /fabric|upholst|cushion|velvet|linen|leather|textile|cloth|seat|boucle|wool/i;
/** Colour cast of a texture's average, (max − min) / max, above which it counts as coloured. */
const COLOURED_CAST = 0.2;

const SRGB_TO_LINEAR = Float64Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});
const linearToSrgb8 = (v) => {
  const c = Math.min(1, Math.max(0, v));
  return Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055));
};
export const linearToHex = (rgb) => `#${rgb.map((v) => linearToSrgb8(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const round = (v) => Math.round(v * 1e5) / 1e5;

/** The BIN chunk of a GLB, or null when the file has none. */
function binChunk(buf) {
  const jsonLen = buf.readUInt32LE(12);
  const at = 20 + jsonLen;
  if (buf.length < at + 8 || buf.readUInt32LE(at + 4) !== CHUNK_BIN) return null;
  return buf.subarray(at + 8, at + 8 + buf.readUInt32LE(at));
}

function decodeImage(gltf, bin, imageIndex) {
  const image = gltf.images?.[imageIndex];
  if (!image || image.bufferView === undefined || !bin) return null; // external URIs are not supported in a GLB upload
  const view = gltf.bufferViews[image.bufferView];
  const bytes = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  const isPng = image.mimeType === 'image/png' || bytes.readUInt32BE(0) === 0x89504e47;
  const isJpeg = image.mimeType === 'image/jpeg' || (bytes[0] === 0xff && bytes[1] === 0xd8);
  if (isPng) return PNG.sync.read(bytes);
  if (isJpeg) return jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 });
  return null; // WebP / KTX2 etc.: treated as untextured
}

/** Average linear colour of an RGBA image. */
function textureStats({ width, height, data }) {
  const total = width * height;
  const step = Math.max(1, Math.floor(total / SAMPLE_BUDGET));
  const sum = [0, 0, 0];
  let n = 0;
  for (let p = 0; p < total; p += step) {
    const i = p * 4;
    sum[0] += SRGB_TO_LINEAR[data[i]];
    sum[1] += SRGB_TO_LINEAR[data[i + 1]];
    sum[2] += SRGB_TO_LINEAR[data[i + 2]];
    n++;
  }
  return sum.map((v) => v / n);
}

const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const READERS = {
  5121: [1, 'readUInt8'],
  5123: [2, 'readUInt16LE'],
  5125: [4, 'readUInt32LE'],
  5126: [4, 'readFloatLE'],
};

/** Accessor element `i` as an array of numbers, or null for data we can't read (sparse, external, compressed). */
function accessorReader(gltf, bin, index) {
  const acc = gltf.accessors?.[index];
  if (!acc || acc.sparse || acc.bufferView === undefined || !bin) return null;
  const view = gltf.bufferViews[acc.bufferView];
  if ((view.buffer ?? 0) !== 0) return null;
  const [size, method] = READERS[acc.componentType] ?? [];
  const n = COMPONENTS[acc.type];
  if (!size || !n) return null;
  const stride = view.byteStride ?? size * n;
  const base = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  if (base + stride * (acc.count - 1) + size * n > bin.length) return null;
  return { count: acc.count, get: (i) => Array.from({ length: n }, (_, c) => bin[method](base + i * stride + c * size)) };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const transform = (m, [x, y, z]) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

/**
 * World-space surface area per material, plus the names of the parts (nodes or
 * meshes) drawn with it. Area tells "main body" (big) from "handles" (small)
 * when the author's material names say nothing, e.g. "lambert3SG".
 */
function surfaceByMaterial(gltf, bin) {
  const out = new Map();
  const nodes = gltf.nodes ?? [];
  const visit = (index, parent) => {
    const node = nodes[index];
    const world = mul(parent, nodeMatrix(node));
    const mesh = node.mesh !== undefined ? gltf.meshes?.[node.mesh] : null;
    for (const prim of mesh?.primitives ?? []) {
      if (prim.material === undefined || (prim.mode ?? 4) !== 4) continue; // triangles only
      const entry = out.get(prim.material) ?? { area: 0, parts: new Map() };
      out.set(prim.material, entry);
      const part = entry.parts.get(index) ?? { node: index, name: node.name || mesh.name || `Part ${index}`, area: 0 };
      entry.parts.set(index, part);
      const pos = accessorReader(gltf, bin, prim.attributes.POSITION);
      if (!pos) continue;
      const idx = prim.indices !== undefined ? accessorReader(gltf, bin, prim.indices) : null;
      if (prim.indices !== undefined && !idx) continue;
      const count = idx ? idx.count : pos.count;
      const vertex = (k) => transform(world, pos.get(idx ? idx.get(k)[0] : k));
      for (let k = 0; k + 2 < count; k += 3) {
        const a = vertex(k);
        const area = Math.hypot(...cross(sub(vertex(k + 1), a), sub(vertex(k + 2), a))) / 2;
        entry.area += area;
        part.area += area;
      }
    }
    for (const child of node.children ?? []) visit(child, world);
  };
  const scene = gltf.scenes?.[gltf.scene ?? 0];
  for (const root of scene?.nodes ?? []) visit(root, identity());
  return out;
}

/** Indices of materials referenced by the scene's mesh primitives, in first-seen order. */
function renderedMaterials(gltf) {
  const used = new Set();
  for (const mesh of gltf.meshes ?? []) for (const prim of mesh.primitives) if (prim.material !== undefined) used.add(prim.material);
  return [...used];
}

/**
 * Analyse every rendered material of a GLB.
 * Returns [{ index, name, factor, texAvg, base, hex, sheen, glows, textured, patterned, share, parts,
 * suggested, largest }], largest surface first.
 */
export function analyzeMaterials(buf) {
  const gltf = readGlb(buf);
  const bin = binChunk(buf);
  const avgByTexture = new Map();
  const surfaces = surfaceByMaterial(gltf, bin);
  const totalArea = [...surfaces.values()].reduce((sum, s) => sum + s.area, 0);

  const materials = renderedMaterials(gltf).map((index) => {
    const material = gltf.materials?.[index] ?? {};
    const pbr = material.pbrMetallicRoughness ?? {};
    const factor = (pbr.baseColorFactor ?? [1, 1, 1, 1]).slice(0, 3);
    let texAvg = null;
    const texIndex = pbr.baseColorTexture?.index;
    if (texIndex !== undefined) {
      if (!avgByTexture.has(texIndex)) {
        let avg = null;
        try {
          const img = decodeImage(gltf, bin, gltf.textures?.[texIndex]?.source);
          if (img) avg = textureStats(img);
        } catch {
          avg = null; // undecodable texture: fall back to factor-only colour
        }
        avgByTexture.set(texIndex, avg);
      }
      texAvg = avgByTexture.get(texIndex);
    }
    const textured = Boolean(texAvg);
    texAvg ??= [1, 1, 1];
    const brightest = Math.max(...texAvg);
    const name = material.name?.trim() || `Material ${index}`;
    const base = factor.map((f, c) => f * texAvg[c]);
    const sheen = material.extensions?.KHR_materials_sheen;
    return {
      index,
      name,
      factor: factor.map(round),
      texAvg: texAvg.map(round),
      base: base.map(round),
      hex: linearToHex(base),
      sheen: sheen ? (sheen.sheenColorFactor ?? [0, 0, 0]).map(round) : null,
      glows: Boolean(material.emissiveTexture) || (material.emissiveFactor ?? [0, 0, 0]).some((v) => v > 0.05),
      textured,
      patterned: brightest > 0 && (brightest - Math.min(...texAvg)) / brightest > COLOURED_CAST,
      share: totalArea > 0 ? Math.round(((surfaces.get(index)?.area ?? 0) / totalArea) * 1000) / 1000 : null,
      parts: [...(surfaces.get(index)?.parts.values() ?? [])]
        .sort((a, b) => b.area - a.area)
        .slice(0, 200)
        .map((part) => ({ node: part.node, name: part.name, share: totalArea > 0 ? Math.round((part.area / totalArea) * 1000) / 1000 : null })),
      suggested: FABRIC_NAME.test(name),
      largest: false,
    };
  });

  // Biggest surface first: on furniture that is the body, and handles / feet / trims trail.
  materials.sort((a, b) => (b.share ?? 0) - (a.share ?? 0));
  const main = materials[0];
  if (main && main.share !== null && materials.length > 1) {
    main.largest = true;
    // No upholstery-like name to go by: pre-select the main body instead.
    if (!materials.some((m) => m.suggested) && !main.glows) main.suggested = true;
  }
  return materials;
}

/**
 * The `model_asset.tint` value for the chosen material indices, or null for none.
 * Throws when an index is not a rendered material of this model.
 */
export function buildTint(materials, indices) {
  if (!indices?.length) return null;
  const byIndex = new Map(materials.map((m) => [m.index, m]));
  const chosen = [...new Set(indices)].map((i) => {
    const m = byIndex.get(i);
    if (!m) throw new Error(`Material ${i} is not part of this model.`);
    return { index: m.index, name: m.name, texAvg: m.texAvg, base: m.base, sheen: m.sheen };
  });
  return { materials: chosen, baseHex: byIndex.get(chosen[0].index).hex };
}
