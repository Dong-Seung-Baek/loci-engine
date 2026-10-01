export interface Entry { item: string; img: string; example?: boolean }
export type PalaceData = Record<number, Entry>;

// Persistence lives behind this interface so a synced backend can replace it later.
export interface Storage {
  load(): PalaceData | null;
  save(data: PalaceData): void;
  getFlag(name: string): unknown;
  setFlag(name: string, value: unknown): void;
}

function read(key: string) { try { return JSON.parse(localStorage.getItem(key) as string); } catch (e) { return null; } }
function write(key: string, val: unknown) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* quota or disabled */ } }

// `key` is the data key ("loci-skewer:v2"); flags use its prefix ("loci-skewer:hint")
// because every file:// page in Chrome shares one localStorage.
export function localStore(key: string): Storage {
  const prefix = key.includes(':') ? key.slice(0, key.indexOf(':')) : key;
  return {
    load: () => read(key),
    save: data => write(key, data),
    getFlag: name => read(`${prefix}:${name}`),
    setFlag: (name, value) => write(`${prefix}:${name}`, value),
  };
}
