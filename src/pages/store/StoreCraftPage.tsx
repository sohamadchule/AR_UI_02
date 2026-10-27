import { useId, useState, type FormEvent } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { CheckCircle2, MessageCircle, Send } from 'lucide-react';
import { whatsappLink, type Brand } from '@/data/brands';
import { useAsync } from '@/hooks/useAsync';
import { usePartPicks } from '@/hooks/usePartPicks';
import { ApiValidationError, submitDesign, viewPath, type DesignPart, type Variant } from '@/lib/api';
import { encodePicks, tintParts, type PartPicks } from '@/lib/color';
import { ModelStage } from '@/features/experience/ModelStage';
import { ColourSwatches } from '@/features/experience/ColourSwatches';
import { curate, formatInr, loadCatalogue, type StoreProduct } from '@/features/store/catalog';
import { PiecePicker, isMixable } from '@/features/store/PiecePicker';
import { cn } from '@/lib/cn';

const input =
  'w-full rounded-store border border-line/15 bg-surface px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus:border-fg focus:outline-none';
const label = 'mb-1.5 block text-xs uppercase tracking-[0.12em] text-fg-muted';

/** The design as the shop will read it: each part with the colour chosen for it. */
function designOf(variant: Variant, picks: PartPicks): DesignPart[] {
  const parts = variant.model.tint ? tintParts(variant.model.tint) : [];
  const main = { part: parts.length > 1 ? parts[0].name : 'Colour', colour: variant.name, hex: variant.colorHex };
  return [
    main,
    ...parts.slice(1).map((part, i) => {
      const colour = part.colours.find((c) => c.hex === picks[i + 1]) ?? part.colours[0];
      return { part: part.name, colour: colour?.name ?? null, hex: colour?.hex ?? null };
    }),
  ];
}

const Step = ({ n, children }: { n: number; children: string }) => (
  <h2 className="mb-4 flex items-center gap-3 font-display text-xl tracking-tight">
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-fg text-xs font-semibold text-surface">{n}</span>
    {children}
  </h2>
);

/**
 * Craft: a shopper picks a piece, chooses a colour for each of its parts, and sends the design
 * to the shop with a name and phone number. Each one is a lead on the admin's Design requests page.
 */
export function StoreCraftPage() {
  const brand = useOutletContext<Brand>();
  const ids = useId();
  const catalogue = useAsync(loadCatalogue, 'store-catalogue');
  const [params, setParams] = useSearchParams();
  const [variantId, setVariantId] = useState<string | null>(null);
  const { picksFor, pick } = usePartPicks();
  const [form, setForm] = useState({ name: '', phone: '', city: '', note: '', website: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [failure, setFailure] = useState('');
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (catalogue.status === 'loading') return <p role="status" className="py-28 text-center text-sm text-fg-muted">Loading…</p>;

  const all = catalogue.status === 'ready' ? catalogue.data.products.filter((p) => p.variants.length > 0) : [];
  const curated = curate(all, brand.flagship);
  const products = curated.length ? curated : all;
  // Opened on a piece (?p=) or, failing that, the first one with parts to mix.
  const product = products.find((p) => p.slug === params.get('p')) ?? products.find(isMixable) ?? products[0];

  const header = (
    <>
      <p className="eyebrow text-fg-subtle">Craft at {brand.legalName}</p>
      <h1 className="mt-3 max-w-[20ch] font-display text-[clamp(2.2rem,6vw,3.7rem)] leading-[1.05] tracking-tight text-balance">
        Design it <em className="not-italic text-accent">your way.</em>
      </h1>
      <p className="mt-4 max-w-[54ch] text-fg-muted">
        Pick a piece, choose a colour for each part, and send your design to us. We&apos;ll call you to talk it through. Nothing to pay now.
      </p>
    </>
  );

  if (!product) {
    return (
      <section className="mx-auto w-full max-w-[1180px] px-4 pb-20 pt-10 sm:px-6 md:pt-16">
        {header}
        <p className="mt-12 rounded-store border border-dashed border-line/20 p-8 text-center text-sm text-fg-muted">
          No pieces are ready to design yet. Please check back soon.
        </p>
      </section>
    );
  }

  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const picks = picksFor(product.slug);
  const design = designOf(variant, picks);
  const mix = encodePicks(variant.model.tint, picks);
  const designUrl = `${window.location.origin}${viewPath(variant.id)}${mix ? `?mix=${mix}` : ''}`;
  const summary = design.map((d) => `${d.part}: ${d.colour ?? '—'}`).join(', ');

  function choose(p: StoreProduct) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('p', p.slug);
      return next;
    }, { replace: true });
    setVariantId(null);
    setState('idle');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setFailure('');
    setState('sending');
    try {
      await submitDesign({
        brand: brand.slug,
        variantId: variant.id,
        mix: mix || undefined,
        name: form.name,
        phone: form.phone,
        city: form.city || undefined,
        note: form.note || undefined,
        website: form.website,
      });
      setState('sent');
    } catch (err) {
      setState('idle');
      if (err instanceof ApiValidationError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors as Record<string, string>);
      else setFailure(err instanceof Error ? err.message : 'Could not send your design. Please try again.');
    }
  }

  const field = (k: 'name' | 'phone' | 'city', text: string, extra: Record<string, unknown> = {}) => (
    <label className="block" htmlFor={`${ids}-${k}`}>
      <span className={label}>{text}</span>
      <input id={`${ids}-${k}`} className={input} value={form[k]} onChange={set(k)} aria-invalid={Boolean(errors[k])} {...extra} />
      {errors[k] && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{errors[k]}</span>}
    </label>
  );

  return (
    <section aria-label="Craft" className="mx-auto w-full max-w-[1180px] px-4 pb-20 pt-10 sm:px-6 md:pt-16">
      {header}

      <div className="mt-12">
        <Step n={1}>Choose a piece</Step>
        <PiecePicker products={products} selected={product} onSelect={choose} initiallyOpen={!params.get('p')} />
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:gap-12">
        <div className="min-w-0 md:sticky md:top-24 md:self-start">
          <ModelStage variant={variant} picks={picks} className="aspect-[10/9] w-full" showArUnavailable={false} />
          <p className="pt-3 text-center text-xs uppercase tracking-[0.18em] text-fg-subtle">Drag to turn it around</p>
        </div>

        <div className="flex min-w-0 flex-col gap-10">
          <div>
            <Step n={2}>Make it yours</Step>
            <p className="font-display text-2xl tracking-tight">{product.name}</p>
            {product.priceInr !== null && <p className="mt-1 text-sm text-fg-muted">From {formatInr(product.priceInr)}</p>}
            <ColourSwatches
              className="mt-6"
              variants={product.variants}
              activeId={variant.id}
              onSelect={(id) => {
                setVariantId(id);
                setState('idle');
              }}
              picks={picks}
              onPick={(part, hex) => {
                pick(product.slug, part, hex);
                setState('idle');
              }}
            />
            <div className="mt-6 rounded-store border border-line/12 bg-surface-raised p-4">
              <p className="eyebrow mb-2 text-fg-subtle">Your design</p>
              <ul className="space-y-1.5 text-sm">
                {design.map((d) => (
                  <li key={d.part} className="flex items-center gap-2.5">
                    <i className="block h-4 w-4 shrink-0 rounded-full border border-fg/15" style={{ backgroundColor: d.hex ?? 'transparent' }} aria-hidden />
                    <span className="text-fg-muted">{d.part}</span>
                    <span className="ml-auto font-medium">{d.colour ?? '—'}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <Step n={3}>{`Send it to ${brand.legalName}`}</Step>
            {state === 'sent' ? (
              <div role="status" className="rounded-store border border-line/12 bg-surface-raised p-6">
                <p className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 size={20} aria-hidden className="text-accent" /> Thank you, {form.name.trim().split(' ')[0]}!
                </p>
                <p className="mt-2 text-sm text-fg-muted">
                  {brand.legalName} has your {product.name} design and will call you on {form.phone.trim()} soon.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <a
                    href={whatsappLink(brand, `Hi ${brand.legalName}, I designed the ${product.name} on your website (${summary}). ${designUrl}`)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-line/20 px-5 text-sm font-medium transition-colors hover:border-fg/40"
                  >
                    <MessageCircle size={16} aria-hidden /> Also send on WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={() => setState('idle')}
                    className="text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline"
                  >
                    Design another
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {field('name', 'Your name *', { required: true, autoComplete: 'name', maxLength: 80 })}
                  {field('phone', 'Phone *', { required: true, type: 'tel', autoComplete: 'tel', inputMode: 'tel', maxLength: 20, placeholder: '98765 43210' })}
                </div>
                {field('city', 'City or area', { autoComplete: 'address-level2', maxLength: 80 })}
                <label className="block" htmlFor={`${ids}-note`}>
                  <span className={label}>Anything else?</span>
                  <textarea
                    id={`${ids}-note`}
                    className={cn(input, 'min-h-[90px]')}
                    value={form.note}
                    onChange={set('note')}
                    maxLength={600}
                    placeholder="Size, fabric, when you need it…"
                  />
                  {errors.note && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{errors.note}</span>}
                </label>
                {/* Honeypot for bots: hidden from people and screen readers. */}
                <input type="text" name="website" value={form.website} onChange={set('website')} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
                {(failure || errors.variantId) && (
                  <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                    {failure || errors.variantId}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={state === 'sending'}
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-fg px-7 text-sm font-medium text-surface transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  <Send size={16} aria-hidden /> {state === 'sending' ? 'Sending…' : 'Send my design'}
                </button>
                <p className="text-xs text-fg-subtle">Only {brand.legalName} sees your details, to call you about this design.</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
