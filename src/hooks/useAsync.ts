import { useEffect, useState } from 'react';

type State<T> = { status: 'loading' } | { status: 'error'; error: Error } | { status: 'ready'; data: T };

/** Runs `load` when `key` changes and exposes loading / error / ready. */
export function useAsync<T>(load: () => Promise<T>, key: string): State<T> {
  const [state, setState] = useState<State<T>>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    load().then(
      (data) => active && setState({ status: 'ready', data }),
      (error: Error) => active && setState({ status: 'error', error }),
    );
    return () => {
      active = false;
    };
    // `load` is intentionally keyed by `key` so callers can pass inline closures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
