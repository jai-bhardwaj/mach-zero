import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Returns `true` after client-side hydration, `false` during SSR.
 * Uses useSyncExternalStore instead of useState + useEffect to avoid
 * synchronous setState in effects.
 */
export function useMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}
