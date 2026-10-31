// Dependency-free GLB reader: validates the container and extracts facts
// (counts, generator, world-space bounding box in metres) for `model_asset.meta`.

const MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a; // "JSON"

export function readGlb(buf) {
  if (buf.length < 20 || buf.readUInt32LE(0) !== MAGIC) throw new Error('Not a binary glTF (missing "glTF" magic).');
  if (buf.readUInt32LE(4) !== 2) throw new Error('Unsupported GLB container version.');
  if (buf.readUInt32LE(8) !== buf.length) throw new Error('GLB header length does not match file size.');
  const jsonLen = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== CHUNK_JSON) throw new Error('First GLB chunk is not JSON.');
  return JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
}

// --- tiny column-major 4x4 matrix helpers ---------------------------------
export const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
export function nodeMatrix(n) {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale ?? [1, 1, 1];
  const [tx, ty, tz] = n.translation ?? [0, 0, 0];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}
const apply = (m, [x, y, z]) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

/** World-space axis-aligned bounds of the default scene, or null if unavailable. */
function boundsOf(gltf, roots = gltf.scenes?.[gltf.scene ?? 0]?.nodes) {
  const nodes = gltf.nodes ?? [];
  if (!roots) return null;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  const visit = (index, parent) => {
    const node = nodes[index];
    const world = mul(parent, nodeMatrix(node));
    if (node.mesh !== undefined) {
      for (const prim of gltf.meshes[node.mesh].primitives) {
        const acc = gltf.accessors[prim.attributes.POSITION];
        if (!acc?.min || !acc?.max) continue;
        for (let i = 0; i < 8; i++) {
          const p = apply(world, [i & 1 ? acc.max[0] : acc.min[0], i & 2 ? acc.max[1] : acc.min[1], i & 4 ? acc.max[2] : acc.min[2]]);
          for (let a = 0; a < 3; a++) {
            min[a] = Math.min(min[a], p[a]);
            max[a] = Math.max(max[a], p[a]);
          }
        }
      }
    }
    for (const child of node.children ?? []) visit(child, world);
  };
  for (const root of roots) visit(root, identity());
  if (!Number.isFinite(min[0])) return null;
  const round = (v) => Math.round(v * 1e4) / 1e4;
  return { min: min.map(round), max: max.map(round), size: max.map((v, i) => round(v - min[i])) };
}

/** Triangles across every primitive, and the bytes the embedded images take. */
function weightOf(g) {
  let triangles = 0;
  for (const mesh of g.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      // 4 = TRIANGLES, and the glTF default when `mode` is absent.
      if ((prim.mode ?? 4) !== 4) continue;
      const count = prim.indices !== undefined ? g.accessors[prim.indices]?.count : g.accessors[prim.attributes?.POSITION]?.count;
      triangles += Math.floor((count ?? 0) / 3);
    }
  }
  let texture_bytes = 0;
  for (const image of g.images ?? []) {
    if (image.bufferView !== undefined) texture_bytes += g.bufferViews[image.bufferView]?.byteLength ?? 0;
  }
  return { triangles, texture_bytes };
}

export function glbMeta(buf) {
  const g = readGlb(buf);
  return {
    gltf_version: g.asset?.version ?? null,
    generator: g.asset?.generator ?? null,
    nodes: g.nodes?.length ?? 0,
    meshes: g.meshes?.length ?? 0,
    materials: g.materials?.length ?? 0,
    textures: g.textures?.length ?? 0,
    images: g.images?.length ?? 0,
    animations: g.animations?.length ?? 0,
    extensions_used: g.extensionsUsed ?? [],
    bbox_m: boundsOf(g),
    bytes: buf.length,
    ...weightOf(g),
  };
}

// --- real size ----------------------------------------------------------------
//
// A product's listed size is the source of truth; model files arrive in metres,
// centimetres, millimetres or a tool's own units, sometimes side-on. `toRealSize`
// rewrites a GLB so it IS the product's size: one root node (named ROOT_NAME)
// turns, scales and centres the original scene, base on y = 0, footprint centred
// on the origin. Only that node is added: meshes, materials (so tint indices) and
// the asset's copyright/licence notice are left exactly as they were.

const ROOT_NAME = 'akruti-real-size';
const CHUNK_BIN = 0x004e4942; // "BIN\0"
const AXES = ['width', 'height', 'depth'];

/**
 * Bump when the normalisation maths changes, so stored assets can be told apart
 * from ones produced by an older pipeline and re-derived if needed.
 *
 *   1 — per-axis stretch to the listed size (withdrawn: distorted mismatched models)
 *   2 — single uniform factor; a model whose shape differs is reported, never stretched
 */
export const PIPELINE_VERSION = 2;

/** A model may differ from its listed size by this much per side and still count as that product. */
export const TOLERANCE = 0.05;

/** The JSON and BIN chunks of a GLB. */
function chunksOf(buf) {
  const gltf = readGlb(buf);
  const jsonLen = buf.readUInt32LE(12);
  const at = 20 + jsonLen;
  const bin = at + 8 <= buf.length && buf.readUInt32LE(at + 4) === CHUNK_BIN ? buf.subarray(at + 8, at + 8 + buf.readUInt32LE(at)) : null;
  return { gltf, bin };
}

function packGlb(gltf, bin) {
  let json = Buffer.from(JSON.stringify(gltf), 'utf8');
  if (json.length % 4) json = Buffer.concat([json, Buffer.alloc(4 - (json.length % 4), 0x20)]);
  const parts = [Buffer.alloc(12), Buffer.alloc(8), json];
  parts[1].writeUInt32LE(json.length, 0);
  parts[1].writeUInt32LE(CHUNK_JSON, 4);
  if (bin) {
    const header = Buffer.alloc(8);
    header.writeUInt32LE(bin.length, 0);
    header.writeUInt32LE(CHUNK_BIN, 4);
    parts.push(header, bin);
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  parts[0].writeUInt32LE(MAGIC, 0);
  parts[0].writeUInt32LE(2, 4);
  parts[0].writeUInt32LE(total, 8);
  return Buffer.concat(parts);
}

/** The scene's original roots, looking through a root this module added earlier (so re-running is safe). */
function authoredRoots(gltf) {
  const scene = gltf.scenes[gltf.scene ?? 0];
  const only = scene.nodes?.length === 1 ? gltf.nodes[scene.nodes[0]] : null;
  return only?.name === ROOT_NAME ? { roots: only.children ?? [], reuse: scene.nodes[0] } : { roots: scene.nodes ?? [], reuse: null };
}

/** The model's own size in its file's units (x width, y height, z depth), ignoring any real-size root. */
export function authoredSize(buf) {
  const { gltf } = chunksOf(buf);
  const b = boundsOf(gltf, authoredRoots(gltf).roots);
  return b && { width: b.size[0], height: b.size[1], depth: b.size[2] };
}

/** One factor taking `size` to `targetM`, and the worst side's disagreement with it (0.2 = 20%). */
function fitOf(size, targetM) {
  const ratios = AXES.filter((a) => targetM[a] && size[a] > 0).map((a) => targetM[a] / size[a]);
  if (!ratios.length) return null;
  const sorted = [...ratios].sort((p, q) => p - q);
  const mid = sorted.length >> 1;
  const factor = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { factor, deviation: Math.max(...ratios.map((r) => Math.abs(r / factor - 1))) };
}

/**
 * Rewrite a GLB so it stands at the product's real size. `targetMm` is
 * { width, depth, height } in millimetres; a missing side follows the model's
 * own proportions.
 *
 * A model authored side-on (width along z) is turned a quarter first. The scene
 * is then scaled by ONE uniform factor — the median of the per-side ratios — so
 * the model keeps its shape. A model whose proportions differ from the listed
 * product is NOT stretched to fit: it is drawn as close to the listing as its
 * shape allows and `deviation` reports the worst side's disagreement, for the
 * caller to flag or block. Stretching would hide a wrong model behind correct
 * numbers, which is the opposite of what the size check is for.
 *
 * The result is metres, Y-up (glTF's own convention, unchanged), base resting on
 * y = 0 and footprint centred on the origin.
 *
 * Re-running is safe: `authoredRoots` measures through a root added by an earlier
 * run, so the factor is always derived from the original geometry and never
 * compounds. Running twice yields byte-identical output.
 */
export function toRealSize(buf, targetMm) {
  const { gltf, bin } = chunksOf(buf);
  const { roots, reuse } = authoredRoots(gltf);
  const b = boundsOf(gltf, roots);
  if (!b) throw new Error('The model has no geometry to measure.');
  const size = { width: b.size[0], height: b.size[1], depth: b.size[2] };
  const target = Object.fromEntries(AXES.map((a) => [a, targetMm?.[a] ? targetMm[a] / 1000 : null]));

  const straight = fitOf(size, target);
  if (!straight) throw new Error('No target size given.');
  const turnedSize = { width: size.depth, height: size.height, depth: size.width };
  const turnedFit = fitOf(turnedSize, target);
  // A turn is only an option when it can be measured against the listing at all.
  const turn = Boolean(turnedFit) && turnedFit.deviation < straight.deviation;
  const fit = turn ? turnedFit : straight;
  const along = turn ? turnedSize : size;
  // One factor for every axis: the model keeps its shape.
  const k = fit.factor;

  // Bounds after the quarter turn (x' = z, z' = -x), then scale, then centre.
  const [min, max] = [b.min, b.max];
  const rMin = turn ? [min[2], min[1], -max[0]] : min;
  const rMax = turn ? [max[2], max[1], -min[0]] : max;
  const turnMatrix = turn ? [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1] : identity();
  const scaleMatrix = [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, 0, 0, 0, 1];
  const shift = identity();
  shift[12] = (-(rMin[0] + rMax[0]) / 2) * k;
  shift[13] = -rMin[1] * k;
  shift[14] = (-(rMin[2] + rMax[2]) / 2) * k;
  const matrix = mul(shift, mul(scaleMatrix, turnMatrix)).map((v) => (Math.abs(v) < 1e-12 ? 0 : v));

  const root = { name: ROOT_NAME, matrix, children: roots };
  gltf.nodes ??= [];
  const index = reuse ?? gltf.nodes.length;
  gltf.nodes[index] = root;
  gltf.scenes[gltf.scene ?? 0].nodes = [index];

  // What the model actually measures once drawn, and what was asked for.
  const drawnMm = Object.fromEntries(AXES.map((a) => [a, Math.round(along[a] * k * 10000) / 10]));
  const targetOut = Object.fromEntries(AXES.map((a) => [a, target[a] === null ? null : Math.round(target[a] * 10000) / 10]));
  const listed = AXES.some((a) => target[a] !== null);
  const status = !listed ? 'no-dimensions' : fit.deviation <= TOLERANCE ? 'verified' : 'approximate';

  // Deterministic stamp: no timestamps or source hashes, so re-running a
  // normalised file reproduces the same bytes and the "unchanged" check holds.
  gltf.asset ??= {};
  gltf.asset.extras ??= {};
  gltf.asset.extras.akruti = {
    normalized: true,
    pipelineVersion: PIPELINE_VERSION,
    factor: Math.round(k * 1e9) / 1e9,
    turned: turn,
    deviation: Math.round(fit.deviation * 1e6) / 1e6,
    status,
    targetMm: targetOut,
    drawnMm,
  };

  return {
    bytes: packGlb(gltf, bin),
    turned: turn,
    /** The single uniform factor applied to the authored geometry. */
    factor: k,
    /** Worst side's disagreement with the listing (0.2 = 20%); 0 when the shape matched. */
    deviation: fit.deviation,
    /** 'verified' | 'approximate' | 'no-dimensions' — see TOLERANCE. */
    status,
    /** What the model now measures, in millimetres. */
    sizeMm: drawnMm,
    /** What the catalogue listed, in millimetres (null per missing side). */
    targetMm: targetOut,
  };
}

/** The normalisation stamp a previous run left in the file, if any. */
export function normalizationOf(buf) {
  return chunksOf(buf).gltf.asset?.extras?.akruti ?? null;
}
