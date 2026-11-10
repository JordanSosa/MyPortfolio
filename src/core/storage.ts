/**
 * Safe localStorage JSON persistence. Every access is wrapped in try/catch
 * (private mode, quota, disabled storage, corrupted JSON all fall back to
 * defaults). Keys are versioned: storageKey("save", 1) === "kko.save.v1".
 *
 *   const store = new Store("save", 1, DEFAULT_SAVE);
 *   store.data.coins += 10;
 *   store.save();
 */

export const storageKey = (name: string, version: number): string => `kko.${name}.v${version}`;

function ls(): Storage | null {
  try {
    const s = globalThis.localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

/** Read raw JSON (undefined if missing/broken). */
export function loadRaw(key: string): unknown {
  try {
    const s = ls()?.getItem(key);
    if (s == null) return undefined;
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

export function saveRaw(key: string, value: unknown): boolean {
  try {
    const s = ls();
    if (!s) return false;
    s.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Raw stored text (null if missing or storage is unavailable). */
export function loadText(key: string): string | null {
  try {
    return ls()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Store raw text. False when storage is missing, full or refuses the write. */
export function saveText(key: string, text: string): boolean {
  try {
    const s = ls();
    if (!s) return false;
    s.setItem(key, text);
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    ls()?.removeItem(key);
  } catch {
    /* ignore */
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Deep-merge loaded data over defaults: missing fields get defaults, fields
 * whose type differs from the default are dropped (keeps old saves safe).
 */
export function mergeDefaults<T>(defaults: T, loaded: unknown): T {
  if (loaded === undefined) return structuredCloneSafe(defaults);
  if (isObj(defaults)) {
    const out: Record<string, unknown> = {};
    const src = isObj(loaded) ? loaded : {};
    for (const k of Object.keys(defaults)) out[k] = mergeDefaults((defaults as Record<string, unknown>)[k], src[k]);
    // keep extra keys from the save (e.g. dynamic maps like per-hero bests)
    for (const k of Object.keys(src)) if (!(k in out)) out[k] = src[k];
    return out as T;
  }
  if (Array.isArray(defaults)) return (Array.isArray(loaded) ? loaded : structuredCloneSafe(defaults)) as T;
  if (typeof loaded === typeof defaults) return loaded as T;
  return defaults;
}

function structuredCloneSafe<T>(v: T): T {
  try {
    return structuredClone(v);
  } catch {
    return JSON.parse(JSON.stringify(v)) as T;
  }
}

/** Load `name` v`version` merged over defaults. */
export function loadJSON<T>(name: string, version: number, defaults: T): T {
  return mergeDefaults(defaults, loadRaw(storageKey(name, version)));
}

export function saveJSON(name: string, version: number, value: unknown): boolean {
  return saveRaw(storageKey(name, version), value);
}

/** A typed, versioned persisted object. */
export class Store<T> {
  readonly key: string;
  data: T;

  /**
   * @param migrate optional: given the raw data of an older version key
   *   (`kko.name.v<version-1>`) when the current key is empty, return data for this version.
   */
  constructor(
    name: string,
    version: number,
    private readonly defaults: T,
    migrate?: (old: unknown, oldVersion: number) => unknown,
  ) {
    this.key = storageKey(name, version);
    let raw = loadRaw(this.key);
    if (raw === undefined && migrate) {
      for (let v = version - 1; v >= 1; v--) {
        const old = loadRaw(storageKey(name, v));
        if (old !== undefined) {
          try {
            raw = migrate(old, v);
          } catch {
            raw = undefined;
          }
          break;
        }
      }
    }
    this.data = mergeDefaults(defaults, raw);
  }

  save(): boolean {
    return saveRaw(this.key, this.data);
  }

  reset(): void {
    this.data = structuredCloneSafe(this.defaults);
    this.save();
  }
}
