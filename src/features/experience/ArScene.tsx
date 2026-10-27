
import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";

import { sheenFactor, tintFactor, type Recolor, type TintMaterial } from "@/lib/color";

type Phase = "loading" | "scanning" | "placed" | "error";

export interface ArSceneProps {
  /** GLB to place — the stable /api/variants/<id>/model route. */
  src: string;
  /** Live XRSession, created from the user gesture by the caller. */
  session: XRSession;
  /** Called once the session has ended, for any reason. */
  onEnd: () => void;
  /** Colour to show the model's recolourable materials in, if any. */
  recolor?: readonly Recolor[] | null;
}

/** Pinch limits, relative to the model's authored (real-world) size. */
const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
/** Movement under this many pixels still counts as a tap, not a drag. */
const TAP_SLOP_PX = 10;

/**
 * In-page WebXR AR scene.
 *
 * The camera passthrough is composited by the XR runtime and the product is
 * drawn into it by three.js, with this component's own HTML controls layered on
 * top via `dom-overlay` — so the whole experience stays inside the product page
 * instead of handing off to Scene Viewer or Quick Look.
 *
 * Placement is driven by `hit-test`: a reticle tracks real-world surfaces, and
 * a tap (or the Place button) drops the model there. The pose is written in the
 * session's `local` reference space, so the model stays anchored to that spot in
 * the room as the phone moves, rather than riding along with the camera.
 *
 * GLB units are meters, so the model is placed at authored scale; pinch adjusts
 * only within a clamped range around it.
 */
export default function ArScene({ src, session, onEnd, recolor }: ArSceneProps) {
  // Read when the model loads; a colour change mid-session must not restart AR.
  const recolorRef = useRef(recolor);
  recolorRef.current = recolor;
  const [phase, setPhase] = useState<Phase>("loading");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  // Bridge between the render loop (imperative, three.js) and the React UI.
  const apiRef = useRef<{
    place: () => void;
    rearm: () => void;
    rotateBy: (radians: number) => void;
    scaleBy: (factor: number) => void;
  } | null>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import(
        "three/examples/jsm/loaders/GLTFLoader.js"
      );
      const { RoomEnvironment } = await import(
        "three/examples/jsm/environments/RoomEnvironment.js"
      );
      if (disposed) return;

      const canvas = document.createElement("canvas");
      canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%";
      document.body.appendChild(canvas);

      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
      });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType("local");

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(70, 1, 0.01, 100);

      // Image-based lighting, so PBR materials do not read as flat cutouts
      // pasted over the camera feed.
      const pmrem = new THREE.PMREMGenerator(renderer);
      const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = environment.texture;

      scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.2));
      const key = new THREE.DirectionalLight(0xffffff, 1.6);
      key.position.set(1.5, 3, 1.5);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.far = 20;
      key.shadow.bias = -0.0005;
      scene.add(key, key.target);

      // Reticle: a flat ring lying on whatever surface the hit-test found.
      const reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.075, 0.09, 40).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.9,
        }),
      );
      reticle.matrixAutoUpdate = false;
      reticle.visible = false;
      scene.add(reticle);

      // One root for everything placed, so move/rotate/scale stay a single
      // transform rather than per-mesh edits.
      const root = new THREE.Group();
      root.visible = false;
      scene.add(root);

      // Catches the key light so the product reads as standing ON the floor.
      const shadowCatcher = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2),
        new THREE.ShadowMaterial({ opacity: 0.28 }),
      );
      shadowCatcher.receiveShadow = true;
      root.add(shadowCatcher);

      let currentScale = 1;
      let placed = false;

      new GLTFLoader().load(
        src,
        (gltf) => {
          if (disposed) return;
          const model = gltf.scene;
          // glTF material index → its tint data and colour, when this variant recolours it.
          const tinted = new Map<number, { m: TintMaterial; hex: string }>(
            (recolorRef.current ?? []).flatMap((r) => r.tint.materials.map((m) => [m.index, { m, hex: r.hex }] as const)),
          );
          model.traverse((child) => {
            const mesh = child as import("three").Mesh;
            if (mesh.isMesh) {
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              for (const material of [mesh.material].flat()) {
                const index = gltf.parser.associations.get(material)?.materials;
                const entry = index === undefined ? undefined : tinted.get(index);
                if (!entry) continue;
                const { m, hex } = entry;
                const physical = material as import("three").MeshPhysicalMaterial;
                physical.color.setRGB(...tintFactor(hex, m.texAvg));
                const sheen = sheenFactor(hex, m);
                if (sheen && physical.sheenColor) physical.sheenColor.setRGB(...sheen);
              }
            }
          });
          // Rest the model's base on the plane however it was authored.
          model.position.y -= new THREE.Box3().setFromObject(model).min.y;
          root.add(model);
          setPhase("scanning");
        },
        (event) => {
          if (event.total > 0) {
            setProgress(Math.round((event.loaded / event.total) * 100));
          }
        },
        () => {
          if (disposed) return;
          setMessage("Couldn't load the 3D model.");
          setPhase("error");
        },
      );

      const onSessionEnd = () => onEnd();
      session.addEventListener("end", onSessionEnd);

      await renderer.xr.setSession(session);
      const viewerSpace = await session.requestReferenceSpace("viewer");
      const hitTestSource = await session.requestHitTestSource?.({
        space: viewerSpace,
      });

      const place = () => {
        if (!reticle.visible) return;
        const position = new THREE.Vector3().setFromMatrixPosition(
          reticle.matrix,
        );
        root.position.copy(position);
        // Turn the product to face the viewer, so it is never placed back-on.
        const cameraPosition = camera.getWorldPosition(new THREE.Vector3());
        root.rotation.y = Math.atan2(
          cameraPosition.x - position.x,
          cameraPosition.z - position.z,
        );
        key.target.position.copy(position);
        root.visible = true;
        placed = true;
        setPhase("placed");
      };

      apiRef.current = {
        place,
        rearm: () => {
          placed = false;
          setPhase("scanning");
        },
        rotateBy: (radians) => {
          root.rotation.y += radians;
        },
        scaleBy: (factor) => {
          currentScale = Math.min(
            MAX_SCALE,
            Math.max(MIN_SCALE, currentScale * factor),
          );
          root.scale.setScalar(currentScale);
        },
      };

      // Backup path for runtimes without dom-overlay, where our HTML is not
      // shown and a screen tap arrives as an XR select instead.
      const onSelect = () => {
        if (!placed) place();
      };
      session.addEventListener("select", onSelect);

      renderer.setAnimationLoop((_time, frame) => {
        if (placed) {
          reticle.visible = false;
        } else if (frame && hitTestSource) {
          const referenceSpace = renderer.xr.getReferenceSpace();
          const hits = frame.getHitTestResults(hitTestSource);
          const pose =
            referenceSpace && hits.length > 0
              ? hits[0].getPose(referenceSpace)
              : null;
          if (pose) {
            reticle.visible = true;
            reticle.matrix.fromArray(pose.transform.matrix);
          } else {
            reticle.visible = false;
          }
        }
        renderer.render(scene, camera);
      });

      cleanup = () => {
        renderer.setAnimationLoop(null);
        session.removeEventListener("select", onSelect);
        session.removeEventListener("end", onSessionEnd);
        hitTestSource?.cancel();
        environment.texture.dispose();
        pmrem.dispose();
        renderer.dispose();
        canvas.remove();
      };
    })().catch(() => {
      if (!disposed) {
        setMessage("Couldn't start the AR session.");
        setPhase("error");
      }
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [src, session, onEnd]);

  // --- gestures ----------------------------------------------------------
  // The overlay receives the touches (dom-overlay puts our HTML above the
  // camera feed), so placement, rotation and scaling are all decided here.
  const touch = useRef({ x: 0, y: 0, startX: 0, startY: 0, pinch: 0 });

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      touch.current = {
        x: t.clientX,
        y: t.clientY,
        startX: t.clientX,
        startY: t.clientY,
        pinch: 0,
      };
    } else if (e.touches.length === 2) {
      touch.current.pinch = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
    }
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const api = apiRef.current;
      if (!api || phase !== "placed") return;
      if (e.touches.length === 2 && touch.current.pinch > 0) {
        const distance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        api.scaleBy(distance / touch.current.pinch);
        touch.current.pinch = distance;
      } else if (e.touches.length === 1) {
        const x = e.touches[0].clientX;
        api.rotateBy((x - touch.current.x) * 0.01);
        touch.current.x = x;
      }
    },
    [phase],
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      // Buttons handle themselves; a tap on bare overlay is a place gesture.
      if ((e.target as HTMLElement).closest("button")) return;
      if (phase !== "scanning") return;
      const changed = e.changedTouches[0];
      if (!changed) return;
      const moved = Math.hypot(
        changed.clientX - touch.current.startX,
        changed.clientY - touch.current.startY,
      );
      if (moved <= TAP_SLOP_PX) apiRef.current?.place();
    },
    [phase],
  );

  const stopSession = useCallback(() => {
    session.end().catch(() => onEnd());
  }, [session, onEnd]);

  return (
    <div
      className="fixed inset-0 flex flex-col justify-between"
      style={{ touchAction: "none" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex justify-end p-4">
        <button
          type="button"
          onClick={stopSession}
          className="rounded-full bg-black/70 px-4 py-2 text-sm font-medium text-white backdrop-blur"
        >
          Close
        </button>
      </div>

      <div className="flex flex-col items-center gap-3 p-5 pb-8 text-center">
        {phase === "loading" && (
          <p className="rounded-full bg-black/70 px-4 py-2 text-xs text-white backdrop-blur">
            Loading model{progress > 0 ? ` — ${progress}%` : "…"}
          </p>
        )}

        {phase === "scanning" && (
          <>
            <p className="rounded-full bg-black/70 px-4 py-2 text-xs text-white backdrop-blur">
              Point at the floor, then tap to place
            </p>
            <button
              type="button"
              onClick={() => apiRef.current?.place()}
              className="rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-black shadow-lg active:scale-95"
            >
              Place here
            </button>
          </>
        )}

        {phase === "placed" && (
          <>
            <p className="rounded-full bg-black/70 px-4 py-2 text-xs text-white backdrop-blur">
              Drag to rotate · pinch to resize
            </p>
            <button
              type="button"
              onClick={() => apiRef.current?.rearm()}
              className="rounded-full bg-white/90 px-6 py-3 text-sm font-semibold text-black shadow-lg active:scale-95"
            >
              Move
            </button>
          </>
        )}

        {phase === "error" && (
          <p className="rounded-full bg-red-600/90 px-4 py-2 text-xs text-white">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
