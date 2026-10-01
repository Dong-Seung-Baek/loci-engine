import * as THREE from 'three';
import type { Locus } from './types';

const tmp = new THREE.Vector3();

// Hide any other place whose deck, sign or tag sits on the line of sight to the current one.
// Hidden objects also drop out of tap picking (picking checks visibility up the parent chain).
export function updateOcclusion(loci: Locus[], cur: number, camPos: THREE.Vector3) {
  const tgt = loci[cur].F, ab = tgt.clone().sub(camPos), ab2 = ab.lengthSq();
  loci.forEach(L => {
    let show = true;
    if (L.i !== cur && ab2 > 0) {
      for (const p of [L.F, L.signPos, L.itemPos]) {
        const t = tmp.copy(p).sub(camPos).dot(ab) / ab2;
        if (t > .02 && t < .92 && tmp.copy(camPos).addScaledVector(ab, t).distanceTo(p) < 2.6) { show = false; break; }
      }
    }
    L.station.visible = show; L.sign.visible = show; if (L.item) L.item.visible = show;
  });
}
