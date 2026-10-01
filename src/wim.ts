import * as THREE from 'three';
import { toV, type Vec3 } from './helpers';
import type { Locus } from './types';

// Worlds-in-miniature: a second camera drawn into a scissored corner of the same canvas.
// The drone marker lives on layer 1, which only this camera sees.
export function createWim(o: {
  scene: THREE.Scene; el: HTMLElement; position: Vec3; lookAt: Vec3; markerScale?: number; background: number;
  loci: Locus[]; onPick: (i: number) => void;
}) {
  const cam = new THREE.PerspectiveCamera(38, 1, 1, 400);
  cam.position.copy(toV(o.position)); cam.lookAt(toV(o.lookAt));
  cam.layers.enable(1);
  const bg = new THREE.Color(o.background);

  const drone = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2, .24, 8, 32), new THREE.MeshBasicMaterial({ color: 0xd4a85a })); ring.rotation.x = Math.PI / 2;
  drone.add(core, ring); drone.scale.setScalar(o.markerScale ?? 1); drone.traverse(c => c.layers.set(1)); o.scene.add(drone);

  const isBig = () => o.el.classList.contains('big');
  const setBig = (on: boolean) => { o.el.classList.toggle('big', on); };

  o.el.addEventListener('click', e => {
    if ((e.target as HTMLElement).id === 'wimClose') { setBig(false); return; }
    if (!isBig()) { setBig(true); return; }
    const r = o.el.getBoundingClientRect(); let best = -1, bd = 30;
    o.loci.forEach(L => {
      const p = L.F.clone().project(cam); const x = r.left + (p.x + 1) / 2 * r.width, y = r.top + (1 - p.y) / 2 * r.height;
      const d = Math.hypot(x - e.clientX, y - e.clientY); if (d < bd) { bd = d; best = L.i; }
    });
    if (best >= 0) { setBig(false); o.onPick(best); }
  });

  function render(renderer: THREE.WebGLRenderer, viewH: number, dronePos: THREE.Vector3, time: number) {
    drone.position.copy(dronePos); ring.rotation.z = time * 2;
    const r = o.el.getBoundingClientRect();
    if (r.width <= 0) return;
    renderer.setScissorTest(true);
    const y = viewH - r.bottom;
    renderer.setViewport(r.left, y, r.width, r.height); renderer.setScissor(r.left, y, r.width, r.height);
    cam.aspect = r.width / r.height; cam.updateProjectionMatrix();
    const prev = o.scene.background; o.scene.background = bg;
    renderer.render(o.scene, cam); o.scene.background = prev;
    renderer.setScissorTest(false);
  }

  return { render, isBig, setBig };
}
