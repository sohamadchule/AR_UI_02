import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import type { Variant } from "@/lib/api";
import { recolorOf, sheenFactor, tintFactor, type PartPicks, type TintMaterial } from "@/lib/color";
import { placementOf, type Placement } from "@/lib/placement";
import { isPlaceable, resolveTrueScale, type TrueScale } from "@/lib/trueScale";
import { clampScale, isResized, scaleForSide, sizeAt } from "@/lib/resize";
import { AR_FEATURES } from "@/lib/webxr";

/**
 * Simplified AR room engine — easy product placement.
 *
 * Place products on the floor (or wall/table), move them by dragging,
 * rotate with two fingers, resize with a slider. No room measurement,
 * no overlap checks, no fit constraints.
 */

export type Surface = "floor" | "raised" | "wall" | "below" | "other";
export type Mode = "idle" | "placing";
export type Tracking = "ok" | "limited" | "lost";

export interface ItemView {
  id: string;
  name: string;
  variant: Variant | null;
  sizeM: { width: number; depth: number; height: number };
  originalM: { width: number; depth: number; height: number };
  userScale: number;
  resized: boolean;
  scale: TrueScale | null;
  placement: Placement;
}

export interface Snapshot {
  tracking: Tracking;
  mode: Mode;
  hint: string;
  canPlace: boolean;
  placingName: string | null;
  moving: boolean;
  loading: boolean;
  floorSet: boolean;
  items: ItemView[];
  selectedId: string | null;
  notice: string | null;
  diagnostics: Diagnostics;
}

export interface Diagnostics {
  granted: string[];
  requested: string[];
  anchored: boolean;
  surface: Surface | null;
  targetY: number | null;
  fps: number;
}

interface Target {
  hit: XRHitTestResult | null;
  world: THREE.Matrix4;
  local: THREE.Vector3;
  normal: THREE.Vector3;
  surface: Surface;
}

interface Item {
  id: string;
  variant: Variant | null;
  name: string;
  placement: Placement;
  size: { width: number; depth: number; height: number };
  baseSize: { width: number; depth: number; height: number };
  userScale: number;
  scale: TrueScale | null;
  group: THREE.Group;
  wall: { point: THREE.Vector3; normal: THREE.Vector3 } | null;
  picks: PartPicks;
  owned: { dispose: () => void }[];
}

interface Loaded {
  gltf: GLTF;
  box: THREE.Box3;
}

const UP_DOT = 0.94;
const WALL_DOT = 0.3;
const FLOOR_TOLERANCE = 0.15;
const MIN_FLOOR_DROP = 0.6;
const MAX_RAY = 12;
export const MAX_ITEMS = 12;
const EMIT_MS = 80;
const NOTICE_MS = 4500;

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

  private readonly room = new THREE.Group();
  private readonly roomInverse = new THREE.Matrix4();
  private readonly reticle: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;

  private hitTestSource: XRHitTestSource | null = null;
  private anchor: XRAnchor | null = null;
  private readonly cameraWorld = new THREE.Matrix4();
  private readonly projectionInverse = new THREE.Matrix4();

  private tracking: Tracking = "lost";
  private mode: Mode = "idle";
  private floorSet = false;
  private lowestHorizontal = Infinity;
  private target: Target | null = null;
  private fps = 0;
  private frames = 0;
  private fpsSince = 0;
  private placing: Variant | null = null;
  private placingPicks: PartPicks = {};
  private movingId: string | null = null;
  private items: Item[] = [];
  private selectedId: string | null = null;
  private loadingCount = 0;
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

    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.environment.texture;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.2));

    this.room.matrixAutoUpdate = false;
    this.room.visible = false;
    this.scene.add(this.room);

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

    this.reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.075, 0.09, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false }),
    );
    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
    this.reticle.renderOrder = 10;
    this.scene.add(this.reticle);
  }

  // ---- lifecycle -----------------------------------------------------------

  async start() {
    const onEnd = () => this.dispose();
    this.session.addEventListener("end", onEnd);
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

  arm(variant: Variant, picks: PartPicks = {}) {
    if (this.items.length >= MAX_ITEMS) return this.say(`You can place up to ${MAX_ITEMS} pieces at once. Delete one to add another.`);
    void this.load(variant.model.url).catch(() => {});
    this.setMode("placing");
    this.placing = variant;
    this.placingPicks = picks;
    this.movingId = null;
  }

  cancel() {
    this.setMode("idle");
  }

  mark() {
    if (this.mode === "placing") return void this.place();
  }

  tap(x: number, y: number) {
    if (this.mode !== "idle") return this.mark();
    const ray = this.screenRay(x, y);
    this.select(ray ? (this.pick(ray)?.id ?? null) : null);
  }

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

  resizeSelected(scale: number): number | null {
    const item = this.selected();
    if (!item) return null;
    return this.applyScale(item, scale);
  }

  resizeSelectedToMm(axis: "width" | "depth" | "height", mm: number): number | null {
    const item = this.selected();
    if (!item) return null;
    const scale = scaleForSide(item.baseSize, axis, mm);
    return scale === null ? null : this.applyScale(item, scale);
  }

  resetSelectedSize(): number | null {
    const item = this.selected();
    if (!item) return null;
    return this.applyScale(item, 1);
  }

  private applyScale(item: Item, scale: number): number {
    const next = clampScale(scale);
    item.userScale = next;
    item.size = sizeAt(item.baseSize, next);
    item.group.scale.setScalar(next);
    this.reseatOnWall(item);
    item.group.updateMatrix();
    this.dirty = true;
    return next;
  }

  private reseatOnWall(item: Item) {
    if (!item.wall) return;
    const { point, normal } = item.wall;
    item.group.position.copy(point).addScaledVector(normal, item.size.depth / 2);
    item.group.position.y = Math.max(0, point.y - item.size.height / 2);
  }

  rotateSelected(radians: number) {
    const item = this.selected();
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
    if (item.userScale !== 1) this.applyScale(copy, item.userScale);
    const side = new THREE.Vector3(item.size.width + 0.1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), item.group.rotation.y);
    copy.group.position.copy(item.group.position).add(side);
    copy.group.rotation.y = item.group.rotation.y;
    copy.wall = item.wall && { point: item.wall.point.clone().add(side), normal: item.wall.normal.clone() };
    copy.group.updateMatrix();
    this.addItem(copy);
  }

  async changeVariant(variant: Variant) {
    const item = this.selected();
    if (!item?.variant || item.variant.id === variant.id) return;
    const next = await this.makeProduct(variant, item.picks);
    if (!next) return;
    if (item.userScale !== 1) this.applyScale(next, item.userScale);
    next.group.position.copy(item.group.position);
    next.group.rotation.y = item.group.rotation.y;
    next.wall = item.wall;
    next.group.updateMatrix();
    this.removeItem(item);
    this.addItem(next);
  }

  resetAll() {
    for (const item of [...this.items]) this.removeItem(item);
    this.selectedId = null;
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
      t = { ...t, local: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0) };
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

    const item = moving ?? await this.makeProduct(placing, this.placingPicks);
    if (!item || this.disposed) return;
    const { group, size } = item;
    if (item.placement === "wall") {
      const out = new THREE.Vector3(at.normal.x, 0, at.normal.z).normalize();
      group.rotation.y = Math.atan2(out.x, out.z);
      group.position.copy(at.position).addScaledVector(out, size.depth / 2);
      group.position.y = Math.max(0, at.position.y - size.height / 2);
      item.wall = { point: at.position.clone(), normal: out };
    } else {
      group.position.set(at.position.x, item.placement === "tabletop" ? at.position.y : 0, at.position.z);
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
    return this.placing ? placementOf(this.placing) : "floor";
  }

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
      .catch(() => {});
  }

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
      this.say(`${variant.product.name} can't be shown: its 3D model has no believable size.`);
      return null;
    }

    const owned: { dispose: () => void }[] = [];
    const model = gltf.scene.clone(true);
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

    model.rotation.y = scale.swapWidthDepth ? Math.PI / 2 : 0;
    model.scale.setScalar(scale.scale);
    model.updateMatrix();
    const fitted = box.clone().applyMatrix4(model.matrix);
    const centre = fitted.getCenter(new THREE.Vector3());
    model.position.set(-centre.x, -fitted.min.y, -centre.z);
    const size = fitted.getSize(new THREE.Vector3());

    const group = new THREE.Group();
    group.add(model);
    group.matrixAutoUpdate = false;
    group.visible = false;

    const sizeObj = { width: size.x, depth: size.z, height: size.y };
    return {
      id: `piece-${nextId++}`,
      variant,
      picks,
      name: variant.product.name,
      placement: placementOf(variant),
      size: sizeObj,
      baseSize: { ...sizeObj },
      userScale: 1,
      scale,
      group,
      wall: null,
      owned,
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

  // ---- rays ----------------------------------------------------------------

  private screenRay(x: number, y: number): THREE.Ray | null {
    if (this.tracking === "lost") return null;
    const ndcX = (x / window.innerWidth) * 2 - 1;
    const ndcY = -(y / window.innerHeight) * 2 + 1;
    const origin = new THREE.Vector3().setFromMatrixPosition(this.cameraWorld);
    const through = new THREE.Vector3(ndcX, ndcY, 0.5).applyMatrix4(this.projectionInverse).applyMatrix4(this.cameraWorld);
    return new THREE.Ray(origin, through.sub(origin).normalize()).applyMatrix4(this.roomInverse);
  }

  private onPlane(ray: THREE.Ray, plane: THREE.Plane): THREE.Vector3 | null {
    const point = ray.intersectPlane(plane, new THREE.Vector3());
    return point && point.distanceTo(ray.origin) <= MAX_RAY ? point : null;
  }

  private onSurfaceOf(ray: THREE.Ray, item: Item): THREE.Vector3 | null {
    const plane = item.wall
      ? new THREE.Plane().setFromNormalAndCoplanarPoint(item.wall.normal, item.wall.point)
      : new THREE.Plane(new THREE.Vector3(0, 1, 0), -item.group.position.y);
    return this.onPlane(ray, plane);
  }

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

  // ---- per frame -----------------------------------------------------------

  private onFrame(time: number, frame?: XRFrame) {
    if (!frame) return;
    try {
      this.update(time, frame);
    } catch (err) {
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
      if (tracking !== "ok") this.drag = null;
      this.dirty = true;
    }
    if (pose) {
      const view = pose.views[0];
      this.cameraWorld.fromArray(view.transform.matrix);
      this.projectionInverse.fromArray(view.projectionMatrix).invert();
    }

    if (space && this.anchor && frame.trackedAnchors?.has(this.anchor)) {
      const anchorPose = frame.getPose(this.anchor.anchorSpace, space);
      if (anchorPose) {
        this.room.matrix.fromArray(anchorPose.transform.matrix);
        this.room.matrixWorldNeedsUpdate = true;
        this.roomInverse.copy(this.room.matrix).invert();
      }
    }

    const aiming = this.mode === "placing";
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

  private floorTarget(): Target | null {
    const ray = this.screenRay(window.innerWidth / 2, window.innerHeight / 2);
    const point = ray && this.onPlane(ray, new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
    if (!point) return null;
    const world = new THREE.Matrix4().makeTranslation(point.x, 0, point.z).premultiply(this.room.matrix);
    return { hit: null, world, local: point, normal: new THREE.Vector3(0, 1, 0), surface: "floor" };
  }

  private findTarget(frame: XRFrame, space: XRReferenceSpace): Target | null {
    const hit = this.hitTestSource ? frame.getHitTestResults(this.hitTestSource)[0] : undefined;
    const hitPose = hit?.getPose(space);
    if (!hit || !hitPose) {
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
    const ok = t ? this.canPlace(t) : false;
    this.reticle.visible = Boolean(t);
    if (t) {
      if (t.surface === "floor" && this.floorSet) {
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
  }

  // ---- snapshot ------------------------------------------------------------

  private setMode(mode: Mode) {
    this.mode = mode;
    if (mode !== "placing") {
      this.placing = null;
      this.movingId = null;
    }
    this.dirty = true;
  }

  private say(text: string) {
    this.notice = { text, until: performance.now() + NOTICE_MS };
    this.dirty = true;
  }

  private hint(): string {
    if (this.tracking === "lost") return "Starting the camera…";
    if (this.tracking === "limited") return "Tracking lost. Move the phone slowly in good light.";
    const surface = this.target?.surface;
    switch (this.mode) {
      case "placing": {
        if (!this.target) return "Move the phone slowly to find the floor.";
        if (!this.floorSet) {
          return surface === "floor" ? "Tap to set the floor here." : surface === "wall" ? "That's a wall. Point at the floor." : "That looks raised. Point at the floor.";
        }
        const placement = this.placementOfPlacing();
        if (this.canPlace(this.target)) return `Tap to place ${this.placingName() ?? "it"}.`;
        if (placement === "wall") return "Point at a wall.";
        if (placement === "tabletop") return "Point at a table or the floor.";
        if (surface === "wall") return "That's a wall. Point at the floor.";
        return "Point at the floor.";
      }
      default:
        if (!this.items.length) return "Add a piece of furniture to begin.";
        return "Tap a piece to select it. Drag to move, twist to turn.";
    }
  }

  private placingName(): string | null {
    return this.placing ? this.placing.product.name : null;
  }

  private emit() {
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
        name: i.name,
        variant: i.variant,
        sizeM: i.size,
        originalM: i.baseSize,
        userScale: i.userScale,
        resized: isResized(i.userScale),
        scale: i.scale,
        placement: i.placement,
      })),
      selectedId: this.selectedId,
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
