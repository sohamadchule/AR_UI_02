/**
 * Transform-level tests for placing and resizing a piece.
 *
 * The pure maths is covered in src/lib/resize.test.ts. This file covers the part
 * that is NOT pure: what the three.js group transform actually does to a model
 * once it is scaled. Two bugs got past review because that layer was argued in
 * comments instead of being executed —
 *
 *   - a resized wall piece sank into its wall and climbed it;
 *   - floor grounding was asserted but never measured.
 *
 * Both are pinned here. This reproduces roomEngine's own transform chain rather
 * than importing RoomEngine, which needs a live XRSession and a WebGL context.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { clampScale, sizeAt, type Size3 } from '@/lib/resize';

/**
 * A placed piece, built exactly as makeProduct/finishItem/place do:
 * footprint centred on the group origin, base resting on local y = 0.
 */
function piece(size: Size3) {
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  const model = new THREE.Mesh(new THREE.BoxGeometry(size.width, size.height, size.depth));
  model.position.set(0, size.height / 2, 0);
  group.add(model);
  return { group, model, baseSize: { ...size }, size: { ...size }, userScale: 1, wall: null as null | { point: THREE.Vector3; normal: THREE.Vector3 } };
}

/** place(), floor or tabletop branch. */
function placeOnFloor(p: ReturnType<typeof piece>, at: THREE.Vector3, yaw = 0) {
  p.group.position.set(at.x, at.y, at.z);
  p.group.rotation.y = yaw;
  p.wall = null;
  p.group.updateMatrix();
}

/** place(), wall branch. */
function placeOnWall(p: ReturnType<typeof piece>, point: THREE.Vector3, normal: THREE.Vector3) {
  const out = new THREE.Vector3(normal.x, 0, normal.z).normalize();
  p.group.rotation.y = Math.atan2(out.x, out.z);
  p.group.position.copy(point).addScaledVector(out, p.size.depth / 2);
  p.group.position.y = Math.max(0, point.y - p.size.height / 2);
  p.wall = { point: point.clone(), normal: out };
  p.group.updateMatrix();
}

/** applyScale(), including the wall reseat. */
function applyScale(p: ReturnType<typeof piece>, scale: number) {
  const next = clampScale(scale);
  p.userScale = next;
  p.size = sizeAt(p.baseSize, next);
  p.group.scale.setScalar(next);
  if (p.wall) {
    p.group.position.copy(p.wall.point).addScaledVector(p.wall.normal, p.size.depth / 2);
    p.group.position.y = Math.max(0, p.wall.point.y - p.size.height / 2);
  }
  p.group.updateMatrix();
}

const worldBox = (p: ReturnType<typeof piece>) => {
  p.group.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(p.model);
};

/**
 * Tolerance for anything measured off geometry.
 *
 * BoxGeometry stores vertices as Float32, so a world-space bounding box carries
 * roughly 1e-7 m of noise. 0.1 mm is three orders of magnitude above that and
 * three orders BELOW anything a phone's tracking could resolve, so it catches a
 * real placement error without failing on float arithmetic.
 */
const MM = 1e-4;

const SOFA: Size3 = { width: 2.12, height: 0.76, depth: 0.88 };
const MIRROR: Size3 = { width: 0.6, height: 0.8, depth: 0.3 };
const SCALES = [0.5, 0.75, 1, 1.5, 2];

describe('floor grounding survives resizing', () => {
  for (const k of SCALES) {
    it(`base stays exactly on the floor at ${k}x`, () => {
      const p = piece(SOFA);
      placeOnFloor(p, new THREE.Vector3(1, 0, -2));
      applyScale(p, k);
      expect(Math.abs(worldBox(p).min.y)).toBeLessThan(MM);
    });
  }

  it('grows upward only, so the piece never sinks', () => {
    const p = piece(SOFA);
    placeOnFloor(p, new THREE.Vector3(0, 0, 0));
    applyScale(p, 2);
    const box = worldBox(p);
    expect(Math.abs(box.min.y)).toBeLessThan(MM);
    expect(Math.abs(box.max.y - SOFA.height * 2)).toBeLessThan(MM);
  });

  it('a piece on a table top stays on the table top', () => {
    const top = 0.75;
    const p = piece({ width: 0.3, height: 0.4, depth: 0.3 });
    placeOnFloor(p, new THREE.Vector3(0, top, 0));
    applyScale(p, 1.6);
    expect(Math.abs(worldBox(p).min.y - top)).toBeLessThan(MM);
  });
});

describe('resizing does not move or turn a piece', () => {
  it('leaves the floor position untouched', () => {
    const p = piece(SOFA);
    placeOnFloor(p, new THREE.Vector3(1.25, 0, -3.5), 0.9);
    const before = p.group.position.clone();
    applyScale(p, 1.7);
    expect(p.group.position.x).toBeCloseTo(before.x, 12);
    expect(p.group.position.y).toBeCloseTo(before.y, 12);
    expect(p.group.position.z).toBeCloseTo(before.z, 12);
  });

  it('leaves the turn untouched', () => {
    const p = piece(SOFA);
    placeOnFloor(p, new THREE.Vector3(0, 0, 0), 1.3);
    applyScale(p, 0.6);
    expect(p.group.rotation.y).toBeCloseTo(1.3, 12);
  });

  it('keeps the footprint centred on the piece position', () => {
    const p = piece(SOFA);
    placeOnFloor(p, new THREE.Vector3(2, 0, -1));
    applyScale(p, 1.4);
    const box = worldBox(p);
    expect(Math.abs((box.min.x + box.max.x) / 2 - 2)).toBeLessThan(MM);
    expect(Math.abs((box.min.z + box.max.z) / 2 + 1)).toBeLessThan(MM);
  });

  it('a resize followed by a reset returns the exact original box', () => {
    const p = piece(SOFA);
    placeOnFloor(p, new THREE.Vector3(0.4, 0, 0.7), 0.4);
    const before = worldBox(p).clone();
    applyScale(p, 1.9);
    applyScale(p, 0.5);
    applyScale(p, 1);
    const after = worldBox(p);
    expect(after.min.distanceTo(before.min)).toBeLessThan(MM);
    expect(after.max.distanceTo(before.max)).toBeLessThan(MM);
  });
});

describe('a resized wall piece stays on its wall (BUG-A)', () => {
  const wallZ = -2;
  const hungAt = () => new THREE.Vector3(0, 1.5, wallZ);
  const outward = () => new THREE.Vector3(0, 0, 1);

  for (const k of SCALES) {
    it(`back face is flush with the wall at ${k}x`, () => {
      const p = piece(MIRROR);
      placeOnWall(p, hungAt(), outward());
      applyScale(p, k);
      // The wall is at z = -2 and the piece faces +Z, so its back must sit there.
      expect(Math.abs(worldBox(p).min.z - wallZ)).toBeLessThan(MM);
    });

    it(`stays centred on the spot it was hung at ${k}x`, () => {
      const p = piece(MIRROR);
      placeOnWall(p, hungAt(), outward());
      applyScale(p, k);
      const box = worldBox(p);
      expect(Math.abs((box.min.y + box.max.y) / 2 - 1.5)).toBeLessThan(MM);
    });
  }

  it('does not sink into the wall when enlarged', () => {
    const p = piece(MIRROR);
    placeOnWall(p, hungAt(), outward());
    applyScale(p, 2);
    // Before the fix this was 15 cm inside the wall for a 30 cm deep piece.
    expect(worldBox(p).min.z).toBeGreaterThanOrEqual(wallZ - MM);
  });

  it('does not float off the wall when shrunk', () => {
    const p = piece(MIRROR);
    placeOnWall(p, hungAt(), outward());
    applyScale(p, 0.5);
    expect(worldBox(p).min.z).toBeLessThanOrEqual(wallZ + MM);
  });

  it('works on a wall that is not axis-aligned', () => {
    const p = piece(MIRROR);
    const point = new THREE.Vector3(1, 1.2, 1);
    const normal = new THREE.Vector3(1, 0, 1).normalize();
    placeOnWall(p, point, normal);
    applyScale(p, 1.8);
    // Distance from the hung point to the piece's back plane, along the normal.
    p.group.updateMatrixWorld(true);
    const centre = worldBox(p).getCenter(new THREE.Vector3());
    const alongNormal = centre.clone().sub(point).dot(normal);
    expect(Math.abs(alongNormal - (MIRROR.depth * 1.8) / 2)).toBeLessThan(MM);
  });

  it('a wall piece never drops below the floor', () => {
    const p = piece(MIRROR);
    placeOnWall(p, new THREE.Vector3(0, 0.1, wallZ), outward());
    applyScale(p, 2);
    expect(p.group.position.y).toBeGreaterThanOrEqual(0);
  });
});

describe('two instances of one product are independent', () => {
  it('resizing one leaves the other exactly where and as it was', () => {
    const a = piece(SOFA);
    const b = piece(SOFA);
    placeOnFloor(a, new THREE.Vector3(0, 0, 0));
    placeOnFloor(b, new THREE.Vector3(3, 0, 0));
    const bBefore = worldBox(b).clone();

    applyScale(a, 2);

    expect(Math.abs(worldBox(a).max.x - worldBox(a).min.x - SOFA.width * 2)).toBeLessThan(MM);
    const bAfter = worldBox(b);
    // b is not touched at all, so this is exact, not merely within tolerance.
    expect(bAfter.min.distanceTo(bBefore.min)).toBe(0);
    expect(bAfter.max.distanceTo(bBefore.max)).toBe(0);
    expect(b.userScale).toBe(1);
  });

  it('the shared base size is never written to', () => {
    const a = piece(SOFA);
    applyScale(a, 1.75);
    expect(a.baseSize).toEqual(SOFA);
  });
});
