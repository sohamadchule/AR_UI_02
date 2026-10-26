import { ExperienceBrowser } from '@/features/experience/ExperienceBrowser';

export function ExperiencePage() {
  return (
    <section aria-label="Experience" className="px-6 pb-24 pt-32 md:px-12 md:pt-40">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-4 max-w-3xl text-4xl font-light leading-tight tracking-tighter text-fg-subtle md:text-6xl">
          Experience it
          <br />
          <span className="text-fg">before you buy it.</span>
        </h1>
        <p className="mb-14 max-w-xl font-light leading-relaxed text-fg-muted">
          See it in 3D. Place it in your room. Pick a piece, rotate it, then view it at real size in your space with
          AR, or scan the code on your phone.
        </p>

        <ExperienceBrowser />
      </div>
    </section>
  );
}
