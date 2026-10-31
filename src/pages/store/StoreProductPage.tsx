import { useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { Check, ChevronLeft, MessageCircle, Phone } from 'lucide-react';
import type { Brand } from '@/data/brands';
import { storeCraftPath, storePath, telLink, whatsappLink } from '@/data/brands';
import { showroomBySlug } from '@/data/showrooms';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ModelStage } from '@/features/experience/ModelStage';
import { QrPanel } from '@/features/experience/QrPanel';
import { PartColourRows } from '@/features/experience/ColourSwatches';
import { FitCheck } from '@/features/experience/FitCheck';
import { usePartPicks } from '@/hooks/usePartPicks';
import { tintParts } from '@/lib/color';
import {
  curate,
  defaultVariant,
  dimensionsCm,
  discountPercent,
  doorwayNote,
  formatInr,
  loadCatalogue,
  monthlyEmi,
} from '@/features/store/catalog';
import { cn } from '@/lib/cn';

/** Rough, deterministic delivery estimate so the control does something real. */
function estimateDays(pincode: string) {
  const base = 4 + (Number(pincode.slice(-2)) % 6);
  return [base, base + 2] as const;
}

function DeliveryCheck({ note }: { note: string }) {
  const [pincode, setPincode] = useState('411045');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>({
    ok: true,
    text: `Delivers to 411045 in 6–8 days · ${note.toLowerCase()}`,
  });

  return (
    <div className="flex flex-col gap-2">
      <span className="eyebrow text-fg-subtle">Delivery</span>
      <div className="flex flex-wrap gap-2">
        <input
          id="store-pincode"
          value={pincode}
          onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          maxLength={6}
          aria-label="Delivery PIN code"
          placeholder="6-digit PIN code"
          className="h-11 min-w-[150px] flex-1 rounded-store border border-line/15 bg-surface-raised px-3.5 text-sm text-fg placeholder:text-fg-subtle"
        />
        <button
          type="button"
          onClick={() => {
            if (!/^\d{6}$/.test(pincode)) {
              setResult({ ok: false, text: 'Enter a 6-digit PIN code.' });
              return;
            }
            const [from, to] = estimateDays(pincode);
            setResult({ ok: true, text: `Delivers to ${pincode} in ${from}–${to} days · ${note.toLowerCase()}` });
          }}
          className="h-11 rounded-store border border-line/15 px-5 text-sm font-medium transition-colors hover:border-fg/40"
        >
          Check
        </button>
      </div>
      {result && (
        <p className={cn('flex items-center gap-1.5 text-sm', result.ok ? 'text-accent' : 'text-fg-subtle')}>
          {result.ok && <Check size={14} aria-hidden />}
          {result.text}
        </p>
      )}
    </div>
  );
}

export function StoreProductPage() {
  const brand = useOutletContext<Brand>();
  // Shops with a showroom site sell in person: the page drops the online-checkout parts.
  const showroom = showroomBySlug(brand.slug);
  const { productSlug = '' } = useParams();
  const catalogue = useAsync(loadCatalogue, 'store-catalogue');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const { picksFor, pick } = usePartPicks();

  const product =
    catalogue.status === 'ready'
      ? // The shop's own version of the piece (its finishes) when it curates one; otherwise the catalogue's.
        (curate(catalogue.data.products, brand.flagship).find((p) => p.slug === productSlug) ??
        catalogue.data.products.find((p) => p.slug === productSlug))
      : undefined;
  useDocumentTitle(product ? `${product.name} — ${brand.legalName}` : brand.legalName);

  if (catalogue.status === 'loading') {
    return <p role="status" className="py-28 text-center text-sm text-fg-muted">Loading…</p>;
  }

  if (!product) {
    return (
      <div role="alert" className="mx-auto max-w-md px-4 py-28 text-center">
        <h1 className="font-display text-2xl">We couldn&apos;t find that piece</h1>
        <p className="mt-2 text-sm text-fg-muted">It may have been renamed or taken out of the catalogue.</p>
        <Link to={storePath(brand.slug)} className="mt-6 inline-block text-sm underline underline-offset-4">
          Back to the catalogue
        </Link>
      </div>
    );
  }

  const shown = product.variants.find((v) => v.id === pickedId) ?? defaultVariant(product);
  const dims = dimensionsCm(product, shown);
  const off = discountPercent(product);
  const finishes = shown
    ? product.variants.map((v) => ({ id: v.id, name: v.name, hex: v.colorHex }))
    : product.sampleFinishes.map((f) => ({ id: f.name, name: f.name, hex: f.hex }));
  // A model with separately coloured parts names its main part instead of "Finish", with a row per other part.
  const parts = shown?.model.tint ? tintParts(shown.model.tint) : [];
  const picks = picksFor(product.slug);

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-7 sm:px-6 md:py-12">
      <Link
        to={storePath(brand.slug)}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
      >
        <ChevronLeft size={16} aria-hidden /> {brand.catalogue.title}
      </Link>

      <div className="grid gap-8 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:gap-12">
        <div className="min-w-0">
          {shown ? (
            <ModelStage variant={shown} picks={picks} className="aspect-[10/9] w-full" />
          ) : (
            <div className="grid aspect-[10/9] w-full place-items-center rounded-store border border-dashed border-line/20 bg-surface-sunken p-6 text-center">
              <p className="max-w-xs text-sm text-fg-muted">
                No model uploaded for this piece yet. Add one in the admin and this becomes a live 3D and AR view.
              </p>
            </div>
          )}
          {shown && (
            <p className="pt-3 text-center text-xs uppercase tracking-[0.18em] text-fg-subtle">Rotate · Zoom · Explore</p>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <div>
            {shown && <p className="eyebrow text-fg-subtle">{shown.sku}</p>}
            <h1 className="mt-1.5 font-display text-[clamp(1.7rem,3.6vw,2.5rem)] leading-tight tracking-tight text-balance">
              {product.name}
            </h1>
            {product.blurb && <p className="mt-1.5 text-sm text-fg-muted">{product.blurb}</p>}
          </div>

          {product.priceInr !== null ? (
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-2xl font-semibold tabular-nums">{formatInr(product.priceInr)}</span>
                {off !== null && product.mrpInr !== null && (
                  <>
                    <span className="tabular-nums text-fg-subtle line-through">{formatInr(product.mrpInr)}</span>
                    <span className="text-xs font-bold text-accent">{off}% off</span>
                  </>
                )}
              </div>
              {!showroom && (
                <p className="text-sm text-fg-subtle">
                  Inclusive of GST · EMI from {formatInr(monthlyEmi(product.priceInr))}/month for 12 months
                </p>
              )}
            </div>
          ) : (
            <p className="text-fg-muted">Price on request</p>
          )}

          {finishes.length > 1 && (
            <div className="flex flex-col gap-2">
              <span className="eyebrow text-fg-subtle">{parts.length > 1 ? parts[0].name : 'Finish'}</span>
              <div role="radiogroup" aria-label="Choose a finish" className="flex flex-wrap gap-2">
                {finishes.map((f) => {
                  const selected = shown ? f.id === shown.id : false;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={!shown}
                      onClick={() => setPickedId(f.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-sm transition-colors',
                        selected ? 'border-accent bg-accent/10' : 'border-line/15 hover:border-fg/35',
                      )}
                    >
                      <i
                        className="block shrink-0 rounded-full border border-fg/15"
                        style={{ width: 18, height: 18, backgroundColor: f.hex ?? 'transparent' }}
                      />
                      {f.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {shown && <PartColourRows variant={shown} picks={picks} onPick={(part, hex) => pick(product.slug, part, hex)} />}
          {shown && (
            <Link to={storeCraftPath(brand.slug, product.slug)} className="-mt-2 text-sm text-fg-muted underline underline-offset-4 hover:text-fg">
              Design your own and send it to us
            </Link>
          )}

          {dims && (
            <div className="flex flex-col gap-2">
              <span className="eyebrow text-fg-subtle">Dimensions</span>
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {([['Width', dims.width], ['Depth', dims.depth], ['Height', dims.height]] as const).map(([label, cm]) => (
                    <tr key={label}>
                      <th scope="row" className="border-b border-line/10 py-2 text-left font-medium text-fg-muted">{label}</th>
                      <td className="border-b border-line/10 py-2 text-right tabular-nums">{Math.round(cm)} cm</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-sm text-fg-subtle">{doorwayNote(dims)}</p>
            </div>
          )}

          {shown && <FitCheck variant={shown} />}

          {showroom ? (
            // A showroom shop sells in person: no bag or delivery estimate, just real ways to reach the shop.
            <div className="flex flex-wrap gap-3">
              <a
                href={whatsappLink(
                  brand,
                  `Hi ${brand.legalName}, I'd like to know more about the ${product.name}${shown ? ` in ${shown.name}` : ''}. ${window.location.href}`,
                )}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-fg px-6 text-sm font-medium text-surface transition-opacity hover:opacity-90"
              >
                <MessageCircle size={16} aria-hidden /> Ask on WhatsApp
              </a>
              <a
                href={telLink(brand)}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-line/25 px-6 text-sm font-medium transition-colors hover:border-fg/60"
              >
                <Phone size={16} aria-hidden /> Call the shop
              </a>
            </div>
          ) : (
            <>
              <DeliveryCheck note={brand.deliveryNote} />

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="h-12 flex-1 rounded-full bg-accent px-6 font-semibold text-accent-ink transition-[filter] hover:brightness-110"
                >
                  Add to bag
                </button>
                <button
                  type="button"
                  className="h-12 flex-1 rounded-full border border-line/20 px-6 font-semibold transition-colors hover:border-fg/40"
                >
                  Save for later
                </button>
              </div>
            </>
          )}

          {!showroom && <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-store border border-line/12 bg-surface-raised px-4 py-3 text-sm">
            <span className="text-fg-muted">Questions about this piece?</span>
            <a
              href={whatsappLink(
                brand,
                `Hi ${brand.legalName}, I'd like to know more about the ${product.name}${shown ? ` in ${shown.name}` : ''}. ${window.location.href}`,
              )}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-accent underline-offset-4 hover:underline"
            >
              <MessageCircle size={15} aria-hidden /> Ask on WhatsApp
            </a>
            <a href={telLink(brand)} className="inline-flex items-center gap-1.5 font-semibold underline-offset-4 hover:underline">
              <Phone size={15} aria-hidden /> {brand.contact.phone}
            </a>
          </div>}

          {product.description && <p className="text-sm leading-relaxed text-fg-muted">{product.description}</p>}

          <dl className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-x-5 gap-y-3 text-sm">
            {(showroom
              ? [['Material', shown?.material ?? '—']]
              : [
                  ['Material', shown?.material ?? '—'],
                  ['Returns', `${brand.returnsDays} days`],
                  ['Assembly', 'Free, on delivery'],
                ]
            ).map(([k, v]) => (
              <div key={k} className="min-w-0 border-t border-line/10 pt-2.5">
                <dt className="text-[11px] uppercase tracking-[0.1em] text-fg-subtle">{k}</dt>
                <dd className="mt-0.5">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {shown && (
        <section className="mt-12 rounded-store border border-line/12 bg-surface-raised p-5 sm:p-7">
          <h2 className="mb-1 font-display text-xl tracking-tight">See it in your own room</h2>
          <p className="mb-6 max-w-[55ch] text-sm text-fg-muted">
            Scan this with an Android phone to open the piece in AR. It measures your floor and walls, then checks{' '}
            {dims ? `${Math.round(dims.width)} × ${Math.round(dims.depth)} × ${Math.round(dims.height)} cm` : 'the real size'}{' '}
            against the space you point it at.
          </p>
          <QrPanel variant={shown} picks={picks} />
        </section>
      )}
    </div>
  );
}
