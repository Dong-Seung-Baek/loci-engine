import * as THREE from 'three';
import { createHelpers, makeRnd, toV } from './helpers';
import { createUI } from './ui';
import { createStations } from './stations';
import { createRoute } from './route';
import { createDroneCamera } from './camera';
import { updateOcclusion } from './occlusion';
import { createWim } from './wim';
import { localStore, type PalaceData } from './storage';
import type { Locus, PalaceOptions } from './types';

export { THREE };
export type { PalaceOptions, LocusDef, Locus, BuildContext } from './types';
export type { Storage, PalaceData, Entry } from './storage';

export const version = __VERSION__;

export function create(opts: PalaceOptions) {
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = opts.storage || localStore(opts.storageKey);
  const ui = createUI(opts);
  const { $ } = ui;

  // ---------- renderer / scene ----------
  const canvas = $<HTMLCanvasElement>('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(opts.theme.background);
  scene.fog = new THREE.Fog(opts.theme.background, opts.theme.fog[0], opts.theme.fog[1]);

  // ---------- palace content ----------
  const h = createHelpers(makeRnd(opts.seed ?? 7));
  const ctx = { THREE, scene, renderer, h };
  const defs = opts.build(ctx);
  const loci = defs.map((d, i) => ({
    ...d, i, F: toV(d.F), N: toV(d.N).normalize(), cam: toV(d.cam), via: (d.via || []).map(toV), item: null,
  })) as unknown as Locus[];
  const groups = opts.groups || [...new Set(loci.map(L => L.o))];

  const stations = createStations(h, scene, { sideSupport: opts.sideSupport ?? 'stays' });
  const route = createRoute(loci, scene, { reduced: REDUCED, minCamY: opts.minCamY ?? 2, railMinY: opts.railMinY ?? 1.5 });
  const drone = createDroneCamera(canvas, loci[0].cam, loci[0].F);
  const camera = drone.camera;

  // ---------- state ----------
  let data: PalaceData = store.load() || JSON.parse(JSON.stringify(opts.example || {}));
  let cur = 0, openAfter = false;

  const refreshItem = (i: number) => stations.setItem(loci[i], data[i] && data[i].item);
  const hud = () => ui.updateHUD(loci, cur, data);
  const openEdit = (i: number) => ui.openEdit(loci[i], data[i]);

  function travelTo(j: number, open: boolean) {
    j = Math.max(0, Math.min(loci.length - 1, j));
    if (j === cur && !route.busy()) { if (open) openEdit(j); return; }
    route.plan(cur, j);
    openAfter = open; cur = j; hud();
  }

  // ---------- HUD wiring ----------
  $('editForm').addEventListener('submit', e => {
    e.preventDefault();
    const { item, img } = ui.readEdit();
    if (item || img) data[cur] = { item, img }; else delete data[cur];
    store.save(data); refreshItem(cur); hud(); ui.closeEdit();
  });
  $('edCancel').onclick = ui.closeEdit;
  $('edClear').onclick = () => { delete data[cur]; store.save(data); refreshItem(cur); hud(); ui.closeEdit(); };
  $('caption').onclick = () => openEdit(cur);
  $('prevBtn').onclick = () => travelTo(cur - 1, false);
  $('nextBtn').onclick = () => travelTo(cur + 1, false);
  $('recenterBtn').onclick = drone.recenter;
  $('listBtn').onclick = () => { ui.renderList(loci, data, groups, i => travelTo(i, false)); $('listSheet').hidden = false; };
  $('listClose').onclick = () => { $('listSheet').hidden = true; };
  addEventListener('keydown', e => {
    if ((e.target as HTMLElement).matches('input,textarea')) return;
    if (e.key === 'ArrowRight' || e.key === ' ') travelTo(cur + 1, false);
    if (e.key === 'ArrowLeft') travelTo(cur - 1, false);
  });

  const wim = createWim({
    scene, el: $('wim'), position: opts.wim.position, lookAt: opts.wim.lookAt, markerScale: opts.wim.markerScale,
    background: opts.theme.wimBackground ?? 0x100d0b, loci, onPick: i => travelTo(i, false),
  });

  // ---------- tap to pick a place ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const shown = (o: THREE.Object3D | null) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  drone.setOnTap((x, y) => {
    if (wim.isBig()) { wim.setBig(false); return; }
    ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera); ray.layers.set(0);
    const hit = ray.intersectObjects(stations.clickables, false).find(hit => shown(hit.object));
    if (hit && hit.distance < 40) travelTo(hit.object.userData.locus, true);
  });

  // ---------- loop ----------
  function resize() { renderer.setSize(innerWidth, innerHeight, false); drone.resize(innerWidth, innerHeight); }
  addEventListener('resize', resize);
  const clock = new THREE.Clock(); let time = 0;
  const recenterBtn = $('recenterBtn');
  function frame() {
    const dt = Math.min(clock.getDelta(), .05); time += dt;
    const state = route.step(dt, drone.camPos, drone.lookT);
    if (state === 'arrived' && openAfter) { openAfter = false; openEdit(cur); }
    drone.update(dt, state !== 'idle');
    recenterBtn.style.visibility = drone.turned() ? 'visible' : 'hidden';

    updateOcclusion(loci, cur, drone.camPos);
    loci.forEach(L => {
      const on = L.i === cur;
      L.ringMat.opacity = on ? .6 + .4 * Math.sin(time * 4) : .35; L.ring.scale.setScalar(on ? 1 + .08 * Math.sin(time * 4) : 1);
    });
    opts.onFrame?.(time, dt);

    renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight); renderer.render(scene, camera);
    wim.render(renderer, innerHeight, drone.camPos, time);
    requestAnimationFrame(frame);
  }

  // ---------- boot: sprites need the fonts, so wait for them (but not forever) ----------
  const fonts = ['58px Marcellus', '700 44px "Noto Sans KR"', ...(opts.preloadFonts || [])];
  Promise.race([
    Promise.all(fonts.map(f => document.fonts.load(f, opts.title + '1'))),
    new Promise(r => setTimeout(r, 1800)),
  ]).catch(() => {}).then(() => {
    opts.ready?.(ctx);
    loci.forEach(L => { stations.build(L); refreshItem(L.i); });
    resize(); hud();
    $('loading').hidden = true;
    if (!store.getFlag('hint')) $('hint').hidden = false;
    frame();
  });
  $('hintOk').onclick = () => { $('hint').hidden = true; store.setFlag('hint', 1); };

  return { THREE, scene, renderer, camera, loci, travelTo, get current() { return cur; } };
}
