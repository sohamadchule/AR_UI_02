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
function boundsOf(gltf) {
  const nodes = gltf.nodes ?? [];
  const scene = gltf.scenes?.[gltf.scene ?? 0];
  if (!scene) return null;
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
  for (const root of scene.nodes ?? []) visit(root, identity());
  if (!Number.isFinite(min[0])) return null;
  const round = (v) => Math.round(v * 1e4) / 1e4;
  return { min: min.map(round), max: max.map(round), size: max.map((v, i) => round(v - min[i])) };
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
  };
}
