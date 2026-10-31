import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { ArrowDown } from 'lucide-react';
import type { Brand } from '@/data/brands';
import { SECTION, photoProps, type Photo, type Showroom } from '@/data/showrooms';
import { useScrollProgress } from '@/hooks/useScrollProgress';
import { prefersReducedMotion, scrollToSection } from './scroll';
import { cn } from '@/lib/cn';

/*
 * "Enter the shop": a pinned, scroll-driven walk from the street into the showroom.
 *
 * HONEST ABOUT THE ASSETS. This is not a 3D walkthrough, and does not pretend to be.
 * The shop has (so far) no continuous walkthrough video, rendered frame sequence or
 * 3D model of its interior, only still photographs. So the section is built from:
 *   1. a drawn shop front (sign, display windows, glass doors) with the first
 *      photograph seen through the doors;
 *   2. a camera dolly through the doorway: the whole shop front scales up around the
 *      door as the doors slide open, then hands over to the full-screen photo;
 *   3. a slow push from one interior photo to the next, cross-fading between them.
 * The cut from photo to photo is a film edit, not continuous motion, and reads best
 * when the photos are taken walking in through the real shop, in order.
 *
 * When the shop has better material, swap it in through `Showroom.walkthrough`
 * (src/data/showrooms.ts), not by rewriting this file:
 *   - more / better photos: add frames;
 *   - a walkthrough video: `{ kind: 'video', … }` and it is scrubbed by scroll instead.
 */

/** 0 → 1 as `p` moves from `a` to `b`, clamped. */
const range = (p: number, [a, b]: readonly [number, number]) => Math.min(1, Math.max(0, (p - a) / (b - a)));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/* The scroll timeline, as fractions of the section's scroll distance. */
const HINT = [0, 0.035] as const; // "scroll to step inside" fades away
const DOORS = [0.03, 0.15] as const; // the glass doors slide open
const DOLLY = [0.02, 0.33] as const; // the camera walks up to, then through, the doorway
const THROUGH = [0.25, 0.34] as const; // the shop front gives way to the interior
const INTERIOR = [0.3, 0.95] as const; // interior photos, one after another
const OUTRO = [0.93, 1] as const; // the stage fades into the page colour below

/* ----------------------------------------------------------- shop front */

interface PortalGeometry {
  cx: number;
  cy: number;
  /** Zoom at which the doorway overfills the screen. */
  through: number;
  width: number;
  height: number;
}

/**
 * Where the doorway sits in the (untransformed) scene. Uses offset* values, which
 * ignore CSS transforms, so the measurement is right whatever the camera is doing.
 */
function usePortalGeometry(scene: RefObject<HTMLDivElement>, portal: RefObject<HTMLDivElement>) {
  const [geometry, setGeometry] = useState<PortalGeometry | null>(null);

  useLayoutEffect(() => {
    const root = scene.current;
    if (!root) return;
    const measure = () => {
      const door = portal.current;
      if (!door || root.offsetWidth === 0) return;
      let x = 0;
      let y = 0;
      for (let el: HTMLElement | null = door; el && el !== root; el = el.offsetParent as HTMLElement | null) {
        x += el.offsetLeft;
        y += el.offsetTop;
      }
      const w = door.offsetWidth;
      const h = door.offsetHeight;
      setGeometry({
        cx: x + w / 2,
        cy: y + h / 2,
        through: Math.max(root.offsetWidth / w, root.offsetHeight / h) * 1.1,
        width: root.offsetWidth,
        height: root.offsetHeight,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [scene, portal]);

  return geometry;
}

/** A display window: a photograph behind glass in a slim bronze frame, over a solid stall riser. */
function DisplayWindow({ photo, className }: { photo: Photo; className?: string }) {
  return (
    <div className={cn('flex flex-col', className)}>
      <div className="relative flex-1 overflow-hidden border border-[#8c6a4f]/55 bg-night">
        <img {...photoProps(photo, '30vw')} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-75" />
        {/* Evening glass: a warm wash from inside, a cool reflection across the pane. */}
        <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_30%,rgb(255_196_128/0.18),transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(112deg,transparent_28%,rgb(255_255_255/0.13)_40%,transparent_52%)]" />
      </div>
      {/* The solid panel under the glass that makes it a shop window, not a door. */}
      <div className="h-[22%] border-x border-b border-[#8c6a4f]/40 bg-[linear-gradient(to_bottom,#2c2924,#24211d)]" />
    </div>
  );
}

function ShopFront({
  brand,
  signage,
  frames,
  doorsOpen,
  portalRef,
}: {
  brand: Brand;
  signage: string;
  frames: readonly Photo[];
  doorsOpen: number;
  portalRef: RefObject<HTMLDivElement>;
}) {
  const inside = frames[0];
  const left = frames[1] ?? frames[0];
  const right = frames[2] ?? frames[frames.length - 1];

  return (
    <>
      {/* Evening sky over the street. */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#151412,#24211d_55%,#2f2b25)]" />

      {/* The building. Plain insets and flex, no transforms, so the doorway can be measured. */}
      <div className="absolute inset-x-0 bottom-[13%] top-[12%] flex flex-col md:inset-x-[7%] md:top-[14%]">
        {/* Fascia with the shop's name, lit from below. */}
        <div className="relative flex h-[19%] flex-col items-center justify-center border-b border-[#8c6a4f]/40 bg-[#1b1a17] text-ivory">
          <span className="store-mark text-[clamp(1.5rem,4.6vw,3.6rem)] leading-none tracking-[0.02em]">{brand.legalName}</span>
          <span className="mt-[0.6em] text-[clamp(8px,0.95vw,12px)] uppercase tracking-[0.42em] text-ivory/55">
            {signage} · {brand.city}
          </span>
          <span className="absolute inset-x-[20%] -bottom-6 h-12 rounded-full bg-[rgb(255_190_120/0.16)] blur-2xl" />
        </div>

        {/* Shop front: two display windows either side of the glass doors. */}
        <div className="grid flex-1 grid-cols-[16%_1fr_16%] gap-[1.4%] bg-[#22201c] px-[1.4%] pt-[1.4%] sm:grid-cols-[1fr_26%_1fr] sm:gap-[2.4%] sm:px-[2.4%] sm:pt-[2.4%]">
          <DisplayWindow photo={left} />

          <div ref={portalRef} className="relative overflow-hidden border-[clamp(4px,0.55vw,8px)] border-[#7a5c43] bg-night">
            {/* Full-size image: the camera ends up filling the screen with this doorway. */}
            <img {...photoProps(inside)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            <span
              className="absolute left-1/2 top-[7%] z-10 -translate-x-1/2 border border-[#b58c63]/70 bg-night/80 px-[0.8em] py-[0.3em] text-[clamp(7px,0.75vw,11px)] uppercase tracking-[0.3em] text-ivory/85"
              style={{ opacity: 1 - doorsOpen }}
            >
              Open
            </span>
            <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_35%,rgb(255_200_140/0.16),transparent_70%)]" />
            {/* Sliding glass leaves: each slides out sideways behind the window walls. */}
            {(['left', 'right'] as const).map((side) => (
              <div
                key={side}
                className={cn('absolute inset-y-0 w-1/2 border-[#8c6a4f]/70 bg-[rgb(20_20_18/0.38)]', side === 'left' ? 'left-0 border-r' : 'right-0 border-l')}
                style={{ transform: `translateX(${(side === 'left' ? -1 : 1) * doorsOpen * 100}%)` }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(112deg,transparent_25%,rgb(255_255_255/0.12)_40%,transparent_55%)]" />
                <span className={cn('absolute top-[46%] h-[16%] w-[3px] rounded-full bg-[#b58c63]', side === 'left' ? 'right-[10%]' : 'left-[10%]')} />
              </div>
            ))}
          </div>

          <DisplayWindow photo={right} />
        </div>

        {/* Stone step. */}
        <div className="h-[3.5%] bg-[#3a362f]" />
      </div>

      {/* Pavement, with light spilling out of the shop. */}
      <div className="absolute inset-x-0 bottom-0 h-[13%] bg-[#2a2722]">
        <div className="absolute inset-x-[25%] top-0 h-full bg-[radial-gradient(60%_100%_at_50%_0%,rgb(255_190_120/0.2),transparent_70%)]" />
      </div>
    </>
  );
}

/** The bottom of the stage dissolves into the page, so the collection follows on without a seam. */
const Outro = ({ amount }: { amount: number }) => (
  <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-surface to-transparent" style={{ opacity: amount }} />
);

function ScrollHint({ visible }: { visible: number }) {
  return (
    <div className="absolute inset-x-0 bottom-[3%] flex flex-col items-center gap-2 text-ivory/70" style={{ opacity: visible }}>
      <span className="text-[11px] uppercase tracking-[0.3em]">Scroll to step inside</span>
      <ArrowDown size={15} aria-hidden className="animate-bounce" />
      <button
        type="button"
        onClick={() => scrollToSection(SECTION.collection)}
        tabIndex={visible > 0.5 ? undefined : -1}
        className="text-xs underline underline-offset-4 transition-colors hover:text-ivory"
      >
        Skip to the collection
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ photo walk */

function FramesWalk({ brand, showroom, frames }: { brand: Brand; showroom: Showroom; frames: (Photo & { caption: string })[] }) {
  const { ref, progress: p } = useScrollProgress<HTMLElement>();
  const sceneRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const portal = usePortalGeometry(sceneRef, portalRef);

  // Walking at a steady pace makes the shop front grow geometrically, not linearly.
  const walk = easeInOut(range(p, DOLLY));
  const zoom = portal ? portal.through ** walk : 1;
  // Bring the doorway to the middle of the screen early, so the last stretch is straight ahead.
  const centre = easeOut(Math.min(1, walk * 1.7));
  const sceneTransform = portal
    ? `translate(${lerp(portal.cx, portal.width / 2, centre) - zoom * portal.cx}px, ${lerp(portal.cy, portal.height / 2, centre) - zoom * portal.cy}px) scale(${zoom})`
    : undefined;
  // Through the door: the shop front gives way to a burst of warm light, and the interior comes up out of it.
  // (A straight cross-fade would show the doorway crop and the full-screen photo as a double image.)
  const through = range(p, THROUGH);
  const front = 1 - range(through, [0, 0.55]);
  const bloom = Math.sin(Math.PI * through) * 0.92;

  // Each interior photo gets an equal share of the interior stretch, overlapping its neighbours by a short cross-fade.
  const share = (INTERIOR[1] - INTERIOR[0]) / frames.length;
  const fade = Math.min(0.04, share * 0.3);
  // Dip slightly darker at each cut, like a film dissolve, rather than a double exposure.
  const dip = frames.slice(1).reduce((d, _, i) => {
    const cut = INTERIOR[0] + (i + 1) * share;
    return Math.max(d, 1 - Math.min(1, Math.abs(p - cut) / (fade * 0.75)));
  }, 0);
  const current = Math.min(frames.length - 1, Math.max(0, Math.floor((p - INTERIOR[0]) / share)));

  return (
    <section
      ref={ref}
      id={SECTION.showroom}
      aria-label={`Walk into ${brand.legalName}`}
      aria-describedby="walkthrough-note"
      className="relative h-[460svh] bg-night md:h-[560svh]"
    >
      <p id="walkthrough-note" className="sr-only">
        A scrolling walk from the street, through the shop doors, past the showroom floor. Keep scrolling, or skip to the collection.
      </p>
      <div className="sticky top-0 h-[100svh] min-h-[520px] overflow-hidden bg-night">
        {/* Interior photographs, under the shop front. */}
        {frames.map((frame, i) => {
          const start = INTERIOR[0] + i * share;
          const end = start + share;
          const fadeIn = i === 0 ? range(through, [0.45, 1]) : range(p, [start - fade / 2, start + fade / 2]);
          const fadeOut = i === frames.length - 1 ? 1 : 1 - range(p, [end - fade / 2, end + fade / 2]);
          const opacity = Math.min(fadeIn, fadeOut);
          // A steady push towards the furniture while the photo is on screen.
          const push = range(p, [start - fade, end + fade]);
          const scale = (i === 0 ? lerp(1.08, 1.22, push) : lerp(1.02, 1.18, push)) + (1 - fadeOut) * 0.08;
          // Always mounted (just transparent), so every photo has loaded before its turn comes.
          return (
            <img
              key={frame.base}
              {...photoProps(frame)}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover will-change-transform"
              style={{ opacity, transform: `scale(${scale})`, transformOrigin: frame.focus ?? '50% 50%' }}
            />
          );
        })}
        {/* Darken toward the foot for the caption. */}
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_top,rgb(var(--night)/0.6),transparent_45%)]" />
        <div aria-hidden className="absolute inset-0 bg-night" style={{ opacity: dip * 0.4 }} />

        {/* Where we are on the walk; fades out as the stage dissolves into the collection. */}
        <div
          className="absolute bottom-[7%] left-5 flex items-baseline gap-4 text-ivory sm:left-8 md:left-12"
          style={{ opacity: range(p, [INTERIOR[0] + 0.02, INTERIOR[0] + 0.05]) * (1 - range(p, OUTRO)) }}
          aria-hidden
        >
          <span className="text-xs tabular-nums tracking-[0.2em] text-ivory/60">
            {String(current + 1).padStart(2, '0')} / {String(frames.length).padStart(2, '0')}
          </span>
          <span key={current} className="font-display text-[clamp(1.6rem,3.2vw,2.6rem)] leading-none">
            {frames[current].caption}
          </span>
        </div>

        {/* The shop front, until we are through the door. Hidden, not unmounted: the doorway keeps being measured. */}
        <div aria-hidden className="absolute inset-0" style={{ opacity: front, visibility: front > 0 ? undefined : 'hidden' }}>
          <div ref={sceneRef} className="absolute inset-0 origin-top-left will-change-transform" style={{ transform: sceneTransform }}>
            <ShopFront brand={brand} signage={showroom.signage.line} frames={frames} doorsOpen={easeInOut(range(p, DOORS))} portalRef={portalRef} />
          </div>
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[#f3e9d8]" style={{ opacity: bloom }} />

        <ScrollHint visible={1 - range(p, HINT)} />
        <Outro amount={range(p, OUTRO)} />

        {/* Walk progress. */}
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-ivory/10">
          <div className="h-full origin-left bg-ivory/60" style={{ transform: `scaleX(${p})` }} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ video walk */

/** A real walkthrough video, its playhead tied to scroll position. */
function VideoWalk({ brand, src, poster }: { brand: Brand; src: string; poster: Photo }) {
  const { ref, progress: p } = useScrollProgress<HTMLElement>();
  const video = useRef<HTMLVideoElement>(null);
  const playEnd = INTERIOR[1];

  useEffect(() => {
    const v = video.current;
    if (!v || !Number.isFinite(v.duration) || v.duration === 0) return;
    v.currentTime = Math.min(v.duration - 0.05, range(p, [0, playEnd]) * v.duration);
  }, [p, playEnd]);

  return (
    <section ref={ref} id={SECTION.showroom} aria-label={`Walk into ${brand.legalName}`} className="relative h-[460svh] bg-night md:h-[560svh]">
      <div className="sticky top-0 h-[100svh] min-h-[520px] overflow-hidden bg-night">
        <video
          ref={video}
          src={src}
          poster={photoProps(poster).src}
          muted
          playsInline
          preload="auto"
          aria-label={poster.alt}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <ScrollHint visible={1 - range(p, HINT)} />
        <Outro amount={range(p, OUTRO)} />
      </div>
    </section>
  );
}

export function ShowroomWalkthrough({ brand, showroom }: { brand: Brand; showroom: Showroom }) {
  const [reduced] = useState(prefersReducedMotion);
  const w = showroom.walkthrough;

  // Reduced motion: no walk at all. An empty anchor keeps "Explore the Showroom" links landing on the collection.
  if (reduced) return <div id={SECTION.showroom} aria-hidden />;
  if (w.kind === 'video') return <VideoWalk brand={brand} src={w.src} poster={w.poster} />;
  return <FramesWalk brand={brand} showroom={showroom} frames={w.frames} />;
}
