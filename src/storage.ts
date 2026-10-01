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

// ---------- backup file (JSON) ----------
// localStorage disappears when browser data is cleared, so palaces can be saved to and restored from a file.

export const BACKUP_FORMAT = 'loci-palace-backup';
const MAX_ITEM = 60, MAX_IMG = 240;   // same limits as the edit sheet

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: 1;
  storageKey: string;
  title: string;
  exportedAt: string;
  places: number;
  data: PalaceData;
}

export function makeBackup(data: PalaceData, meta: { storageKey: string; title: string; places: number }, now = new Date()): Backup {
  return { format: BACKUP_FORMAT, version: 1, ...meta, exportedAt: now.toISOString(), data };
}

export type ParseResult = { ok: true; backup: Backup; data: PalaceData; filled: number } | { ok: false; error: string };

// Validates a backup against this palace; returns cleaned data or a message the user can act on.
export function parseBackup(text: string, expect: { storageKey: string; places: number }): ParseResult {
  let raw: any;
  try { raw = JSON.parse(text); } catch (e) { return { ok: false, error: 'JSON 파일이 아니야. 내보내기로 만든 백업 파일을 골라줘.' }; }
  if (!raw || raw.format !== BACKUP_FORMAT || typeof raw.data !== 'object' || raw.data === null || Array.isArray(raw.data)) {
    return { ok: false, error: '기억의 궁전 백업 파일이 아니야.' };
  }
  if (raw.version !== 1) return { ok: false, error: `이 엔진이 모르는 백업 버전(${raw.version})이야. 엔진을 올린 뒤 다시 시도해줘.` };
  if (raw.storageKey !== expect.storageKey) {
    return { ok: false, error: `다른 궁전의 백업이야 (${raw.title || raw.storageKey}). 그 궁전에서 가져와줘.` };
  }
  const data: PalaceData = {};
  for (const [k, v] of Object.entries(raw.data as Record<string, any>)) {
    const i = Number(k);
    if (!Number.isInteger(i) || i < 0 || i >= expect.places) return { ok: false, error: `${Number.isInteger(i) ? i + 1 : k}번 장소는 이 궁전에 없어 (장소 ${expect.places}곳).` };
    if (!v || typeof v.item !== 'string' || (v.img !== undefined && typeof v.img !== 'string')) return { ok: false, error: `${i + 1}번 장소 내용이 깨져 있어.` };
    const item = v.item.trim().slice(0, MAX_ITEM), img = (v.img || '').trim().slice(0, MAX_IMG);
    if (!item && !img) continue;
    data[i] = v.example === true ? { item, img, example: true } : { item, img };
  }
  const filled = Object.values(data).filter(d => d.item).length;
  return { ok: true, backup: raw as Backup, data, filled };
}
