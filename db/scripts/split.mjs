// "Split by part": give some parts of a model their own copy of a material, so
// they can be recoloured on their own (e.g. a desk's legs vs. its top when the
// author painted both with "02___Default").
//
// Only the GLB's JSON chunk changes: a material is duplicated and the chosen
// parts' primitives point at the copy. The binary chunk (geometry, textures) is
// copied byte for byte, so the result looks identical until it is recoloured.
import { readGlb } from './glb.mjs';

const MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a; // "JSON"
const MAX_GROUPS = 16;

/** A GLB with `gltf` as its JSON chunk and every other chunk of `original` unchanged. */
function writeGlb(original, gltf) {
  const oldJsonLen = original.readUInt32LE(12);
  const rest = original.subarray(20 + oldJsonLen); // BIN (and any other) chunks, as they were
  let json = Buffer.from(JSON.stringify(gltf), 'utf8');
  const pad = (4 - (json.length % 4)) % 4;
  json = Buffer.concat([json, Buffer.alloc(pad, 0x20)]); // the spec pads JSON with spaces
  const header = Buffer.alloc(20);
  header.writeUInt32LE(MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + json.length + rest.length, 8);
  header.writeUInt32LE(json.length, 12);
  header.writeUInt32LE(CHUNK_JSON, 16);
  return Buffer.concat([header, json, rest]);
}

/**
 * Split parts off their materials.
 *   groups: [{ material: <glTF material index>, nodes: [<node index>, …], name?: string }]
 * Each group gets a new material (a copy of `material`, called `name`) used by
 * exactly those nodes' primitives that were drawn with `material`.
 * Returns { glb, created: [{ index, name, from }] }. Throws on invalid input.
 */
export function splitParts(buf, groups) {
  if (!Array.isArray(groups) || !groups.length) throw new Error('Choose at least one part to split.');
  if (groups.length > MAX_GROUPS) throw new Error(`At most ${MAX_GROUPS} splits at once.`);
  const gltf = readGlb(buf);
  const materials = gltf.materials ?? [];
  const nodes = gltf.nodes ?? [];
  const meshes = gltf.meshes ?? [];

  // How many nodes draw each mesh: a mesh shared with nodes outside a group must be copied first.
  const meshUsers = new Map();
  nodes.forEach((n, i) => {
    if (n.mesh !== undefined) meshUsers.set(n.mesh, [...(meshUsers.get(n.mesh) ?? []), i]);
  });

  const created = [];
  for (const group of groups) {
    const from = group?.material;
    if (!Number.isInteger(from) || !materials[from]) throw new Error(`Material ${from} is not part of this model.`);
    const chosen = [...new Set(group.nodes ?? [])];
    if (!chosen.length) throw new Error('Choose at least one part to split.');
    for (const i of chosen) {
      const mesh = nodes[i]?.mesh !== undefined ? meshes[nodes[i].mesh] : null;
      if (!Number.isInteger(i) || !mesh?.primitives.some((p) => p.material === from)) {
        throw new Error(`Part ${i} does not use material ${from}.`);
      }
    }

    const name = (typeof group.name === 'string' && group.name.trim().slice(0, 60)) || `${materials[from].name ?? 'Material'} (part)`;
    const index = materials.length;
    materials.push({ ...structuredClone(materials[from]), name });

    for (const i of chosen) {
      const node = nodes[i];
      const users = meshUsers.get(node.mesh) ?? [];
      if (users.some((u) => !chosen.includes(u))) {
        // Shared with a node we are not splitting: give this node its own copy of the mesh.
        meshes.push(structuredClone(meshes[node.mesh]));
        meshUsers.set(node.mesh, users.filter((u) => u !== i));
        node.mesh = meshes.length - 1;
        meshUsers.set(node.mesh, [i]);
      }
      for (const prim of meshes[node.mesh].primitives) if (prim.material === from) prim.material = index;
    }
    created.push({ index, name, from });
  }

  gltf.materials = materials;
  gltf.meshes = meshes;
  return { glb: writeGlb(buf, gltf), created };
}
