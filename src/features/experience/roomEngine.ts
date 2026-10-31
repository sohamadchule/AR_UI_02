import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import type { Variant } from "@/lib/api";
import { recolorOf, sheenFactor, tintFactor, type PartPicks, type TintMaterial } from "@/lib/color";
import type { Space } from "@/lib/fit";
import { isCompanion, placementOf, type Placement } from "@/lib/placement";
import {
  describeRoom,
  evaluateLayout,
  rectangleRoom,
  type Footprint,
  type PieceStatus,
  type Point,
  type RoomInfo,
} from "@/lib/room";
import { isPlaceable, resolveTrueScale, type TrueScale } from "@/lib/trueScale";
import { clampScale, isResized, scaleForSide, sizeAt } from "@/lib/resize";
import { AR_FEATURES } from "@/lib/webxr";

/**
 * The AR room: one WebXR session, one three.js scene, one shared room frame.
 *
 * The first tap on the floor fixes the room frame there (held by a WebXR anchor
 * where the browser supports anchors, so ARCore's map corrections move the whole
 * arrangement together and the gaps between pieces stay true). In that frame the
 * floor is exactly y = 0, so floor pieces cannot float or sink, and every placed
 * piece is just a position and a turn on it. Pieces are checked against each
 * other and against the room's walls once those are measured.
 *
 * This class is imperative and knows nothing about React: the overlay calls its
 * commands and renders the snapshots it emits.
 */

export type Surface = "floor" | "raised" | "wall" | "below" | "other";
export type Mode = "idle" | "placing" | "measure-room" | "room-rect" | "ruler";
export type Tracking = "ok" | "limited" | "lost";

export interface ItemView {
  id: string;
  kind: "product" | "space";
  name: string;
  variant: Variant | null;
  /** The size this piece is DRAWN at right now, in metres. Changes when resized. */
  sizeM: { width: number; depth: number; height: number };
  /**
   * The product's own size, in metres: the catalogue dimensions after the asset
   * was brought to real size. Never changes, whatever the customer resizes to.
   */
  originalM: { width: number; depth: number; height: number };
  /** 1 = the product's own size. Per piece, so two copies can differ. */
  userScale: number;
  /** True when this piece is no longer at the size the shop sells. */
  resized: boolean;
  scale: TrueScale | null;
  placement: Placement;
  status: PieceStatus;
}

export interface Snapshot {
  tracking: Tracking;
  mode: Mode;
  hint: string;
  canPlace: boolean;
  /** What a tap would place, while placing. */
  placingName: string | null;
  /** Placing an already placed piece again (picked up). */
  moving: boolean;
  loading: boolean;
  floorSet: boolean;
  items: ItemView[];
  selectedId: string | null;
  /** The selected piece's nearest neighbour. */
  nearest: { name: string; gap: number; tight: boolean; collision: boolean; passage: number } | null;
  /** The selected piece's distance to the nearest wall, once the room is known. */
  wallGap: number | null;
  room: { points: number; closed: boolean; info: RoomInfo | null };
  /** Ruler: points marked so far, and the distance once there are two. */
  ruler: { points: number; distance: number | null };
  rectStep: "corner" | "direction" | null;
  notice: string | null;
  /** Readings for the development-only overlay; never shown to a customer. */
  diagnostics: Diagnostics;
}

/**
 * What the AR session can actually do, and what it is doing right now.
 *
 * Device testing without this is guesswork: a wrong size, a feature the runtime
 * refused and a tracking failure all look alike through a phone screen.
 * `granted` is what the runtime ALLOWED, not what we asked for, so the two are
 * reported separately.
 */
export interface Diagnostics {
  granted: string[];
  requested: string[];
  anchored: boolean;
  /** Surface under the reticle, and its height above the locked floor. */
  surface: Surface | null;
  targetY: number | null;
  fps: number;
}

interface Target {
  hit: XRHitTestResult | null;
  /** Pose in the session's reference space. */
  world: THREE.Matrix4;
  /** Position and surface normal in the room frame (the reference space until the floor is set). */
  local: THREE.Vector3;
  normal: THREE.Vector3;
  surface: Surface;
}

interface Item {
  id: string;
  kind: "product" | "space";
  variant: Variant | null;
  name: string;
  placement: Placement;
  companion: boolean;
  /** The size as drawn: `baseSize` times `userScale`. Collision and fit use this. */
  size: { width: number; depth: number; height: number };
  /** The product's real size. The customer's resizing never writes to this. */
  baseSize: { width: number; depth: number; height: number };
  /** This piece's own resize factor. 1 = the product's real size. */
  userScale: number;
  scale: TrueScale | null;
  group: THREE.Group;
  outline: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  /** Wall a wall piece hangs on, in the room frame. */
  wall: { point: THREE.Vector3; normal: THREE.Vector3 } | null;
  /** Colours chosen for the product's extra parts (empty for single-part products and spaces). */
  picks: PartPicks;
  /** Materials and geometry made for this piece alone, freed with it. */
  owned: { dispose: () => void }[];
}

interface Loaded {
  gltf: GLTF;
  /** Exact authored bounds, measured once per file. */
  box: THREE.Box3;
}

/** A hit counts as horizontal when its normal is within ~20° of straight up, as a wall within ~17° of level. */
const UP_DOT = 0.94;
const WALL_DOT = 0.3;
/**
 * A horizontal hit within this of the locked floor is the floor. ARCore's floor
 * estimate moves by several cm as it refines (more on glossy tiles), so this is
 * generous; the lowest real tabletops (coffee tables) are still well above it.
 */
const FLOOR_TOLERANCE = 0.15;
/** Before the floor is set, a horizontal surface at least this far below the phone may be the floor. */
const MIN_FLOOR_DROP = 0.6;
/** Rays are not followed further than this; beyond it hit positions are too unreliable. */
const MAX_RAY = 12;
export const MAX_ITEMS = 12;
const EMIT_MS = 80;
const NOTICE_MS = 4500;

const COLOURS = { selected: 0xffffff, collision: 0xef4444, outside: 0xef4444, tight: 0xf59e0b, space: 0x3b82f6, room: 0x22d3ee };

let nextId = 1;

export class RoomEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(70, 1, 0.01, 100);
  private readonly pmrem: THREE.PMREMGenerator;
  private readonly environment: THREE.WebGLRenderTarget;
  private readonly loader = new GLTFLoader();
  private readonly models = new Map<string, Promise<Loaded>>();

  /** Everything placed lives in here; its matrix is the room frame. */
  private readonly room = new THREE.Group();
  private readonly roomInverse = new THREE.Matrix4();
  private readonly reticle: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly gapLine: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly roomLine: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly rulerLine: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly markers = new THREE.Group();

  private hitTestSource: XRHitTestSource | null = null;
  private anchor: XRAnchor | null = null;
  private readonly cameraWorld = new THREE.Matrix4();
  private readonly projectionInverse = new THREE.Matrix4();

  private tracking: Tracking = "lost";
  private mode: Mode = "idle";
  private floorSet = false;
  private lowestHorizontal = Infinity;
  private target: Target | null = null;
  // Rolling frame rate, for the diagnostics overlay.
  private fps = 0;
  private frames = 0;
  private fpsSince = 0;
  private placing: Variant | Space | null = null;
  /** Part colours for the product being placed. */
  private placingPicks: PartPicks = {};
  private movingId: string | null = null;
  private items: Item[] = [];
  private selectedId: string | null = null;
  private loadingCount = 0;
  private roomPoints: Point[] = [];
  private roomClosed = false;
  private rulerPoints: THREE.Vector3[] = [];
  private rect: { width: number; depth: number; corner: Point | null } | null = null;
  private drag: { item: Item; offset: THREE.Vector3 } | null = null;
  private notice: { text: string; until: number } | null = null;

  private dirty = true;
  private lastEmit = 0;
  private lastReticleKey = "";
  private disposed = false;

  constructor(
    private readonly session: XRSession,
    private readonly listener: (snapshot: Snapshot) => void,
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%";
    document.body.appendChild(this.canvas);

    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType("local");
    this.renderer = renderer;

    // Image-based lighting, so PBR materials do not read as flat cutouts
    // pasted over the camera feed.
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.environment.texture;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.2));

    this.room.matrixAutoUpdate = false;
    this.room.visible = false;
    this.scene.add(this.room);

    // The key light and its shadow move with the room, so every piece casts onto the floor.
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(1.5, 3, 1.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.far = 20;
    key.shadow.bias = -0.0005;
    this.room.add(key, key.target);

    const shadowCatcher = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2),
      new THREE.ShadowMaterial({ opacity: 0.28 }),
    );
    shadowCatcher.receiveShadow = true;
    this.room.add(shadowCatcher);

    // Reticle: a flat ring lying on whatever surface is targeted.
    this.reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.075, 0.09, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false }),
    );
    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
    this.reticle.renderOrder = 10;
    this.scene.add(this.reticle);

    const overlayLine = (color: number) => {
      const line = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true }),
      );
      line.renderOrder = 9;
      line.visible = false;
      this.room.add(line);
      return line;
    };
    this.gapLine = overlayLine(COLOURS.selected);
    this.roomLine = overlayLine(COLOURS.room);
    this.rulerLine = overlayLine(COLOURS.selected);
    this.room.add(this.markers);
  }

  // ---- lifecycle -----------------------------------------------------------

  async start() {
    const onEnd = () => this.dispose();
    this.session.addEventListener("end", onEnd);
    // Runtimes without dom-overlay deliver a screen tap as an XR select.
    this.session.addEventListener("select", () => {
      if (this.mode === "placing") void this.place();
    });
    await this.renderer.xr.setSession(this.session);
    const viewerSpace = await this.session.requestReferenceSpace("viewer");
    this.hitTestSource = (await this.session.requestHitTestSource?.({ space: viewerSpace })) ?? null;
    this.renderer.setAnimationLoop((time, frame) => this.onFrame(time, frame));
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.hitTestSource?.cancel();
    this.anchor?.delete();
    for (const item of this.items) this.disposeItem(item);
    for (const pending of this.models.values()) {
      pending
        .then(({ gltf }) =>
          gltf.scene.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.geometry.dispose();
            for (const material of [mesh.material].flat()) {
              for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
              material.dispose();
            }
          }),
        )
        .catch(() => {});
    }
    this.environment.texture.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }

  // ---- commands ------------------------------------------------------------

  /** Get ready to place a product; its model starts loading now so the tap is instant. */
  arm(variant: Variant, picks: PartPicks = {}) {
    if (this.items.length >= MAX_ITEMS) return this.say(`You can place up to ${MAX_ITEMS} pieces at once. Delete one to add another.`);
    void this.load(variant.model.url).catch(() => {});
    this.setMode("placing");
    this.placing = variant;
    this.placingPicks = picks;
    this.movingId = null;
  }

  /** Get ready to place a translucent box the size of the customer's available space. */
  armSpace(space: Space) {
    this.setMode("placing");
    this.placing = space;
    this.movingId = null;
  }

  /** Pick the selected piece up and place it again (another spot, another wall, a table). */
  pickUp() {
    const item = this.selected();
    if (!item) return;
    this.setMode("placing");
    this.placing = item.variant ?? this.spaceOf(item);
    this.movingId = item.id;
  }

  cancel() {
    this.setMode("idle");
  }

  /** Act on what the reticle is on: place, add a corner, mark a ruler point. */
  mark() {
    if (this.mode === "placing") return void this.place();
    if (this.mode === "measure-room") return this.addRoomPoint();
    if (this.mode === "ruler") return this.addRulerPoint();
    if (this.mode === "room-rect") return this.rectTap();
  }

  /** A tap on the camera view: marks while aiming, otherwise selects the piece tapped. */
  tap(x: number, y: number) {
    if (this.mode !== "idle") return this.mark();
    const ray = this.screenRay(x, y);
    this.select(ray ? (this.pick(ray)?.id ?? null) : null);
  }

  /** Begin dragging the piece under the finger; false when there is none. */
  dragStart(x: number, y: number): boolean {
    if (this.mode !== "idle" || this.tracking !== "ok" || !this.floorSet) return false;
    const ray = this.screenRay(x, y);
    const item = ray && this.pick(ray);
    if (!ray || !item) return false;
    this.select(item.id);
    const point = this.onSurfaceOf(ray, item);
    if (!point) return false;
    this.drag = { item, offset: item.group.position.clone().sub(point) };
    return true;
  }

  dragMove(x: number, y: number) {
    if (!this.drag || this.tracking !== "ok") return;
    const ray = this.screenRay(x, y);
    const point = ray && this.onSurfaceOf(ray, this.drag.item);
    if (!point) return;
    this.drag.item.group.position.copy(point.add(this.drag.offset));
    this.drag.item.group.updateMatrix();
    this.dirty = true;
  }

  dragEnd() {
    this.drag = null;
  }

  /**
   * Resize the selected piece, as a factor of its real size.
   *
   * One uniform factor, so the piece keeps its proportions: a customer asking for
   * a narrower sofa gets a smaller sofa, not a squashed one. The factor lives on
   * the piece, so another copy of the same product is untouched, and it is applied
   * to the piece's own group — never to the shared model or the catalogue.
   *
   * Returns the factor actually used, which is clamped to RESIZE_MIN..RESIZE_MAX.
   */
  resizeSelected(scale: number): number | null {
    const item = this.selected();
    if (!item || item.kind !== "product") return null;
    return this.applyScale(item, scale);
  }

  /**
   * Resize so one side measures `mm`, keeping the proportions.
   *
   * The customer types the side they care about — the width that has to fit an
   * alcove, say — and the rest follows. Independent per-axis sizing is not offered:
   * it would distort the piece, and a distorted preview is not the product.
   */
  resizeSelectedToMm(axis: "width" | "depth" | "height", mm: number): number | null {
    const item = this.selected();
    if (!item || item.kind !== "product") return null;
    const scale = scaleForSide(item.baseSize, axis, mm);
    return scale === null ? null : this.applyScale(item, scale);
  }

  /** Back to the size the shop actually sells. */
  resetSelectedSize(): number | null {
    const item = this.selected();
    if (!item || item.kind !== "product") return null;
    return this.applyScale(item, 1);
  }

  /**
   * The only place a piece's scale is set.
   *
   * The model inside the group already rests on y = 0 with its footprint centred
   * on the origin, so scaling the group about that origin keeps the piece on the
   * floor and in place: position and turn are not touched here, and the normalised
   * asset is not touched at all, so no scale is ever applied twice.
   */
  private applyScale(item: Item, scale: number): number {
    const next = clampScale(scale);
    item.userScale = next;
    item.size = sizeAt(item.baseSize, next);
    item.group.scale.setScalar(next);
    // A wall piece is held against its wall by an offset of half its own depth,
    // and centred on the spot it was hung by half its own height. Both are sizes,
    // so both move when the piece is resized: without this it sinks into the wall
    // and climbs it. Floor and table pieces rest on y = 0 inside their group and
    // need nothing.
    this.reseatOnWall(item);
    item.group.updateMatrix();
    this.dirty = true;
    return next;
  }

  /** Put a wall piece back against the wall it was hung on, at its current size. */
  private reseatOnWall(item: Item) {
    if (!item.wall) return;
    const { point, normal } = item.wall;
    item.group.position.copy(point).addScaledVector(normal, item.size.depth / 2);
    item.group.position.y = Math.max(0, point.y - item.size.height / 2);
  }

  rotateSelected(radians: number) {
    const item = this.selected();
    // A wall piece always faces out from its wall.
    if (!item || item.placement === "wall") return;
    item.group.rotation.y += radians;
    item.group.updateMatrix();
    this.dirty = true;
  }

  select(id: string | null) {
    this.selectedId = id;
    this.dirty = true;
  }

  deleteSelected() {
    const item = this.selected();
    if (!item) return;
    this.removeItem(item);
    this.selectedId = null;
    this.dirty = true;
  }

  async duplicateSelected() {
    const item = this.selected();
    if (!item?.variant) return;
    if (this.items.length >= MAX_ITEMS) return this.say(`You can place up to ${MAX_ITEMS} pieces at once.`);
    const copy = await this.makeProduct(item.variant, item.picks);
    if (!copy) return;
    // The copy starts at the size you can see; from then on the two are separate.
    if (item.userScale !== 1) this.applyScale(copy, item.userScale);
    // Beside the original, along its own width, with a hand's gap.
    const side = new THREE.Vector3(item.size.width + 0.1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), item.group.rotation.y);
    copy.group.position.copy(item.group.position).add(side);
    copy.group.rotation.y = item.group.rotation.y;
    copy.wall = item.wall && { point: item.wall.point.clone().add(side), normal: item.wall.normal.clone() };
    copy.group.updateMatrix();
    this.addItem(copy);
  }

  /** Show the selected piece in another colour (or another variant of the same product). */
  async changeVariant(variant: Variant) {
    const item = this.selected();
    if (!item?.variant || item.variant.id === variant.id) return;
    // Same product, so the part colours chosen for it still apply.
    const next = await this.makeProduct(variant, item.picks);
    if (!next) return;
    // A different colour is the same piece: keep the size the customer set.
    if (item.userScale !== 1) this.applyScale(next, item.userScale);
    next.group.position.copy(item.group.position);
    next.group.rotation.y = item.group.rotation.y;
    next.wall = item.wall;
    next.group.updateMatrix();
    this.removeItem(item);
    this.addItem(next);
  }

  /** Start outlining the room by tapping where the floor meets the walls at each corner. */
  measureRoom() {
    this.setMode("measure-room");
    this.roomPoints = [];
    this.roomClosed = false;
    this.drawRoom();
  }

  undoRoomPoint() {
    this.roomPoints.pop();
    this.drawRoom();
    this.dirty = true;
  }

  finishRoom() {
    if (this.roomPoints.length < 3) return;
    this.roomClosed = true;
    this.drawRoom();
    this.setMode("idle");
  }

  /** Start a rectangular room of known size: tap a corner, then a point along one wall. */
  enterRoom(widthM: number, depthM: number) {
    this.setMode("room-rect");
    this.rect = { width: widthM, depth: depthM, corner: null };
  }

  clearRoom() {
    this.roomPoints = [];
    this.roomClosed = false;
    this.drawRoom();
    this.dirty = true;
  }

  ruler() {
    this.setMode("ruler");
    this.rulerPoints = [];
    this.drawRuler();
  }

  /** Clear the whole room: pieces, walls, and the floor itself (for when the floor was set wrongly). */
  resetAll() {
    for (const item of [...this.items]) this.removeItem(item);
    this.selectedId = null;
    this.clearRoom();
    this.rulerPoints = [];
    this.drawRuler();
    this.anchor?.delete();
    this.anchor = null;
    this.floorSet = false;
    this.lowestHorizontal = Infinity;
    this.room.visible = false;
    this.setMode("idle");
  }

  // ---- placing -------------------------------------------------------------

  private async place() {
    let t = this.target;
    if (!t || !this.placing || !this.canPlace(t)) return;
    if (!this.floorSet) {
      this.setRoomFrame(t);
      // The room frame is this very point.
      t = { ...t, local: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0) };
      // A wall or table piece needs the floor first: that tap only set it.
      if (this.placementOfPlacing() !== "floor") {
        this.dirty = true;
        return this.say("Floor set. Now point at where this piece goes.");
      }
    }
    const at = this.localOf(t);
    const camera = new THREE.Vector3().setFromMatrixPosition(this.cameraWorld).applyMatrix4(this.roomInverse);
    const placing = this.placing;
    const moving = this.movingId ? this.items.find((i) => i.id === this.movingId) : undefined;
    this.setMode("idle");

    const item = moving ?? (isVariant(placing) ? await this.makeProduct(placing, this.placingPicks) : this.makeSpace(placing));
    if (!item || this.disposed) return;
    const { group, size } = item;
    if (item.placement === "wall") {
      // Back against the wall, facing out of it, centred where the reticle was.
      const out = new THREE.Vector3(at.normal.x, 0, at.normal.z).normalize();
      group.rotation.y = Math.atan2(out.x, out.z);
      group.position.copy(at.position).addScaledVector(out, size.depth / 2);
      group.position.y = Math.max(0, at.position.y - size.height / 2);
      item.wall = { point: at.position.clone(), normal: out };
    } else {
      group.position.set(at.position.x, item.placement === "tabletop" ? at.position.y : 0, at.position.z);
      // Facing the customer, so it is never placed back-on.
      group.rotation.y = Math.atan2(camera.x - at.position.x, camera.z - at.position.z);
      item.wall = null;
    }
    group.updateMatrix();
    group.visible = true;
    if (!moving) this.addItem(item);
    this.select(item.id);
  }

  private canPlace(t: Target): boolean {
    if (this.tracking !== "ok") return false;
    if (!this.floorSet) return t.surface === "floor";
    const placement = this.placementOfPlacing();
    if (placement === "wall") return t.surface === "wall";
    if (placement === "tabletop") return t.surface === "floor" || t.surface === "raised";
    return t.surface === "floor";
  }

  private placementOfPlacing(): Placement {
    return this.placing && isVariant(this.placing) ? placementOf(this.placing) : "floor";
  }

  /** Fix the room frame on this floor point, anchored where the browser supports it. */
  private setRoomFrame(t: Target) {
    this.room.matrix.copy(t.world);
    this.room.matrixWorldNeedsUpdate = true;
    this.roomInverse.copy(t.world).invert();
    this.room.visible = true;
    this.floorSet = true;
    t.hit
      ?.createAnchor?.()
      .then((anchor) => {
        if (this.disposed || !this.floorSet) anchor.delete();
        else this.anchor = anchor;
      })
      .catch(() => {
        // No anchors: the room stays fixed in the session's own space, which is
        // usually fine but can drift a little on long sessions.
      });
  }

  /** The target in the room frame, snapped onto the floor when it is the floor. */
  private localOf(t: Target) {
    const position = t.local.clone();
    if (t.surface === "floor") position.y = 0;
    return { position, normal: t.normal };
  }

  // ---- pieces --------------------------------------------------------------

  private load(url: string): Promise<Loaded> {
    let pending = this.models.get(url);
    if (!pending) {
      this.loadingCount++;
      this.dirty = true;
      pending = this.loader
        .loadAsync(url)
        .then((gltf) => {
          gltf.scene.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (mesh.isMesh) {
              mesh.castShadow = true;
              mesh.receiveShadow = true;
            }
          });
          // Every vertex, not mesh bounds, which overshoot on rotated parts.
          return { gltf, box: new THREE.Box3().setFromObject(gltf.scene, true) };
        })
        .finally(() => {
          this.loadingCount--;
          this.dirty = true;
        });
      pending.catch(() => this.models.delete(url));
      this.models.set(url, pending);
    }
    return pending;
  }

  /** A placed copy of a product at its real size (see resolveTrueScale), not yet in the room. */
  private async makeProduct(variant: Variant, picks: PartPicks = {}): Promise<Item | null> {
    let loaded: Loaded;
    try {
      loaded = await this.load(variant.model.url);
    } catch {
      this.say(`Couldn't load ${variant.product.name}.`);
      return null;
    }
    if (this.disposed) return null;
    const { gltf, box } = loaded;
    const authored = box.getSize(new THREE.Vector3());
    const scale = resolveTrueScale({ width: authored.x, height: authored.y, depth: authored.z }, variant.product.dimensionsMm);
    const drawn = authored.clone().multiplyScalar(scale.scale);
    if (!isPlaceable({ width: drawn.x, height: drawn.y, depth: drawn.z })) {
      // Placing it would put an invisible giant (or a speck) in the room that overlaps everything.
      this.say(`${variant.product.name} can't be shown: its 3D model has no believable size. Ask the shop to fix the model.`);
      return null;
    }

    const owned: { dispose: () => void }[] = [];
    const model = gltf.scene.clone(true);
    // glTF material index → its tint data and colour, part by part.
    const tinted = new Map<number, { m: TintMaterial; hex: string }>(
      recolorOf(variant, picks).flatMap((r) => r.tint.materials.map((m) => [m.index, { m, hex: r.hex }] as const)),
    );
    if (tinted.size) {
      model.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const recolour = (material: THREE.Material) => {
          const index = gltf.parser.associations.get(material)?.materials;
          const entry = index === undefined ? undefined : tinted.get(index);
          if (!entry) return material;
          const { m, hex } = entry;
          // Copies share a model; each colour needs its own material.
          const copy = material.clone() as THREE.MeshPhysicalMaterial;
          copy.color.setRGB(...tintFactor(hex, m.texAvg));
          const sheen = sheenFactor(hex, m);
          if (sheen && copy.sheenColor) copy.sheenColor.setRGB(...sheen);
          owned.push(copy);
          return copy;
        };
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(recolour) : recolour(mesh.material);
      });
    }

    // Real size, a quarter turn for side-on files, footprint centred on the
    // origin and the base resting on y = 0.
    model.rotation.y = scale.swapWidthDepth ? Math.PI / 2 : 0;
    model.scale.setScalar(scale.scale);
    model.updateMatrix();
    const fitted = box.clone().applyMatrix4(model.matrix);
    const centre = fitted.getCenter(new THREE.Vector3());
    model.position.set(-centre.x, -fitted.min.y, -centre.z);
    const size = fitted.getSize(new THREE.Vector3());

    const group = new THREE.Group();
    group.add(model);
    return this.finishItem({
      kind: "product",
      variant,
      picks,
      name: variant.product.name,
      placement: placementOf(variant),
      companion: isCompanion(variant),
      size: { width: size.x, depth: size.z, height: size.y },
      scale,
      group,
      owned,
    });
  }

  /** A translucent box showing the customer's available space. */
  private makeSpace(space: Space): Item {
    const width = (space.width ?? 1000) / 1000;
    const depth = (space.depth ?? 1000) / 1000;
    const height = space.height === null ? 0.02 : space.height / 1000;
    const geometry = new THREE.BoxGeometry(width, height, depth).translate(0, height / 2, 0);
    const fill = new THREE.MeshBasicMaterial({ color: COLOURS.space, transparent: true, opacity: 0.16, depthWrite: false });
    const edges = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: COLOURS.space });
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geometry, fill), new THREE.LineSegments(edges, edgeMaterial));
    return this.finishItem({
      kind: "space",
      variant: null,
      picks: {},
      name: "Your space",
      placement: "floor",
      companion: false,
      size: { width, depth, height },
      scale: null,
      group,
      owned: [geometry, fill, edges, edgeMaterial],
    });
  }

  private finishItem(base: Omit<Item, "id" | "outline" | "wall" | "baseSize" | "userScale">): Item {
    const { width: w, depth: d } = base.size;
    const geometry = new THREE.BufferGeometry().setFromPoints(
      [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, z]) => new THREE.Vector3(x, 0.01, z)),
    );
    const outline = new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({ depthTest: false, transparent: true }));
    outline.renderOrder = 9;
    outline.visible = false;
    base.group.add(outline);
    base.group.matrixAutoUpdate = false;
    base.group.visible = false;
    return {
      ...base,
      // A new piece starts at the product's real size; `size` tracks what is drawn.
      baseSize: { ...base.size },
      userScale: 1,
      id: `piece-${nextId++}`,
      outline,
      wall: null,
      owned: [...base.owned, geometry, outline.material],
    };
  }

  private addItem(item: Item) {
    this.room.add(item.group);
    this.items.push(item);
    item.group.visible = true;
    this.select(item.id);
  }

  private removeItem(item: Item) {
    this.room.remove(item.group);
    this.items = this.items.filter((i) => i !== item);
    this.disposeItem(item);
    this.dirty = true;
  }

  private disposeItem(item: Item) {
    for (const thing of item.owned) thing.dispose();
  }

  private selected() {
    return this.items.find((i) => i.id === this.selectedId) ?? null;
  }

  private spaceOf(item: Item): Space {
    return {
      width: item.size.width * 1000,
      depth: item.size.depth * 1000,
      height: item.size.height <= 0.02 ? null : item.size.height * 1000,
    };
  }

  private footprintOf(item: Item): Footprint {
    const p = item.group.position;
    return {
      x: p.x,
      z: p.z,
      width: item.size.width,
      depth: item.size.depth,
      yaw: item.group.rotation.y,
      bottom: p.y,
      top: p.y + item.size.height,
    };
  }

  // ---- rays ----------------------------------------------------------------

  /** The ray through a screen point, in the room frame. */
  private screenRay(x: number, y: number): THREE.Ray | null {
    if (this.tracking === "lost") return null;
    const ndcX = (x / window.innerWidth) * 2 - 1;
    const ndcY = -(y / window.innerHeight) * 2 + 1;
    const origin = new THREE.Vector3().setFromMatrixPosition(this.cameraWorld);
    const through = new THREE.Vector3(ndcX, ndcY, 0.5).applyMatrix4(this.projectionInverse).applyMatrix4(this.cameraWorld);
    return new THREE.Ray(origin, through.sub(origin).normalize()).applyMatrix4(this.roomInverse);
  }

  /** Where a ray meets a plane, if in front of the camera and close enough to trust. */
  private onPlane(ray: THREE.Ray, plane: THREE.Plane): THREE.Vector3 | null {
    const point = ray.intersectPlane(plane, new THREE.Vector3());
    return point && point.distanceTo(ray.origin) <= MAX_RAY ? point : null;
  }

  /** Where a ray meets the surface a piece stands or hangs on. */
  private onSurfaceOf(ray: THREE.Ray, item: Item): THREE.Vector3 | null {
    const plane = item.wall
      ? new THREE.Plane().setFromNormalAndCoplanarPoint(item.wall.normal, item.wall.point)
      : new THREE.Plane(new THREE.Vector3(0, 1, 0), -item.group.position.y);
    return this.onPlane(ray, plane);
  }

  /** The nearest placed piece the ray passes through. */
  private pick(ray: THREE.Ray): Item | null {
    let best: { item: Item; distance: number } | null = null;
    for (const item of this.items) {
      const { width: w, depth: d, height: h } = item.size;
      const local = ray.clone().applyMatrix4(item.group.matrix.clone().invert());
      const hit = local.intersectBox(new THREE.Box3(new THREE.Vector3(-w / 2, 0, -d / 2), new THREE.Vector3(w / 2, Math.max(h, 0.05), d / 2)), new THREE.Vector3());
      if (!hit) continue;
      const distance = hit.applyMatrix4(item.group.matrix).distanceTo(ray.origin);
      if (!best || distance < best.distance) best = { item, distance };
    }
    return best?.item ?? null;
  }

  // ---- measuring -----------------------------------------------------------

  private floorPointAtTarget(): Point | null {
    const t = this.target;
    if (!t || t.surface !== "floor") return null;
    return [t.local.x, t.local.z];
  }

  private addRoomPoint() {
    const p = this.floorPointAtTarget();
    if (!p) return;
    this.roomPoints.push(p);
    this.drawRoom();
    this.dirty = true;
  }

  private rectTap() {
    const p = this.floorPointAtTarget();
    if (!p || !this.rect) return;
    if (!this.rect.corner) {
      this.rect.corner = p;
      this.roomPoints = [p];
      this.drawRoom();
      this.dirty = true;
      return;
    }
    if (Math.hypot(p[0] - this.rect.corner[0], p[1] - this.rect.corner[1]) < 0.3) {
      return this.say("Tap a point further along the wall.");
    }
    const camera = new THREE.Vector3().setFromMatrixPosition(this.cameraWorld).applyMatrix4(this.roomInverse);
    this.roomPoints = rectangleRoom(this.rect.corner, p, this.rect.width, this.rect.depth, [camera.x, camera.z]);
    this.roomClosed = true;
    this.rect = null;
    this.drawRoom();
    this.setMode("idle");
  }

  private addRulerPoint() {
    const t = this.target;
    if (!t) return;
    const at = this.localOf(t).position;
    if (this.rulerPoints.length >= 2) this.rulerPoints = [];
    this.rulerPoints.push(at);
    this.drawRuler();
    this.dirty = true;
  }

  private drawRoom() {
    const points = this.roomPoints.map(([x, z]) => new THREE.Vector3(x, 0.015, z));
    if (this.roomClosed && points.length) points.push(points[0].clone());
    this.roomLine.geometry.dispose();
    this.roomLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
    this.roomLine.visible = points.length > 1;
    for (const child of [...this.markers.children]) {
      const marker = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
      marker.geometry.dispose();
      marker.material.dispose();
      this.markers.remove(marker);
    }
    for (const [x, z] of this.roomPoints) {
      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.04, 20).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: COLOURS.room, depthTest: false, transparent: true }),
      );
      dot.position.set(x, 0.016, z);
      dot.renderOrder = 9;
      this.markers.add(dot);
    }
  }

  private drawRuler() {
    this.rulerLine.geometry.dispose();
    this.rulerLine.geometry = new THREE.BufferGeometry().setFromPoints(this.rulerPoints.map((p) => p.clone().setY(p.y + 0.01)));
    this.rulerLine.visible = this.rulerPoints.length === 2;
  }

  // ---- per frame -----------------------------------------------------------

  private onFrame(time: number, frame?: XRFrame) {
    if (!frame) return;
    try {
      this.update(time, frame);
    } catch (err) {
      // One bad frame must not freeze the camera view: log it and keep drawing.
      console.error("AR frame failed", err);
    }
    this.renderer.render(this.scene, this.camera);
  }

  private update(time: number, frame: XRFrame) {
    this.frames++;
    if (!this.fpsSince) this.fpsSince = time;
    else if (time - this.fpsSince >= 1000) {
      this.fps = Math.round((this.frames * 1000) / (time - this.fpsSince));
      this.frames = 0;
      this.fpsSince = time;
      this.dirty = true;
    }
    const space = this.renderer.xr.getReferenceSpace();
    const pose = space ? frame.getViewerPose(space) : undefined;
    const tracking: Tracking = !pose ? "lost" : pose.emulatedPosition ? "limited" : "ok";
    if (tracking !== this.tracking) {
      this.tracking = tracking;
      // Losing tracking mid-drag would fling the piece; drop it where it is.
      if (tracking !== "ok") this.drag = null;
      this.dirty = true;
    }
    if (pose) {
      const view = pose.views[0];
      this.cameraWorld.fromArray(view.transform.matrix);
      this.projectionInverse.fromArray(view.projectionMatrix).invert();
    }

    // Follow ARCore's corrections to the anchor, so the room stays where it is in reality.
    if (space && this.anchor && frame.trackedAnchors?.has(this.anchor)) {
      const anchorPose = frame.getPose(this.anchor.anchorSpace, space);
      if (anchorPose) {
        this.room.matrix.fromArray(anchorPose.transform.matrix);
        this.room.matrixWorldNeedsUpdate = true;
        this.roomInverse.copy(this.room.matrix).invert();
      }
    }

    // Measuring works in the room frame, so it has nothing to aim at until the floor is set.
    const aiming = this.mode === "placing" || (this.mode !== "idle" && this.floorSet);
    this.target = space && tracking === "ok" && aiming ? this.findTarget(frame, space) : null;
    this.updateReticle();

    if (this.notice && time > this.notice.until) {
      this.notice = null;
      this.dirty = true;
    }
    if (this.dirty && time - this.lastEmit > EMIT_MS) {
      this.lastEmit = time;
      this.dirty = false;
      this.emit();
    }
  }

  /** Where the centre of the screen meets the locked floor plane. */
  private floorTarget(): Target | null {
    const ray = this.screenRay(window.innerWidth / 2, window.innerHeight / 2);
    const point = ray && this.onPlane(ray, new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
    if (!point) return null;
    const world = new THREE.Matrix4().makeTranslation(point.x, 0, point.z).premultiply(this.room.matrix);
    return { hit: null, world, local: point, normal: new THREE.Vector3(0, 1, 0), surface: "floor" };
  }

  private findTarget(frame: XRFrame, space: XRReferenceSpace): Target | null {
    // Measuring only ever needs the floor: once it is set, follow the centre of
    // the screen onto the floor plane itself, which reaches corners that ARCore
    // has not mapped as a plane yet.
    if (this.floorSet && this.mode !== "placing") return this.floorTarget();

    const hit = this.hitTestSource ? frame.getHitTestResults(this.hitTestSource)[0] : undefined;
    const hitPose = hit?.getPose(space);
    if (!hit || !hitPose) {
      // Over floor ARCore hasn't mapped yet, a floor piece can still aim at the
      // floor already found. A real hit on a table or wall still wins, so this
      // never places a sofa under a table.
      return this.floorSet && this.placementOfPlacing() === "floor" ? this.floorTarget() : null;
    }
    const world = new THREE.Matrix4().fromArray(hitPose.transform.matrix);
    const position = new THREE.Vector3().setFromMatrixPosition(world);
    const normal = new THREE.Vector3().setFromMatrixColumn(world, 1).normalize();
    const local = this.floorSet ? position.clone().applyMatrix4(this.roomInverse) : position.clone();
    const n = this.floorSet ? normal.clone().transformDirection(this.roomInverse) : normal;

    let surface: Surface = "other";
    if (n.y > UP_DOT) {
      if (this.floorSet) {
        surface = Math.abs(local.y) <= FLOOR_TOLERANCE ? "floor" : local.y > 0 ? "raised" : "below";
      } else {
        // No floor yet: the lowest level surface well below the phone is the floor;
        // a tabletop is too close to it, or sits above a lower surface already seen.
        this.lowestHorizontal = Math.min(this.lowestHorizontal, position.y);
        const drop = new THREE.Vector3().setFromMatrixPosition(this.cameraWorld).y - position.y;
        surface = drop >= MIN_FLOOR_DROP && position.y <= this.lowestHorizontal + 0.2 ? "floor" : "raised";
      }
    } else if (Math.abs(n.y) < WALL_DOT) {
      surface = "wall";
    }
    return { hit, world, local, normal: n, surface };
  }

  private updateReticle() {
    const t = this.target;
    const ok = t ? (this.mode === "placing" ? this.canPlace(t) : t.surface === "floor") : false;
    this.reticle.visible = Boolean(t);
    if (t) {
      if (t.surface === "floor" && this.floorSet) {
        // Lie exactly on the locked floor, level with the room.
        this.reticle.matrix.makeTranslation(t.local.x, 0, t.local.z).premultiply(this.room.matrix);
      } else {
        this.reticle.matrix.copy(t.world);
      }
      this.reticle.material.color.setHex(ok ? 0xffffff : 0xf59e0b);
    }
    const key = `${t?.surface ?? "none"}:${ok}`;
    if (key !== this.lastReticleKey) {
      this.lastReticleKey = key;
      this.dirty = true;
    }
    if (this.mode === "ruler" && this.rulerPoints.length === 1 && t) this.dirty = true;
  }

  // ---- snapshot ------------------------------------------------------------

  private setMode(mode: Mode) {
    this.mode = mode;
    if (mode !== "placing") {
      this.placing = null;
      this.movingId = null;
    }
    if (mode !== "room-rect") this.rect = null;
    if (mode !== "ruler") {
      this.rulerPoints = [];
      this.drawRuler();
    }
    this.dirty = true;
  }

  private say(text: string) {
    this.notice = { text, until: performance.now() + NOTICE_MS };
    this.dirty = true;
  }

  private hint(): string {
    if (this.tracking === "lost") return "Starting the camera…";
    if (this.tracking === "limited") return "Tracking lost. Move the phone slowly and point at the floor in good light.";
    const surface = this.target?.surface;
    switch (this.mode) {
      case "placing": {
        if (!this.target) return "Move the phone slowly to find the floor.";
        if (!this.floorSet) {
          return surface === "floor" ? "Tap to set the floor here." : surface === "wall" ? "That's a wall. Point at the floor." : "That looks raised, like a table. Point at the floor.";
        }
        const placement = this.placementOfPlacing();
        if (this.canPlace(this.target)) return `Tap to place ${this.placingName() ?? "it"}.`;
        if (placement === "wall") return "Point at a wall.";
        if (placement === "tabletop") return "Point at a table or the floor.";
        if (surface === "wall") return "That's a wall. Point at the floor.";
        if (surface === "below") return "That's below the floor you set. If the floor is wrong, use Room → Start over.";
        return "That looks raised, like a table. Point at the floor.";
      }
      case "measure-room":
        if (!this.floorSet) return "Place a piece first, so the floor is set.";
        return `Aim at a corner where the floor meets the walls, then tap Add corner (${this.roomPoints.length} so far).`;
      case "room-rect":
        if (!this.floorSet) return "Place a piece first, so the floor is set.";
        return this.rect?.corner
          ? "Now aim further along the wall your width runs along, and tap."
          : "Aim at one corner of the room on the floor, and tap.";
      case "ruler":
        if (!this.floorSet) return "Place a piece first, so the floor is set.";
        return this.rulerPoints.length === 1 ? "Aim at the second point and tap." : "Aim at the first point on the floor and tap.";
      default:
        if (!this.items.length) return "Add a piece of furniture to begin.";
        return "Tap a piece to select it. Drag to move it, twist two fingers to turn it.";
    }
  }

  private placingName(): string | null {
    if (!this.placing) return null;
    return isVariant(this.placing) ? this.placing.product.name : "your space";
  }

  private emit() {
    const pieces = this.items.filter((i) => i.kind === "product");
    const report = evaluateLayout(
      pieces.map((i) => ({ id: i.id, footprint: this.footprintOf(i), companion: i.companion })),
      this.roomClosed ? this.roomPoints : null,
    );

    for (const item of this.items) {
      const status = report.status[item.id] ?? "ok";
      const selected = item.id === this.selectedId;
      const colour = item.kind === "space" ? COLOURS.space : selected ? COLOURS.selected : status === "ok" ? null : COLOURS[status];
      item.outline.visible = colour !== null;
      if (colour !== null) item.outline.material.color.setHex(colour);
    }

    const byId = new Map(this.items.map((i) => [i.id, i]));
    let nearest: Snapshot["nearest"] = null;
    let line: [Point, Point] | null = null;
    for (const pair of report.pairs) {
      if (pair.a !== this.selectedId && pair.b !== this.selectedId) continue;
      if (nearest && pair.gap >= nearest.gap) continue;
      const other = byId.get(pair.a === this.selectedId ? pair.b : pair.a);
      nearest = { name: other?.name ?? "", gap: pair.gap, tight: pair.tight, collision: pair.collision, passage: pair.passage };
      line = pair.gap > 0 ? [pair.from, pair.to] : null;
    }
    this.gapLine.visible = Boolean(line && nearest && nearest.gap < 3);
    if (line) {
      this.gapLine.geometry.dispose();
      this.gapLine.geometry = new THREE.BufferGeometry().setFromPoints(line.map(([x, z]) => new THREE.Vector3(x, 0.02, z)));
    }

    const rulerTarget = this.mode === "ruler" && this.rulerPoints.length === 1 && this.target ? this.localOf(this.target).position : null;
    const rulerEnd = this.rulerPoints[1] ?? rulerTarget;

    this.listener({
      tracking: this.tracking,
      mode: this.mode,
      hint: this.hint(),
      canPlace: Boolean(this.target && this.placing && this.canPlace(this.target)),
      placingName: this.placingName(),
      moving: this.movingId !== null,
      loading: this.loadingCount > 0,
      floorSet: this.floorSet,
      items: this.items.map((i) => ({
        id: i.id,
        kind: i.kind,
        name: i.name,
        variant: i.variant,
        sizeM: i.size,
        originalM: i.baseSize,
        userScale: i.userScale,
        resized: isResized(i.userScale),
        scale: i.scale,
        placement: i.placement,
        status: report.status[i.id] ?? "ok",
      })),
      selectedId: this.selectedId,
      nearest,
      wallGap: this.selectedId && this.roomClosed ? (report.wallGap[this.selectedId] ?? null) : null,
      room: {
        points: this.roomPoints.length,
        closed: this.roomClosed,
        info: this.roomClosed && this.roomPoints.length >= 3 ? describeRoom(this.roomPoints) : null,
      },
      ruler: {
        points: this.rulerPoints.length,
        distance: this.rulerPoints[0] && rulerEnd ? this.rulerPoints[0].distanceTo(rulerEnd) : null,
      },
      rectStep: this.rect ? (this.rect.corner ? "direction" : "corner") : null,
      notice: this.notice?.text ?? null,
      diagnostics: {
        granted: Array.from((this.session as XRSession & { enabledFeatures?: readonly string[] }).enabledFeatures ?? []),
        requested: AR_FEATURES,
        anchored: this.anchor !== null,
        surface: this.target?.surface ?? null,
        targetY: this.target ? this.target.local.y : null,
        fps: this.fps,
      },
    });
  }
}

const isVariant = (v: Variant | Space): v is Variant => "model" in v;
