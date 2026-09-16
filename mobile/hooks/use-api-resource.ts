import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';

interface ApiResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApiResource<T>(path: string) {
  const [state, setState] = useState<ApiResourceState<T>>({ data: null, loading: true, error: null });

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await api.get<T>(path);
      setState({ data, loading: false, error: null });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to reach the WACRM API.';
      setState({ data: null, loading: false, error: message });
    }
  }, [path]);

  useEffect(() => {
    // The fetch updates local state when the external request completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return { ...state, refetch: load };
}
