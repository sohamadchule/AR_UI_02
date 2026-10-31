/**
 * Floor-plan geometry for the AR room: where placed pieces stand, whether they
 * overlap, how much space is left between them, and whether they stay inside the
 * room's walls.
 *
 * Everything is in metres, in the room's own frame: y up from the floor, x and z
 * across it. A piece is reduced to its footprint (an oriented rectangle) plus the
 * height range it occupies. That is conservative for curved or L-shaped pieces,
 * so an overlap means "may overlap", never a guarantee either way.
 */

export type Point = [number, number];

export interface Footprint {
  /** Centre on the floor. */
  x: number;
  z: number;
  width: number;
  depth: number;
  /** Turn about the vertical axis, radians (three.js convention). */
  yaw: number;
  /** Height range occupied, above the floor. */
  bottom: number;
  top: number;
}

export interface LayoutPiece {
  id: string;
  footprint: Footprint;
  /** Pieces that normally stand close to others (coffee tables, lamps), so a smaller gap is fine. */
  companion: boolean;
}

export type PieceStatus = 'ok' | 'tight' | 'outside' | 'collision';

export interface PairGap {
  a: string;
  b: string;
  /** Clear floor distance between the two footprints; 0 when they overlap. */
  gap: number;
  /** The nearest points of each footprint, for drawing the gap. */
  from: Point;
  to: Point;
  collision: boolean;
  tight: boolean;
  /** The walking space this pair would need, for explaining a tight gap. */
  passage: number;
}

export interface LayoutReport {
  status: Record<string, PieceStatus>;
  pairs: PairGap[];
  /** Nearest wall distance per piece, when a room outline is known. */
  wallGap: Record<string, number>;
}

/** Footprints overlapping by less than this are only touching. */
const COLLISION_EPS = 0.01;
/** Height ranges must share more than this to be in each other's way (a lamp on a table only touches it). */
const VERTICAL_EPS = 0.02;
/** Gaps narrower than this are a deliberate arrangement (chairs pushed together), not a walkway. */
const DELIBERATE_GAP = 0.15;
/** Space to walk between two pieces, and between a piece and its companion (sofa to coffee table). */
export const WALKWAY = 0.6;
export const COMPANION_GAP = 0.35;

/** The four corners of a footprint, in order. */
export function corners(f: Footprint): Point[] {
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  const hw = f.width / 2;
  const hd = f.depth / 2;
  return ([[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]] as Point[]).map(([u, v]) => [f.x + u * c + v * s, f.z - u * s + v * c]);
}

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1];

/** How deep two convex polygons overlap (separating-axis test); zero or less when they don't. */
export function penetration(a: Point[], b: Point[]): number {
  let depth = Infinity;
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const edge = sub(poly[(i + 1) % poly.length], poly[i]);
      const axis: Point = [-edge[1], edge[0]];
      const len = Math.hypot(axis[0], axis[1]);
      if (len === 0) continue;
      const n: Point = [axis[0] / len, axis[1] / len];
      const pa = a.map((p) => dot(p, n));
      const pb = b.map((p) => dot(p, n));
      const overlap = Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
      if (overlap <= 0) return overlap;
      depth = Math.min(depth, overlap);
    }
  }
  return depth;
}

/** The point on segment ab nearest to p. */
function nearestOnSegment(p: Point, a: Point, b: Point): Point {
  const ab = sub(b, a);
  const len2 = dot(ab, ab);
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), ab) / len2));
  return [a[0] + ab[0] * t, a[1] + ab[1] * t];
}

/** Nearest points between two polygon outlines (zero distance when they overlap). */
export function nearest(a: Point[], b: Point[]): { distance: number; from: Point; to: Point } {
  let best = { distance: Infinity, from: a[0], to: b[0] };
  const consider = (from: Point, to: Point) => {
    const d = Math.hypot(from[0] - to[0], from[1] - to[1]);
    if (d < best.distance) best = { distance: d, from, to };
  };
  for (const p of a) for (let i = 0; i < b.length; i++) consider(p, nearestOnSegment(p, b[i], b[(i + 1) % b.length]));
  for (const p of b) for (let i = 0; i < a.length; i++) consider(nearestOnSegment(p, a[i], a[(i + 1) % a.length]), p);
  return best;
}

/** Whether p lies inside the polygon (even-odd rule). */
export function inside(p: Point, poly: Point[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

/** Shortest distance from a footprint to the room's walls. */
function wallDistance(piece: Point[], room: Point[]): number {
  return nearest(piece, room).distance;
}

/**
 * Check a whole arrangement. Overlap counts only where height ranges also meet
 * (a wall-mounted TV over a cabinet is fine). A gap between DELIBERATE_GAP and
 * the walking space the pair needs is flagged as tight, not as an error.
 */
export function evaluateLayout(pieces: LayoutPiece[], room: Point[] | null): LayoutReport {
  const status: Record<string, PieceStatus> = {};
  const rank: Record<PieceStatus, number> = { ok: 0, tight: 1, outside: 2, collision: 3 };
  const raise = (id: string, s: PieceStatus) => {
    if (rank[s] > rank[status[id] ?? 'ok']) status[id] = s;
  };
  const outlines = new Map(pieces.map((p) => [p.id, corners(p.footprint)]));
  for (const p of pieces) status[p.id] = 'ok';

  const pairs: PairGap[] = [];
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i];
      const b = pieces[j];
      const pa = outlines.get(a.id)!;
      const pb = outlines.get(b.id)!;
      const shareHeight =
        Math.min(a.footprint.top, b.footprint.top) - Math.max(a.footprint.bottom, b.footprint.bottom) > VERTICAL_EPS;
      const depth = penetration(pa, pb);
      const near = depth > 0 ? { distance: 0, from: pa[0], to: pa[0] } : nearest(pa, pb);
      const passage = a.companion || b.companion ? COMPANION_GAP : WALKWAY;
      const collision = shareHeight && depth > COLLISION_EPS;
      const tight = shareHeight && !collision && near.distance > DELIBERATE_GAP && near.distance < passage;
      pairs.push({ a: a.id, b: b.id, gap: near.distance, from: near.from, to: near.to, collision, tight, passage });
      if (collision) {
        raise(a.id, 'collision');
        raise(b.id, 'collision');
      } else if (tight) {
        raise(a.id, 'tight');
        raise(b.id, 'tight');
      }
    }
  }

  const wallGap: Record<string, number> = {};
  if (room && room.length >= 3) {
    for (const p of pieces) {
      const outline = outlines.get(p.id)!;
      const out = outline.some((c) => !inside(c, room)) || room.some((c) => inside(c, outline));
      wallGap[p.id] = out ? 0 : wallDistance(outline, room);
      if (out) raise(p.id, 'outside');
    }
  }
  return { status, pairs, wallGap };
}

export interface RoomInfo {
  /** Length of each wall, in order. */
  walls: number[];
  area: number;
  /** Extent along the first wall, and across it. */
  width: number;
  depth: number;
}

/** Measurements of a room outline. */
export function describeRoom(poly: Point[]): RoomInfo {
  const walls = poly.map((p, i) => Math.hypot(...sub(poly[(i + 1) % poly.length], p)));
  let twice = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    twice += x1 * z2 - x2 * z1;
  }
  const along = sub(poly[1], poly[0]);
  const len = Math.hypot(...along) || 1;
  const u: Point = [along[0] / len, along[1] / len];
  const v: Point = [-u[1], u[0]];
  const spread = (axis: Point) => {
    const d = poly.map((p) => dot(p, axis));
    return Math.max(...d) - Math.min(...d);
  };
  return { walls, area: Math.abs(twice) / 2, width: spread(u), depth: spread(v) };
}

/**
 * A rectangular room from one corner, a point along one wall, its two sizes, and
 * a point known to be inside it (where the customer is standing).
 */
export function rectangleRoom(corner: Point, along: Point, width: number, depth: number, within: Point): Point[] {
  const d = sub(along, corner);
  const len = Math.hypot(...d) || 1;
  const u: Point = [d[0] / len, d[1] / len];
  let v: Point = [-u[1], u[0]];
  if (dot(sub(within, corner), v) < 0) v = [-v[0], -v[1]];
  const at = (a: number, b: number): Point => [corner[0] + u[0] * a + v[0] * b, corner[1] + u[1] * a + v[1] * b];
  return [at(0, 0), at(width, 0), at(width, depth), at(0, depth)];
}
