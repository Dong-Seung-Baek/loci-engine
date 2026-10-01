import css from './style.css?inline';
import { pad2 } from './helpers';
import type { Locus, PalaceOptions } from './types';
import type { PalaceData } from './storage';

const FONTS = 'https://fonts.googleapis.com/css2?family=Marcellus&family=Gowun+Batang:wght@700&family=Noto+Sans+KR:wght@400;500;700&display=swap';

const DEFAULT_HINT = [
  '너는 거대한 사물 주위를 나는 드론이야. 이동은 정해진 경로로만 해.',
  '‹ › 로 다음 장소로 날아가고, 화면을 드래그하면 고개만 돌릴 수 있어.',
  '번호판이나 발판을 탭하면 그 장소에 기억을 놓을 수 있어.',
  '오른쪽 위 작은 창은 전체 모습이야. 탭하면 커져.',
];

const TEMPLATE = `
  <canvas id="gl"></canvas>
  <div id="loading"></div>
  <div class="top">
    <div class="title glass">
      <h1 id="titleText"></h1>
      <div class="meta"><span id="subtitleText"></span><span><b id="fillLabel">0</b> 채움</span></div>
    </div>
    <button class="icon-btn glass" id="listBtn">목록</button>
  </div>
  <div id="wim" role="button" aria-label="전체 지도">
    <span id="wimLabel">전체 보기</span>
    <button id="wimClose" class="glass" aria-label="지도 닫기">✕</button>
    <div id="wimHint">지점 가까이를 탭하면 그곳으로 날아가</div>
  </div>
  <div class="bottom">
    <button class="caption glass" id="caption" aria-label="현재 지점 편집">
      <div class="no" id="capNo">01</div>
      <div class="body">
        <div class="where" id="capWhere"></div>
        <div class="item" id="capItem"></div>
        <div class="img" id="capImg"></div>
      </div>
      <div class="edit">편집</div>
    </button>
    <div class="nav glass">
      <button id="prevBtn" aria-label="이전 지점">‹</button>
      <div class="count" id="count">01 <span>/ 20</span></div>
      <button id="nextBtn" aria-label="다음 지점">›</button>
      <div class="sep"></div>
      <button class="recenter" id="recenterBtn" aria-label="시점을 지점 쪽으로 되돌리기">정면</button>
    </div>
  </div>
  <div class="sheet" id="editSheet" hidden>
    <form class="sheet-inner" id="editForm">
      <h2><span class="n" id="edNo">01</span><span id="edName"></span><span class="chip" id="edExample" hidden>예시</span></h2>
      <div class="sub" id="edWhere"></div>
      <label for="edItem">외울 것
        <input type="text" id="edItem" maxlength="60" autocomplete="off">
      </label>
      <label for="edImg">연상 이미지 (이 장소와 엮어서, 이상할수록 좋음)
        <textarea id="edImg" maxlength="240"></textarea>
      </label>
      <div class="row">
        <button type="submit" class="btn primary">저장</button>
        <button type="button" class="btn" id="edCancel">닫기</button>
        <button type="button" class="btn ghost-danger" id="edClear">비우기</button>
      </div>
    </form>
  </div>
  <div class="sheet" id="listSheet" hidden>
    <div class="sheet-inner">
      <h2>경로 전체</h2>
      <p class="note" id="listNote"></p>
      <div id="listBody"></div>
      <div class="row"><button type="button" class="btn" id="listClose">닫기</button></div>
    </div>
  </div>
  <div class="hint" id="hint" hidden>
    <h2 id="hintTitle"></h2>
    <ul id="hintList"></ul>
    <button class="btn primary" id="hintOk">시작</button>
  </div>`;

function injectHead() {
  const add = (tag: string, attrs: Record<string, string>) => {
    const el = document.createElement(tag); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); document.head.append(el); return el;
  };
  add('link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' });
  add('link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' });
  add('link', { rel: 'stylesheet', href: FONTS });
  add('style', {}).textContent = css;
}

export function createUI(opts: PalaceOptions) {
  injectHead();
  if (!document.title) document.title = opts.title;
  const app = document.createElement('div'); app.id = 'app'; app.innerHTML = TEMPLATE;
  (opts.container || document.body).append(app);
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => app.querySelector('#' + id) as T;

  $('loading').textContent = opts.loadingText || '궁전을 짓는 중…';
  $('titleText').textContent = opts.title;
  $('subtitleText').textContent = opts.subtitle;
  $('listNote').textContent = opts.listNote || '경로는 고정이야. 저장한 내용은 이 기기 브라우저에만 남아.';
  $('hintTitle').textContent = opts.hintTitle || `${opts.title} 둘러보기`;
  (opts.hint || DEFAULT_HINT).forEach(t => { const li = document.createElement('li'); li.textContent = t; $('hintList').append(li); });
  $<HTMLInputElement>('edItem').placeholder = opts.placeholders?.item || '예: 호랑이 (인)';
  $<HTMLTextAreaElement>('edImg').placeholder = opts.placeholders?.img || '예: 호랑이가 후추 알갱이에 재채기를 하며 포효한다';

  function updateHUD(loci: Locus[], cur: number, data: PalaceData) {
    const L = loci[cur], d = data[cur];
    $('capNo').textContent = pad2(cur + 1);
    $('capWhere').textContent = `${L.o} · ${L.f} — ${L.n}`;
    if (d && d.item) { $('capItem').textContent = d.item; $('capItem').classList.remove('empty'); $('capImg').textContent = d.img || ''; }
    else { $('capItem').textContent = '비어 있음'; $('capItem').classList.add('empty'); $('capImg').textContent = '탭해서 이 장소에 기억을 놓아봐'; }
    $('count').innerHTML = `${pad2(cur + 1)} <span>/ ${loci.length}</span>`;
    $<HTMLButtonElement>('prevBtn').disabled = cur === 0; $<HTMLButtonElement>('nextBtn').disabled = cur === loci.length - 1;
    $('fillLabel').textContent = String(Object.values(data).filter(v => v && v.item).length);
  }

  function openEdit(L: Locus, d: Partial<PalaceData[number]> = {}) {
    $('edNo').textContent = pad2(L.i + 1); $('edName').textContent = L.n; $('edWhere').textContent = `${L.o} · ${L.f}`;
    $('edExample').hidden = !d.example; $<HTMLInputElement>('edItem').value = d.item || ''; $<HTMLTextAreaElement>('edImg').value = d.img || '';
    $('editSheet').hidden = false;
  }
  const closeEdit = () => { $('editSheet').hidden = true; };
  const readEdit = () => ({ item: $<HTMLInputElement>('edItem').value.trim(), img: $<HTMLTextAreaElement>('edImg').value.trim() });

  function renderList(loci: Locus[], data: PalaceData, groups: string[], go: (i: number) => void) {
    const body = $('listBody'); body.innerHTML = '';
    groups.forEach(o => {
      const grp = document.createElement('div'); grp.className = 'grp';
      const h = document.createElement('h3'); h.textContent = o; grp.append(h);
      loci.filter(L => L.o === o).forEach(L => {
        const d = data[L.i]; const b = document.createElement('button'); b.type = 'button'; b.className = 'list-row';
        const n = document.createElement('span'); n.className = 'n'; n.textContent = pad2(L.i + 1);
        const p = document.createElement('span'); p.className = 'p'; p.textContent = L.n;
        const t = document.createElement('span'); t.className = 't' + (d && d.item ? '' : ' empty'); t.textContent = d && d.item ? d.item : '비어 있음';
        b.append(n, p, t); b.onclick = () => { $('listSheet').hidden = true; go(L.i); };
        grp.append(b);
      });
      body.append(grp);
    });
  }

  return { app, $, updateHUD, openEdit, closeEdit, readEdit, renderList };
}

export type UI = ReturnType<typeof createUI>;
