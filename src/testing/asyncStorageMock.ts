/**
 * In-memory stand-in for AsyncStorage.
 *
 * The persistence layer is worth testing on its own terms — coins, best score
 * and streaks surviving a restart is an acceptance criterion — and that does not
 * need a device, only a key/value store that behaves like one.
 */
const store = new Map<string, string>();

export function __seed(key: string, value: string): void {
  store.set(key, value);
}

export function __clear(): void {
  store.clear();
}

export function __snapshot(): Record<string, string> {
  return Object.fromEntries(store);
}

/** Set to make the next write reject, exercising the failure paths. */
export let __failWrites = false;

export function __setFailWrites(value: boolean): void {
  __failWrites = value;
}

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    return store.get(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    if (__failWrites) throw new Error('simulated storage failure');
    store.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    store.delete(key);
  },
  async clear(): Promise<void> {
    store.clear();
  },
};

export default AsyncStorage;
