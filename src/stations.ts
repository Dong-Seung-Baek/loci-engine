import * as THREE from 'three';
import { V, Y, TAU, type Helpers } from './helpers';
import type { Locus } from './types';

// sideSupport: 'stays' angles cables back to the wall (decks high on a wall);
// 'legs' drops short legs (decks just above a tabletop)
export function createStations(h: Helpers, scene: THREE.Scene, o: { sideSupport: 'stays' | 'legs' }) {
  const { rod, box, bulb, ringFacing, M } = h;
  const deckTex = h.tex(64, 64, (g, w, hh) => {
    g.fillStyle = '#2b2a30'; g.fillRect(0, 0, w, hh); g.strokeStyle = '#c9953f'; g.globalAlpha = .45; g.lineWidth = 3;
    for (let i = 0; i <= 64; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); }
  }, [2, 2]);
  const deck = new THREE.MeshStandardMaterial({ map: deckTex, metalness: .5, roughness: .6 });

  const clickables: THREE.Object3D[] = [];
  function tag(obj: THREE.Object3D, i: number) {
    obj.traverse(o => { if ((o as THREE.Mesh).isMesh || (o as THREE.Sprite).isSprite) { o.userData.locus = i; clickables.push(o); } });
  }
  function untag(obj: THREE.Object3D) { const k = clickables.indexOf(obj); if (k >= 0) clickables.splice(k, 1); }

  function spriteFromCanvas(c: HTMLCanvasElement, height: number) {
    const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
    s.scale.set(height * c.width / c.height, height, 1); return s;
  }
  function numberSprite(n: number) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(21,20,28,.9)'; g.beginPath(); g.arc(64, 64, 56, 0, TAU); g.fill();
    g.lineWidth = 6; g.strokeStyle = '#d4a85a'; g.stroke();
    g.fillStyle = '#d4a85a'; g.font = '58px Marcellus, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 68);
    return spriteFromCanvas(c, 1.1);
  }
  function textSprite(txt: string, height = .95, max = 12) {
    if (txt.length > max) txt = txt.slice(0, max - 1) + '…';
    const font = '700 44px "Noto Sans KR", sans-serif';
    const m = document.createElement('canvas').getContext('2d')!; m.font = font;
    const w = Math.min(1024, Math.ceil(m.measureText(txt).width) + 48);
    const c = document.createElement('canvas'); c.width = w; c.height = 84; const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(239,230,210,.96)'; const r = 18;
    g.beginPath(); g.moveTo(r, 0); g.arcTo(w, 0, w, 84, r); g.arcTo(w, 84, 0, 84, r); g.arcTo(0, 84, 0, 0, r); g.arcTo(0, 0, w, 0, r); g.fill();
    g.fillStyle = '#1a1622'; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, 45);
    return spriteFromCanvas(c, height);
  }

  // Scaffolding shape follows the surface normal: lantern arm (pin), side deck, top frame, hanging frame.
  function build(L: Locus) {
    const g = new THREE.Group(); const F = L.F, N = L.N;
    if (L.pin) {
      const T = Y.clone().cross(N).normalize();
      const end = F.clone().addScaledVector(N, 2).add(V(0, -.6, 0));
      g.add(rod(F.clone().addScaledVector(N, .1), end, .06, M.steel));
      g.add(rod(end, end.clone().add(V(0, 1.1, 0)), .05, M.steel));
      g.add(bulb(end.clone().add(V(0, 1.25, 0)), .2));
      const cage = new THREE.Mesh(new THREE.TorusGeometry(.42, .04, 6, 20), M.steel); cage.position.copy(end).add(V(0, 1.25, 0)); cage.rotation.x = Math.PI / 2; g.add(cage);
      L.signPos = F.clone().addScaledVector(N, 1.5).addScaledVector(T, 1.6).add(V(0, .9, 0));
      L.itemPos = F.clone().addScaledVector(N, 1.2).add(V(0, 2.4, 0));
    } else if (Math.abs(N.y) < .5) {
      const T = Y.clone().cross(N).normalize();
      const W = L.w || 3, D = 2.4;
      const c = F.clone().addScaledVector(N, D / 2 + .1); c.y -= 1.3;
      const d = box(W, .14, D, deck); d.position.copy(c);
      d.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(T, Y, N)); g.add(d);
      const at = (t: number, n: number, y = 0) => c.clone().addScaledVector(T, t).addScaledVector(N, n).add(V(0, y, 0));
      const ex = W / 2 - .06, en = D / 2 - .06;
      [-ex, 0, ex].forEach(t => g.add(rod(at(t, en), at(t, en, 1.1), .05, M.steel)));
      [-ex, ex].forEach(t => g.add(rod(at(t, -en + .4), at(t, -en + .4, 1.1), .05, M.steel)));
      g.add(rod(at(-ex, en, 1.1), at(ex, en, 1.1), .06, M.steel));
      [-ex, ex].forEach(t => g.add(rod(at(t, en, 1.1), at(t, -en + .4, 1.1), .05, M.steel)));
      if (o.sideSupport === 'legs') [-ex, ex].forEach(t => g.add(rod(at(t, en), at(t, en, -1.2), .05, M.steel)));
      else [-ex + .1, ex - .1].forEach(t => g.add(rod(at(t, en, 1.1), at(t, -D / 2 - .1, 2.8), .035, M.steel)));
      g.add(rod(at(-ex, en), at(-ex, en, 2.3), .05, M.steel));
      g.add(bulb(at(-ex, en, 2.4)));
      L.signPos = F.clone().addScaledVector(N, 1.2).addScaledVector(T, W / 2 + .7).add(V(0, .3, 0));
      L.itemPos = F.clone().addScaledVector(N, 1.1).add(V(0, 2.3, 0));
    } else if (N.y > 0) {
      const s = L.s || 1.6, H = 2.1;
      const p = (x: number, z: number, y = 0) => V(F.x + x, F.y + y, F.z + z);
      [[-s, -s], [s, -s], [s, s], [-s, s]].forEach(([x, z]) => g.add(rod(p(x, z, -.6), p(x, z, H), .06, M.steel)));
      [[[-s, -s], [s, -s]], [[s, -s], [s, s]], [[s, s], [-s, s]], [[-s, s], [-s, -s]]].forEach(([a, b]) => g.add(rod(p(a[0], a[1], H), p(b[0], b[1], H), .06, M.steel)));
      g.add(bulb(p(s, s, H + .2)));
      L.signPos = p(s + 1, 0, H + .3);
      L.itemPos = p(0, 0, H + 1.1);
    } else {
      const s = L.s || 1.4, H = L.h || 1.2;
      const p = (x: number, z: number, y = 0) => V(F.x + x, F.y + y, F.z + z);
      [[-s, -s], [s, -s], [s, s], [-s, s]].forEach(([x, z]) => g.add(rod(p(x, z), p(x, z, -H), .05, M.steel)));
      [[[-s, -s], [s, -s]], [[s, -s], [s, s]], [[s, s], [-s, s]], [[-s, s], [-s, -s]]].forEach(([a, b]) => g.add(rod(p(a[0], a[1], -H), p(b[0], b[1], -H), .06, M.steel)));
      [[-s, s], [s, s]].forEach(([x, z]) => g.add(bulb(p(x, z, -H - .15), .14)));
      L.signPos = p(s + 1.2, 0, -H + .3);
      L.itemPos = p(-(s + 1.8), 0, -H + .4);
    }
    L.ringMat = new THREE.MeshBasicMaterial({ color: 0xd4a85a, transparent: true, opacity: .55 });
    L.ring = ringFacing(L.w || L.pin ? .75 : 1.0, .07, L.ringMat, F.clone().addScaledVector(N, .12), N); g.add(L.ring);
    scene.add(g); L.station = g; tag(g, L.i);
    L.sign = numberSprite(L.i + 1); L.sign.position.copy(L.signPos); scene.add(L.sign); tag(L.sign, L.i);
  }

  // the floating name tag shown above a place once something is stored there
  function setItem(L: Locus, text: string | undefined) {
    if (L.item) {
      scene.remove(L.item); L.item.material.map!.dispose(); L.item.material.dispose(); untag(L.item); L.item = null;
    }
    if (text) { L.item = textSprite(text); L.item.position.copy(L.itemPos); scene.add(L.item); tag(L.item, L.i); }
  }

  return { build, setItem, clickables };
}
