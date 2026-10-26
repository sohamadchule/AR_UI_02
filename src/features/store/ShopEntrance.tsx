import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { storeExperiencePath, type Brand } from '@/data/brands';
import { useScrollProgress } from '@/hooks/useScrollProgress';

export interface Room {
  slug: string;
  name: string;
  count: number;
}

/** 0 → 1 as `p` moves from `start` to `end`, clamped. */
const range = (p: number, [start, end]: readonly [number, number]) => Math.min(1, Math.max(0, (p - start) / (end - start)));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/* The scroll timeline, as fractions of the section's scroll distance. */
const HINT = [0, 0.05] as const; // "scroll to step inside" fades away
const DOLLY = [0.03, 0.66] as const; // the camera walks up to, then through, the doorway
const DOORS = [0.08, 0.36] as const; // the doors swing open as we approach
const FADE = [0.5, 0.64] as const; // the street gives way to the showroom
const WELCOME = [0.58, 0.8] as const; // the showroom copy settles in; the rest is a pause to look around

/** Warm light from inside the shop: the doorway, the windows and the showroom all share it, so the hand-off is seamless. */
const SHOWROOM_LIGHT =
  'radial-gradient(120% 90% at 50% 30%, rgb(var(--accent) / 0.22), transparent 60%), rgb(var(--surface-raised))';

/** Where the doorway sits in the street scene, in the scene's own (untransformed) pixels. */
interface DoorGeometry {
  cx: number;
  cy: number;
  /** Zoom at which the open doorway overfills the screen. */
  through: number;
  width: number;
  height: number;
}

/**
 * Measures the doorway relative to the scene. Both rects carry the scene's current
 * transform (origin 0 0, uniform scale), so dividing by that scale recovers layout
 * pixels whatever the scroll position was when this ran.
 */
function useDoorGeometry(scene: RefObject<HTMLDivElement>, door: RefObject<HTMLDivElement>) {
  const [geometry, setGeometry] = useState<DoorGeometry | null>(null);

  useLayoutEffect(() => {
    const node = scene.current;
    if (!node) return;
    const measure = () => {
      const doorway = door.current;
      if (!doorway || node.offsetWidth === 0) return;
      const s = node.getBoundingClientRect();
      const d = doorway.getBoundingClientRect();
      const scale = s.width / node.offsetWidth;
      const w = d.width / scale;
      const h = d.height / scale;
      setGeometry({
        cx: (d.left - s.left) / scale + w / 2,
        cy: (d.top - s.top) / scale + h / 2,
        through: Math.max(node.offsetWidth / w, node.offsetHeight / h) * 1.3,
        width: node.offsetWidth,
        height: node.offsetHeight,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [scene, door]);

  return geometry;
}

function usePrefersReducedMotion() {
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  return reduced;
}

/* ------------------------------------------------------------------ street */

function Sofa({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 52" className={className} fill="currentColor" aria-hidden>
      <rect x="14" y="6" width="92" height="26" rx="6" />
      <rect x="4" y="18" width="18" height="26" rx="5" />
      <rect x="98" y="18" width="18" height="26" rx="5" />
      <rect x="18" y="28" width="84" height="16" rx="3" />
      <rect x="10" y="44" width="4" height="8" />
      <rect x="106" y="44" width="4" height="8" />
    </svg>
  );
}

function ChairAndLamp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 72" className={className} fill="currentColor" aria-hidden>
      <path d="M86 4h22l6 16H80z" />
      <rect x="96" y="20" width="2" height="48" />
      <rect x="89" y="68" width="16" height="3" rx="1.5" />
      <rect x="18" y="20" width="44" height="30" rx="7" />
      <rect x="10" y="38" width="60" height="16" rx="4" />
      <rect x="14" y="54" width="3" height="16" />
      <rect x="63" y="54" width="3" height="16" />
    </svg>
  );
}

/** A Jaipur jaali: a lattice of small pierced circles in the lime-plaster trim. */
const JAALI: CSSProperties = {
  backgroundImage: 'radial-gradient(circle, transparent 38%, rgb(var(--haveli-trim)) 41%)',
  backgroundSize: '12px 12px',
};

/** A display window: the showroom light, a piece of furniture, and a reflection across the glass. */
function ShopWindow({ decal, haveli, children }: { decal: string; haveli: boolean; children: ReactNode }) {
  const frame = haveli ? 'border-[rgb(var(--haveli-trim))]' : 'border-fg/85';
  return (
    <div className="flex h-[88%] flex-col self-end">
      <div
        className={`relative flex-1 overflow-hidden border-[clamp(3px,0.6vw,7px)] ${frame} ${haveli ? 'rounded-t-full' : ''}`}
        style={{ background: SHOWROOM_LIGHT }}
      >
        {haveli && <div className="absolute inset-x-0 top-0 h-[30%] opacity-80" style={JAALI} />}
        <span
          className={`absolute inset-x-0 text-center text-[clamp(6px,0.85vw,11px)] font-semibold uppercase tracking-[0.2em] text-accent ${haveli ? 'top-[36%]' : 'top-[9%]'}`}
        >
          {decal}
        </span>
        {children}
        <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgb(255_255_255/0.16)_42%,transparent_56%)]" />
      </div>
      <div className={`h-[16%] border-x-[clamp(3px,0.6vw,7px)] ${frame} bg-fg/15`} />
    </div>
  );
}

function DoorLeaf({ side, open, haveli }: { side: 'left' | 'right'; open: number; haveli: boolean }) {
  const left = side === 'left';
  return (
    <div
      className={`absolute inset-y-0 w-1/2 ${left ? 'left-0 origin-left' : 'right-0 origin-right'}`}
      style={{ transform: `rotateY(${(left ? -1 : 1) * open * 102}deg)` }}
    >
      {haveli ? (
        // Carved sheesham, brass studs, ring pulls: a haveli door, not shop glass.
        <div className="relative h-full border-[clamp(2px,0.4vw,5px)] border-[#3d2414] bg-[#6b3f24]">
          <div
            className="absolute inset-[9%] border border-[#8a5a36]"
            style={{
              backgroundImage: 'radial-gradient(circle, #d9a441 0 22%, transparent 26%)',
              backgroundSize: '14px 14px',
              backgroundPosition: '3px 3px',
            }}
          />
          <span
            className={`absolute top-[48%] aspect-square w-[18%] rounded-full border-[clamp(2px,0.3vw,4px)] border-[#d9a441] ${left ? 'right-[6%]' : 'left-[6%]'}`}
          />
        </div>
      ) : (
        <div className="relative h-full border-[clamp(3px,0.55vw,7px)] border-fg/85 bg-fg/[0.08]">
          <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_25%,rgb(255_255_255/0.14)_40%,transparent_55%)]" />
          <span className={`absolute top-[44%] h-[18%] w-[7%] rounded-full bg-accent ${left ? 'right-[9%]' : 'left-[9%]'}`} />
          <div className="absolute inset-x-0 bottom-0 h-[13%] bg-fg/85" />
          {!left && (
            <span className="absolute left-1/2 top-[18%] -translate-x-1/2 rounded-sm border border-accent/60 bg-surface/90 px-[0.6em] py-[0.25em] text-[clamp(6px,0.75vw,11px)] font-semibold uppercase tracking-[0.18em] text-accent">
              Open
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The shop front, drawn in the brand's own tokens. Two styles: a high-street
 * shop (sign, striped awning, glass doors) and a Jaipur haveli (pink sandstone,
 * lime-plaster trim, arched jaali windows, carved doors under an arched transom).
 */
function Storefront({ brand, open, doorRef }: { brand: Brand; open: number; doorRef: RefObject<HTMLDivElement> }) {
  const haveli = brand.facade === 'haveli';
  const wall = haveli
    ? 'bg-[rgb(var(--haveli-wall))] bg-[repeating-linear-gradient(0deg,rgb(0_0_0/0.05)_0_1px,transparent_1px_26px)]'
    : 'bg-surface-sunken bg-[repeating-linear-gradient(0deg,rgb(var(--fg)/0.035)_0_1px,transparent_1px_22px)]';
  const neighbour = haveli ? 'bg-[rgb(var(--haveli-wall)/0.45)]' : 'bg-fg/[0.05]';

  return (
    <div className="absolute bottom-[24%] left-1/2 aspect-[4/5] w-[min(86vw,1000px,118svh)] -translate-x-1/2 sm:bottom-[14%] sm:aspect-[16/10]">
      {/* Neighbouring buildings, so the shop sits on a street rather than in a void. */}
      <div className={`absolute bottom-0 right-full h-[82%] w-[50vw] ${neighbour} bg-[repeating-linear-gradient(90deg,transparent_0_44px,rgb(var(--fg)/0.05)_44px_46px)]`} />
      <div className={`absolute bottom-0 left-full h-[68%] w-[50vw] ${neighbour} bg-[repeating-linear-gradient(0deg,transparent_0_40px,rgb(var(--fg)/0.05)_40px_42px)]`} />

      <div className={`relative flex h-full flex-col ${wall} shadow-[0_30px_80px_-30px_rgb(0_0_0/0.45)]`}>
        {haveli ? (
          // A parapet of small domes along the roofline.
          <div
            className="-mx-[1.5%] h-[5%]"
            style={{
              background: 'radial-gradient(circle at 50% 100%, rgb(var(--haveli-trim)) 0 48%, transparent 50%) 0 0 / 5% 100% repeat-x',
              borderBottom: '3px solid rgb(var(--haveli-trim))',
            }}
          />
        ) : (
          <div className="-mx-[2%] h-[5%] bg-fg/85" />
        )}

        <div className="grid h-[19%] place-items-center px-[9%] py-[2.5%]">
          <div
            className={`grid h-full w-full place-items-center rounded-store bg-fg text-surface ${haveli ? 'outline outline-[3px] outline-offset-[3px] outline-[rgb(var(--haveli-trim))]' : ''}`}
            style={{ boxShadow: '0 0 60px -10px rgb(var(--accent) / 0.45)' }}
          >
            <div className="text-center leading-none">
              <span className="store-mark block whitespace-nowrap text-[clamp(1.1rem,4.4vw,3.1rem)]">
                {/* On the haveli the second half is painted in the sandstone; the brand accent is too dark on the board. */}
                {brand.mark[0]} <span className={haveli ? 'text-[rgb(var(--haveli-wall))]' : 'text-accent'}>{brand.mark[1]}</span>
              </span>
              <span className="mt-[0.5em] block text-[clamp(6px,0.9vw,11px)] uppercase tracking-[0.3em] opacity-70">
                Furniture · {brand.city} · Since {brand.about.since}
              </span>
            </div>
          </div>
        </div>

        {haveli ? (
          // A scalloped eave (chhajja) in place of an awning.
          <div
            className="-mx-[1%] h-[6%] bg-[rgb(var(--haveli-trim))] shadow-[0_14px_20px_-12px_rgb(0_0_0/0.35)]"
            style={{
              WebkitMask: 'radial-gradient(circle at 50% 100%, transparent 0 34%, #000 36%) 0 0 / 4% 100% repeat-x',
              mask: 'radial-gradient(circle at 50% 100%, transparent 0 34%, #000 36%) 0 0 / 4% 100% repeat-x',
            }}
          />
        ) : (
          <div
            className="-mx-[1%] h-[9%] bg-[repeating-linear-gradient(90deg,rgb(var(--accent))_0_6%,rgb(var(--surface))_6%_12%)] shadow-[0_14px_20px_-12px_rgb(0_0_0/0.35)]"
            style={{ clipPath: 'polygon(3% 0, 97% 0, 100% 100%, 0 100%)' }}
          />
        )}

        <div className="grid flex-1 grid-cols-[1fr_34%_1fr] gap-[3.5%] px-[5%] pt-[4%] sm:grid-cols-[1fr_24%_1fr]">
          <ShopWindow decal="Living · Dining" haveli={haveli}>
            <Sofa className="absolute bottom-[6%] left-[10%] w-[80%] text-accent/85" />
          </ShopWindow>

          <div
            ref={doorRef}
            className={`relative border-[clamp(4px,0.7vw,9px)] border-b-0 ${haveli ? 'rounded-t-full border-[rgb(var(--haveli-trim))]' : 'border-fg/85'}`}
          >
            <div className={`absolute inset-0 ${haveli ? 'rounded-t-full' : ''}`} style={{ background: SHOWROOM_LIGHT }} />
            {haveli && (
              <div
                className="absolute inset-x-0 top-0 h-[26%] rounded-t-full border-b-[clamp(3px,0.5vw,6px)] border-[rgb(var(--haveli-trim))]"
                style={JAALI}
              />
            )}
            <div className={`absolute inset-x-0 bottom-0 ${haveli ? 'top-[26%]' : 'top-0'}`} style={{ perspective: '900px' }}>
              <DoorLeaf side="left" open={open} haveli={haveli} />
              <DoorLeaf side="right" open={open} haveli={haveli} />
            </div>
          </div>

          <ShopWindow decal="Try it in AR" haveli={haveli}>
            <ChairAndLamp className="absolute bottom-[6%] left-[12%] w-[76%] text-fg/55" />
          </ShopWindow>
        </div>

        <div className={`-mx-[1%] h-[4%] ${haveli ? 'bg-[rgb(var(--haveli-trim))]' : 'bg-fg/20'}`} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- showroom */

function Showroom({
  brand,
  rooms,
  onRoom,
  reveal,
}: {
  brand: Brand;
  rooms: readonly Room[];
  onRoom: (slug: string) => void;
  /** 0 → 1: the copy fades and rises into place. */
  reveal: number;
}) {
  const copy: CSSProperties = { opacity: reveal, transform: `translateY(${(1 - reveal) * 28}px)` };

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: SHOWROOM_LIGHT }}>
      {/* Floor boards, laid in perspective. */}
      <div
        aria-hidden
        className="absolute -inset-x-1/2 bottom-0 h-[34%] origin-bottom bg-accent/[0.08] bg-[repeating-linear-gradient(90deg,rgb(var(--fg)/0.07)_0_1px,transparent_1px_90px)]"
        style={{ transform: 'perspective(500px) rotateX(58deg)' }}
      />
      {/* Pieces on the showroom floor, either side of the welcome. */}
      <Sofa className="absolute bottom-[5%] left-[3%] hidden w-[min(22vw,320px)] text-accent/70 md:block" />
      <ChairAndLamp className="absolute bottom-[5%] right-[3%] hidden w-[min(20vw,290px)] text-fg/45 md:block" />
      {/* Pendant lights. */}
      {['18%', '50%', '82%'].map((left) => (
        <div key={left} aria-hidden className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left }}>
          <span className="h-[9vh] w-px bg-fg/25" />
          <span className="h-5 w-12 rounded-t-full bg-fg/80" />
          <span className="-mt-2 h-28 w-40 rounded-full bg-accent/25 blur-3xl" />
        </div>
      ))}

      <div className="relative mx-auto flex h-full w-full max-w-[1180px] flex-col items-center justify-center px-4 pt-16 text-center sm:px-6">
        <div style={copy}>
          <p className="eyebrow text-fg-subtle">
            Welcome to {brand.legalName} · {brand.city}
          </p>
          <h1 className="mx-auto mt-3 max-w-[18ch] font-display text-[clamp(2.2rem,6vw,4.2rem)] leading-[1.04] tracking-tight text-balance">
            {brand.hero.title}
            <em className="not-italic text-accent">{brand.hero.titleEm}</em>
            {brand.hero.titleAfter}
          </h1>
          <p className="mx-auto mt-4 max-w-[46ch] text-fg-muted">{brand.hero.lede}</p>
        </div>

        {rooms.length > 0 && (
          <div
            className="mt-8 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4"
            style={copy}
          >
            {rooms.map((room) => (
              <button
                key={room.slug}
                type="button"
                onClick={() => onRoom(room.slug)}
                className="group flex items-center justify-between gap-2 rounded-store border border-line/15 bg-surface/70 px-4 py-3 text-left backdrop-blur-md transition-colors hover:border-accent/60"
              >
                <span>
                  <span className="block font-semibold">{room.name}</span>
                  <span className="text-xs text-fg-subtle">
                    {room.count} {room.count === 1 ? 'piece' : 'pieces'}
                  </span>
                </span>
                <ArrowRight size={16} aria-hidden className="text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
              </button>
            ))}
          </div>
        )}

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3" style={copy}>
          <button
            type="button"
            onClick={() => onRoom('all')}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 font-semibold text-accent-ink transition-[filter] hover:brightness-110"
          >
            Browse all furniture <ArrowDown size={16} aria-hidden />
          </button>
          <Link
            to={storeExperiencePath(brand.slug)}
            className="inline-flex h-11 items-center rounded-full border border-line/20 px-6 font-semibold transition-colors hover:border-fg/40"
          >
            Try it in your room
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- section */

/**
 * The store's opening: the shop front on its street. Scrolling walks the visitor
 * up to the door, the doors swing open, and the camera passes through into the
 * showroom, where the rooms of the catalogue are laid out.
 *
 * The section is several screens tall with a sticky, full-screen stage; scroll
 * position drives every frame. With reduced motion, only the showroom is shown.
 */
export function ShopEntrance({
  brand,
  rooms,
  onRoom,
}: {
  brand: Brand;
  rooms: readonly Room[];
  onRoom: (slug: string) => void;
}) {
  const reduced = usePrefersReducedMotion();
  const { ref, progress: p } = useScrollProgress<HTMLElement>();
  const sceneRef = useRef<HTMLDivElement>(null);
  const doorRef = useRef<HTMLDivElement>(null);
  const door = useDoorGeometry(sceneRef, doorRef);

  if (reduced) {
    return (
      <section aria-label={`Inside ${brand.legalName}`} className="relative h-[100svh] min-h-[560px]">
        <Showroom brand={brand} rooms={rooms} onRoom={onRoom} reveal={1} />
      </section>
    );
  }

  // Walking at a steady pace makes the shop grow geometrically, not linearly.
  const walk = easeInOut(range(p, DOLLY));
  const zoom = door ? door.through ** walk : 1;
  // Swing the doorway to the middle of the screen early, so the last stretch is straight ahead.
  const centre = easeOut(Math.min(1, walk * 1.8));
  const sceneTransform = door
    ? (() => {
        const x = lerp(door.cx, door.width / 2, centre) - zoom * door.cx;
        const y = lerp(door.cy, door.height / 2, centre) - zoom * door.cy;
        return `translate(${x}px, ${y}px) scale(${zoom})`;
      })()
    : undefined;

  const fade = range(p, FADE);
  const inside = fade > 0.5;

  return (
    <section ref={ref} aria-label={`Walk into ${brand.legalName}`} className="relative h-[380svh]">
      <div className="sticky top-0 h-[100svh] min-h-[480px] overflow-hidden bg-surface">
        <div
          className="absolute inset-0"
          style={{ opacity: fade, transform: `scale(${lerp(1.12, 1, easeOut(fade))})` }}
          // Out of reach until we are through the door; `inert` is not in React 18's types.
          {...(!inside && { inert: '', 'aria-hidden': true })}
        >
          <Showroom brand={brand} rooms={rooms} onRoom={onRoom} reveal={easeOut(range(p, WELCOME))} />
        </div>

        {/* Hidden, not unmounted, once inside: the door measurement keeps observing this node. */}
        <div aria-hidden className="absolute inset-0" style={{ opacity: 1 - fade, visibility: fade < 1 ? undefined : 'hidden' }}>
          <div
            ref={sceneRef}
            className="absolute inset-0 origin-top-left bg-[linear-gradient(to_bottom,rgb(var(--surface)),rgb(var(--surface-raised))_86%)]"
            style={{ transform: sceneTransform }}
          >
            <div className="absolute inset-x-0 bottom-0 h-[24%] border-t sm:h-[14%] border-fg/15 bg-fg/[0.06] bg-[repeating-linear-gradient(90deg,transparent_0_120px,rgb(var(--fg)/0.06)_120px_122px)]" />
            <Storefront brand={brand} open={easeInOut(range(p, DOORS))} doorRef={doorRef} />
          </div>
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-[3%] flex flex-col items-center gap-2 text-fg-muted"
          style={{ opacity: 1 - range(p, HINT) }}
        >
          <span className="text-xs uppercase tracking-[0.24em]">Scroll to step inside</span>
          <ArrowDown size={16} aria-hidden className="animate-bounce" />
          <button
            type="button"
            onClick={() => onRoom('all')}
            className="pointer-events-auto text-xs underline underline-offset-4 transition-colors hover:text-fg"
            tabIndex={p > HINT[1] ? -1 : undefined}
          >
            Skip to the furniture
          </button>
        </div>
      </div>
    </section>
  );
}
