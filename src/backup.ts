import { makeBackup, parseBackup, type PalaceData, type Storage } from './storage';
import type { UI } from './ui';

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// Export/import buttons in the list sheet. Import never overwrites without an in-page confirmation.
export function wireBackup(o: {
  ui: UI; store: Storage; storageKey: string; title: string; places: number;
  getData(): PalaceData; setData(d: PalaceData): void;
}) {
  const { $ } = o.ui;
  const prefix = o.storageKey.split(':')[0];
  let pending: PalaceData | null = null;

  function showNote() {
    const last = o.store.getFlag('exportedAt') as string | null;
    $('backupNote').textContent = last
      ? `마지막 내보내기: ${fmtDate(last)}. 브라우저 데이터를 지우면 저장한 내용도 사라지니까 가끔 파일로 받아둬.`
      : '아직 파일로 내보낸 적 없어. 브라우저 데이터를 지우면 저장한 내용도 사라지니까 파일로 받아둬.';
  }
  const resetImport = () => { pending = null; $('importConfirm').hidden = true; $('importError').hidden = true; };
  const fail = (msg: string) => { pending = null; $('importConfirm').hidden = true; $('importError').textContent = msg; $('importError').hidden = false; };

  $('exportBtn').onclick = () => {
    resetImport();
    const backup = makeBackup(o.getData(), { storageKey: o.storageKey, title: o.title, places: o.places });
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${prefix}-${backup.exportedAt.slice(0, 10)}.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    o.store.setFlag('exportedAt', backup.exportedAt); showNote();
  };

  const file = $<HTMLInputElement>('importFile');
  $('importBtn').onclick = () => { resetImport(); file.value = ''; file.click(); };
  file.onchange = async () => {
    const f = file.files && file.files[0]; if (!f) return;
    const text = await f.text();
    file.value = '';   // so picking the same file again still fires change
    const r = parseBackup(text, { storageKey: o.storageKey, places: o.places });
    if (!r.ok) { fail(r.error); return; }
    pending = r.data; $('importError').hidden = true;
    const now = Object.values(o.getData()).filter(d => d && d.item).length;
    const when = fmtDate(r.backup.exportedAt);
    $('importMsg').textContent = `${when ? when + '에 내보낸 ' : ''}백업이야. ${r.filled}곳이 채워져 있어. 지금 내용(${now}곳)을 이걸로 덮어쓸까?`;
    $('importConfirm').hidden = false;
  };
  $('importYes').onclick = () => {
    if (!pending) return;
    o.setData(pending); resetImport();
    $('backupNote').textContent = '가져오기 완료. 목록이 백업 내용으로 바뀌었어.';
  };
  $('importNo').onclick = resetImport;

  return { onOpen: () => { resetImport(); showNote(); } };
}
