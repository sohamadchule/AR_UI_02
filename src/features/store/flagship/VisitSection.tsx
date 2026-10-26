import { useState, type FormEvent } from 'react';
import { CalendarCheck, Clock, MapPin, MessageCircle, Phone, Video } from 'lucide-react';
import { telLink, whatsappLink, type Brand } from '@/data/brands';
import { cn } from '@/lib/cn';

const SLOTS = ['Morning (11–1)', 'Afternoon (1–4)', 'Evening (4–8)'];
const MODES = [
  { id: 'visit', label: 'At the atelier', icon: MapPin },
  { id: 'video', label: 'Video call', icon: Video },
] as const;

const field =
  'h-11 w-full rounded-store border border-line/15 bg-surface px-3.5 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none';

/** Today as yyyy-mm-dd, for the date input's minimum. */
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Book a visit or a video call. There is no back office to receive it: the
 * request opens as a WhatsApp message to the shop, written out and ready to
 * send, which is where a shopkeeper already answers customers.
 */
export function VisitSection({ brand, pieces }: { brand: Brand; pieces: string[] }) {
  const [mode, setMode] = useState<(typeof MODES)[number]['id']>('visit');
  const [sent, setSent] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const piece = String(data.get('piece') || '');
    const message = [
      `Hi ${brand.legalName}, I'd like to book a ${mode === 'visit' ? 'visit to the atelier' : 'video call'}.`,
      `Name: ${data.get('name')}`,
      `Day: ${data.get('day')} · ${data.get('slot')}`,
      piece && `Interested in: ${piece}`,
      data.get('note') && `Note: ${data.get('note')}`,
    ]
      .filter(Boolean)
      .join('\n');
    window.open(whatsappLink(brand, message), '_blank', 'noopener');
    setSent(true);
  }

  return (
    <section id="visit" aria-labelledby="visit-title" className="border-t border-line/10 bg-surface-raised">
      <div className="mx-auto grid w-full max-w-[1180px] gap-10 px-4 py-16 sm:px-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:gap-14 md:py-24">
        <div>
          <p className="eyebrow text-fg-subtle">Visit the atelier</p>
          <h2 id="visit-title" className="mt-2 font-display text-[clamp(1.8rem,3.8vw,2.7rem)] leading-tight tracking-tight">
            Sit on it. Touch the fabric. Or let us walk you through on video.
          </h2>

          <form onSubmit={submit} className="mt-8 grid gap-4 sm:grid-cols-2">
            <fieldset className="sm:col-span-2">
              <legend className="eyebrow mb-2 text-fg-subtle">How</legend>
              <div className="flex flex-wrap gap-2">
                {MODES.map(({ id, label, icon: Icon }) => (
                  <label
                    key={id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
                      mode === id ? 'border-accent bg-accent/10' : 'border-line/15 hover:border-fg/35',
                    )}
                  >
                    <input type="radio" name="mode" value={id} checked={mode === id} onChange={() => setMode(id)} className="sr-only" />
                    <Icon size={15} aria-hidden /> {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex flex-col gap-1.5 text-sm">
              Your name
              <input name="name" required autoComplete="name" className={field} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              Piece you&apos;re interested in
              <select name="piece" defaultValue="" className={field}>
                <option value="">Not sure yet</option>
                {pieces.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              Day
              <input name="day" type="date" required min={today()} className={field} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              Time
              <select name="slot" className={field}>
                {SLOTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              Anything we should know? <span className="sr-only">(optional)</span>
              <textarea
                name="note"
                rows={2}
                placeholder="Room size, a photo you'll send, a fabric you liked…"
                className={cn(field, 'h-auto py-2.5')}
              />
            </label>

            <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
              <button
                type="submit"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 font-semibold text-accent-ink transition-[filter] hover:brightness-110"
              >
                <CalendarCheck size={17} aria-hidden /> Book on WhatsApp
              </button>
              <p role="status" className="text-sm text-fg-muted">
                {sent ? 'WhatsApp opened with your request — just press send.' : 'Opens WhatsApp with your request written out.'}
              </p>
            </div>
          </form>
        </div>

        <aside className="flex flex-col gap-4 self-start rounded-store border border-line/12 bg-surface p-6">
          <div className="flex gap-3">
            <MapPin size={18} aria-hidden className="mt-0.5 shrink-0 text-accent" />
            <address className="not-italic text-sm leading-relaxed">
              <span className="font-semibold">{brand.legalName}</span>
              {brand.contact.address.map((line) => (
                <span key={line} className="block text-fg-soft">
                  {line}
                </span>
              ))}
            </address>
          </div>
          <div className="flex gap-3">
            <Clock size={18} aria-hidden className="mt-0.5 shrink-0 text-accent" />
            <ul className="text-sm leading-relaxed text-fg-soft">
              {brand.contact.hours.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
          <div className="mt-2 grid gap-2 border-t border-line/10 pt-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
            <a
              href={telLink(brand)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line/20 text-sm font-semibold transition-colors hover:border-fg/40"
            >
              <Phone size={15} aria-hidden /> Call
            </a>
            <a
              href={whatsappLink(brand, `Hi ${brand.legalName}, I have a question.`)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line/20 text-sm font-semibold transition-colors hover:border-fg/40"
            >
              <MessageCircle size={15} aria-hidden /> WhatsApp
            </a>
          </div>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(brand.contact.mapQuery)}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-accent underline-offset-4 hover:underline"
          >
            Get directions →
          </a>
        </aside>
      </div>
    </section>
  );
}
