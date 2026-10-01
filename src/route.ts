import * as THREE from 'three';
import type { Locus } from './types';

interface Hop { curve: THREE.CatmullRomCurve3; reverse: boolean; from: number; to: number; t: number; dur: number }

export const ease = (k: number) => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;

// Fixed path between consecutive places: one centripetal Catmull-Rom per segment,
// cam_i → via_{i+1}… → cam_{i+1}, plus a faint brass rail drawn just below it.
export function createRoute(loci: Locus[], scene: THREE.Scene, o: { reduced: boolean; minCamY: number }) {
  const segCurves: THREE.CatmullRomCurve3[] = [];
  for (let i = 0; i < loci.length - 1; i++) {
    const pts = [loci[i].cam, ...loci[i + 1].via, loci[i + 1].cam];
    segCurves.push(new THREE.CatmullRomCurve3(pts, false, 'centripetal'));
  }
  const railMat = new THREE.MeshBasicMaterial({ color: 0xd4a85a, transparent: true, opacity: .28 });
  segCurves.forEach(cv => {
    const pts = cv.getPoints(40).map(p => p.clone().setY(Math.max(1.5, p.y - 1.3)));
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, .07, 5, false), railMat));
  });

  let queue: Hop[] = [];

  // queue one hop per segment; long jumps compress each hop
  function plan(from: number, to: number) {
    queue = [];
    const hops = Math.abs(to - from);
    let a = from;
    while (a !== to) {
      const b = a + Math.sign(to - a);
      const curve = b > a ? segCurves[a] : segCurves[b];
      const len = curve.getLength();
      const dur = o.reduced ? .001 : Math.max(hops > 1 ? .4 : .8, Math.min(hops > 1 ? 1 : 2.4, len / (hops > 1 ? 30 : 12)));
      queue.push({ curve, reverse: b < a, from: a, to: b, t: 0, dur });
      a = b;
    }
  }

  // advance along the queue; returns 'idle' | 'moving' | 'arrived'
  function step(dt: number, camPos: THREE.Vector3, lookT: THREE.Vector3) {
    if (!queue.length) return 'idle';
    const s = queue[0]; s.t = Math.min(1, s.t + dt / s.dur);
    const e = ease(s.t), u = s.reverse ? 1 - e : e;
    camPos.copy(s.curve.getPointAt(u)); camPos.y = Math.max(o.minCamY, camPos.y);
    lookT.copy(loci[s.from].F).lerp(loci[s.to].F, e);
    if (s.t >= 1) { queue.shift(); if (!queue.length) return 'arrived'; }
    return 'moving';
  }

  return { plan, step, busy: () => queue.length > 0 };
}
