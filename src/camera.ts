import * as THREE from 'three';

// Drone view: world +Y is always up. The drone flies the route; dragging only turns the head.
export function createDroneCamera(canvas: HTMLCanvasElement, start: THREE.Vector3, target: THREE.Vector3) {
  const camera = new THREE.PerspectiveCamera(70, 1, .1, 400);
  camera.rotation.order = 'YXZ';
  const camPos = start.clone();
  const lookT = target.clone();
  let offYaw = 0, offPitch = 0, recenter = false;
  let onTap: (x: number, y: number) => void = () => {};

  let look: { id: number; x: number; y: number; sx: number; sy: number; t: number; moved: number } | null = null;
  canvas.addEventListener('pointerdown', e => {
    if (look) return; canvas.setPointerCapture(e.pointerId);
    look = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0 };
  });
  canvas.addEventListener('pointermove', e => {
    if (!look || e.pointerId !== look.id) return;
    const dx = e.clientX - look.x, dy = e.clientY - look.y; look.x = e.clientX; look.y = e.clientY;
    look.moved = Math.max(look.moved, Math.hypot(e.clientX - look.sx, e.clientY - look.sy));
    if (look.moved > 6) { recenter = false; offYaw = Math.max(-2.8, Math.min(2.8, offYaw - dx * .005)); offPitch = Math.max(-1.3, Math.min(1.3, offPitch - dy * .004)); }
  });
  const lookEnd = (e: PointerEvent) => {
    if (!look || e.pointerId !== look.id) return;
    const tap = look.moved < 8 && performance.now() - look.t < 400; look = null;
    if (tap) onTap(e.clientX, e.clientY);
  };
  canvas.addEventListener('pointerup', lookEnd); canvas.addEventListener('pointercancel', lookEnd);

  function resize(w: number, h: number) {
    camera.aspect = w / h; camera.fov = w < h ? 80 : 66; camera.updateProjectionMatrix();
  }

  // travelling eases the head back to the place; "정면" does the same faster
  function update(dt: number, travelling: boolean) {
    if (travelling) { const k = Math.exp(-5 * dt); offYaw *= k; offPitch *= k; }
    else if (recenter) {
      const k = Math.exp(-8 * dt); offYaw *= k; offPitch *= k;
      if (Math.abs(offYaw) + Math.abs(offPitch) < .002) { offYaw = offPitch = 0; recenter = false; }
    }
    const d = lookT.clone().sub(camPos);
    const yaw0 = Math.atan2(-d.x, -d.z), pitch0 = Math.atan2(d.y, Math.hypot(d.x, d.z));
    camera.position.copy(camPos);
    camera.rotation.set(Math.max(-1.52, Math.min(1.52, pitch0 + offPitch)), yaw0 + offYaw, 0);
  }

  return {
    camera, camPos, lookT, resize, update,
    recenter: () => { recenter = true; },
    turned: () => Math.abs(offYaw) + Math.abs(offPitch) > .05,
    setOnTap: (fn: typeof onTap) => { onTap = fn; },
  };
}
