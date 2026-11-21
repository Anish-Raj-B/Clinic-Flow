import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../lib/utils';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Minimal data-fetching hook: runs `fetcher` on mount and whenever `deps`
 * change, guards against setting state after unmount and exposes reload().
 */
export function useFetch<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
): FetchState<T> & { reload: () => void } {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    fetcher()
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({ data: null, loading: false, error: getErrorMessage(error) });
        }
      });

    return () => {
      active = false;
    };
    // `fetcher` is intentionally excluded: callers pass an inline closure and
    // declare their real inputs through `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { ...state, reload };
}
