import { useSyncExternalStore } from "react";

const noop = () => () => {};
/** False on the server and during hydration, true afterwards. */
export const useMounted = () => useSyncExternalStore(noop, () => true, () => false);
