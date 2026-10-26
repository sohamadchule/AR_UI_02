import { useState, type FormEvent, type InputHTMLAttributes } from 'react';
import { CheckCircle2, MailCheck } from 'lucide-react';
import { ApiValidationError, submitDemoRequest, type DemoRequestInput, type DemoSubmitResult } from '@/lib/api';
import { Button } from '@/components/ui/Button';

type Fields = Required<Pick<DemoRequestInput, 'name' | 'email' | 'company' | 'phone' | 'role' | 'message'>>;
type FieldErrors = Partial<Record<keyof Fields, string>>;

const EMPTY: Fields = { name: '', email: '', company: '', phone: '', role: '', message: '' };
const PHONE = /^\+?[\d\s().-]{7,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(f: Fields): FieldErrors {
  const e: FieldErrors = {};
  if (!f.name.trim()) e.name = 'Please enter your name.';
  if (!EMAIL.test(f.email.trim())) e.email = 'Please enter a valid email.';
  if (!f.company.trim()) e.company = 'Please enter your company.';
  if (f.phone.trim() && !PHONE.test(f.phone.trim())) e.phone = 'Please enter a valid phone number.';
  if (f.message.length > 2000) e.message = 'Message is too long (max 2000 characters).';
  return e;
}

const inputCls =
  'w-full rounded-xl border border-line/15 bg-surface px-4 py-3 text-sm text-fg placeholder:text-fg-subtle focus:border-fg focus:outline-none';
const labelCls = 'mb-1.5 block text-xs uppercase tracking-[0.12em] text-fg-muted';

/** The request-a-demo card: form, then a "check your inbox" / "received" confirmation. */
export function DemoRequestForm() {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | DemoSubmitResult>('idle');

  const set = (k: keyof Fields) => (e: { target: { value: string } }) => {
    setFields((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validate(fields);
    setErrors(found);
    if (Object.keys(found).length) return;
    setStatus('sending');
    setFormError('');
    try {
      setStatus(await submitDemoRequest({ ...fields, website: honeypot }));
    } catch (err) {
      setStatus('idle');
      if (err instanceof ApiValidationError) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else {
        setFormError('Could not send your request. Please check your connection and try again.');
      }
    }
  }

  const field = (k: keyof Fields, label: string, props: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block text-left">
      <span className={labelCls}>{label}</span>
      <input className={inputCls} value={fields[k]} onChange={set(k)} aria-invalid={errors[k] ? true : undefined} {...props} />
      {errors[k] && (
        <span role="alert" className="mt-1 block text-xs text-red-500">
          {errors[k]}
        </span>
      )}
    </label>
  );

  if (status === 'sent' || status === 'verified') {
    const Icon = status === 'sent' ? MailCheck : CheckCircle2;
    return (
      <div className="py-10 text-center" role="status">
        <Icon className="mx-auto mb-5 h-12 w-12 text-fg-soft" aria-hidden />
        <h2 className="mb-3 text-2xl font-light text-fg">{status === 'sent' ? 'Check your inbox' : 'Request received'}</h2>
        <p className="text-sm leading-relaxed text-fg-muted">
          {status === 'sent' ? (
            <>
              We've sent a confirmation link to <strong className="text-fg">{fields.email.trim()}</strong>. Click it to confirm your
              email and we'll take it from there. It may take a minute; check spam if you don't see it.
            </>
          ) : (
            <>
              Thank you, we'll be in touch shortly. A confirmation is on its way to{' '}
              <strong className="text-fg">{fields.email.trim()}</strong>.
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="mb-2 text-left">
        <h2 className="text-2xl font-light text-fg">Request an exclusive demo</h2>
        <p className="mt-2 text-sm text-fg-muted">Tell us a little about you and we'll arrange a walkthrough.</p>
      </div>

      {field('name', 'Name *', { autoComplete: 'name', maxLength: 120 })}
      {field('email', 'Work email *', { type: 'email', autoComplete: 'email', maxLength: 254 })}
      <div className="grid gap-4 sm:grid-cols-2">
        {field('company', 'Company *', { autoComplete: 'organization', maxLength: 160 })}
        {field('role', 'Role', { autoComplete: 'organization-title', maxLength: 120 })}
      </div>
      {field('phone', 'Contact number', { type: 'tel', autoComplete: 'tel', maxLength: 20, placeholder: '+91 98765 43210' })}

      <label className="block text-left">
        <span className={labelCls}>Message</span>
        <textarea
          className={inputCls}
          rows={3}
          maxLength={2000}
          value={fields.message}
          onChange={set('message')}
          aria-invalid={errors.message ? true : undefined}
        />
        {errors.message && (
          <span role="alert" className="mt-1 block text-xs text-red-500">
            {errors.message}
          </span>
        )}
      </label>

      {/* Honeypot: invisible to people, tempting to bots. */}
      <input
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        name="website"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />

      {formError && (
        <p role="alert" className="text-left text-sm text-red-500">
          {formError}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Request demo'}
      </Button>
      <p className="text-center text-xs text-fg-subtle">We'll email you a link to confirm your address. No spam, ever.</p>
    </form>
  );
}
