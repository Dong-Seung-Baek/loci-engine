import * as THREE from 'three';

type Color = THREE.Color | string | number;
export type Vec3 = THREE.Vector3 | [number, number, number];

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const Y = V(0, 1, 0);
export const TAU = Math.PI * 2;
export const toV = (v: Vec3) => (Array.isArray(v) ? V(v[0], v[1], v[2]) : v.clone());
export const pad2 = (n: number) => String(n).padStart(2, '0');

// Park–Miller LCG so procedural shapes come out the same on every load
export function makeRnd(seed = 7) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export function createHelpers(rnd: () => number) {
  const std = (c: Color, o: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: .8, metalness: 0, ...o });
  const basic = (c: Color) => new THREE.MeshBasicMaterial({ color: c });
  const lam = (c: Color) => new THREE.MeshLambertMaterial({ color: c });

  function tex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat?: [number, number]) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!, w, h);
    const t = new THREE.CanvasTexture(c);
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m;
  }
  function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material, seg = 6) {
    const d = b.clone().sub(a), len = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
    m.position.copy(a).add(b).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(Y, d.normalize()); return m;
  }
  function ringFacing(r: number, tube: number, mat: THREE.Material, pos: THREE.Vector3, normal: THREE.Vector3) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 36), mat);
    m.position.copy(pos); m.quaternion.setFromUnitVectors(V(0, 0, 1), normal); return m;
  }
  function tube(points: THREE.Vector3[], r: number, mat: THREE.Material, seg = 80, radial = 8) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    return new THREE.Mesh(new THREE.TubeGeometry(curve, seg, r, radial, false), mat);
  }
  function blob(r: number, sx: number, sy: number, sz: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 36, 24), mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); return m;
  }
  // a lumpy rounded block: box subdivided, pulled toward a sphere, then roughened
  function lump(w: number, h: number, d: number, round = .5, rough = .07) {
    const g = new THREE.BoxGeometry(1, 1, 1, 8, 8, 8), p = g.attributes.position, v = new THREE.Vector3();
    const a = rnd() * 10, b = rnd() * 10;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p as THREE.BufferAttribute, i);
      const s = v.clone().normalize().multiplyScalar(.62);
      v.lerp(s, round);
      const n = 1 + rough * (Math.sin(v.x * 7 + a) + Math.sin(v.y * 9 + b) + Math.sin(v.z * 8 + a * b)) / 3;
      v.multiplyScalar(n);
      p.setXYZ(i, v.x * w, v.y * h, v.z * d);
    }
    g.computeVertexNormals(); return g;
  }

  // shared scaffolding materials (stations and decor use the same brass steel)
  const M = {
    steel: std(0xc9953f, { metalness: .65, roughness: .4 }),
    bulb: basic(0xffe2a0),
  };
  const bulb = (p: THREE.Vector3, r = .16) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), M.bulb); b.position.copy(p); return b;
  };

  // ---------- decor: scale cues that are not places ----------
  function tower(cx: number, cz: number, h: number, s: number) {
    const g = new THREE.Group();
    const corners = [[-s, -s], [s, -s], [s, s], [-s, s]];
    corners.forEach(([x, z]) => g.add(rod(V(cx + x, 0, cz + z), V(cx + x, h, cz + z), .09, M.steel)));
    for (let y = 3; y <= h; y += 3) {
      corners.forEach(([x, z], k) => {
        const [x2, z2] = corners[(k + 1) % 4];
        g.add(rod(V(cx + x, y, cz + z), V(cx + x2, y, cz + z2), .06, M.steel));
        if (y < h) g.add(rod(V(cx + x, y, cz + z), V(cx + x2, y + 3, cz + z2), .035, M.steel));
      });
    }
    return g;
  }
  function truss(a: THREE.Vector3, b: THREE.Vector3, height = 1.2, n = 8) {
    const g = new THREE.Group(), up = V(0, height, 0);
    g.add(rod(a, b, .09, M.steel)); g.add(rod(a.clone().add(up), b.clone().add(up), .09, M.steel));
    for (let k = 0; k <= n; k++) {
      const p = a.clone().lerp(b, k / n); g.add(rod(p, p.clone().add(up), .05, M.steel));
      if (k < n) { const q = a.clone().lerp(b, (k + 1) / n); g.add(rod(k % 2 ? p : p.clone().add(up), k % 2 ? q.clone().add(up) : q, .035, M.steel)); }
    }
    return g;
  }
  function ladder(a: THREE.Vector3, b: THREE.Vector3, side: THREE.Vector3, rungs = 12) {
    const g = new THREE.Group();
    g.add(rod(a, b, .09, M.steel)); g.add(rod(a.clone().add(side), b.clone().add(side), .09, M.steel));
    for (let k = 1; k < rungs; k++) { const p = a.clone().lerp(b, k / rungs); g.add(rod(p, p.clone().add(side), .05, M.steel)); }
    return g;
  }

  return { V, Y, TAU, rnd, std, basic, lam, tex, box, rod, ringFacing, tube, blob, lump, M, bulb, tower, truss, ladder };
}

export type Helpers = ReturnType<typeof createHelpers>;
