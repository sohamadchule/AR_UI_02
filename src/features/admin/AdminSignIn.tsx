import { useCallback, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';

/** Same key as the demo-requests admin page, so one sign-in covers every admin page. */
const TOKEN_KEY = 'akruti.adminToken';

const readToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
};

/** The admin token for this tab, plus sign-in / sign-out. */
export function useAdminToken() {
  const [token, setToken] = useState(readToken);
  const signIn = useCallback((t: string) => {
    try {
      sessionStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* ignore */
    }
    setToken(t);
  }, []);
  const signOut = useCallback(() => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    setToken('');
  }, []);
  return { token, signIn, signOut };
}

/** Full-screen admin token prompt. */
export function AdminSignIn({ onSignIn, purpose, error }: { onSignIn: (token: string) => void; purpose: string; error?: string }) {
  const [draft, setDraft] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    const t = draft.trim();
    if (t) onSignIn(t);
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-3xl border border-line/10 bg-surface-raised p-8">
        <h1 className="text-xl font-light text-fg">Admin access</h1>
        <p className="text-sm text-fg-muted">Enter the admin token to {purpose}.</p>
        <input
          type="password"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Admin token"
          className="w-full rounded-xl border border-line/15 bg-surface px-4 py-3 text-sm text-fg focus:border-fg focus:outline-none"
        />
        {error && (
          <p role="alert" className="text-sm text-red-500">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>
    </main>
  );
}
