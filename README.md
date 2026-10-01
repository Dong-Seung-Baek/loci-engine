# loci-engine

Method-of-loci (memory palace) engine on three.js. A palace is a single local HTML file that loads this engine with a classic `<script>` tag and describes its scene and places; the engine supplies the drone camera, fixed route, scaffolding, occlusion hiding, the worlds-in-miniature overview, the HUD and storage.

```html
<script src="https://cdn.jsdelivr.net/gh/Dong-Seung-Baek/loci-engine@v0.1.0/dist/loci-engine.iife.js"></script>
<script>
LociEngine.create({
  title: '꼬치 궁전',
  subtitle: '잔 → 접시 둘레 → 꼬치 사이 골짜기 · 20곳',
  storageKey: 'loci-skewer:v2',          // unique prefix per palace: file:// pages share localStorage
  theme: { background: 0x1a1512, fog: [75, 180] },
  wim: { position: [26, 78, 72], lookAt: [0, 2, -9] },
  groups: ['잔과 뒤쪽', '왼쪽', '가운데', '오른쪽과 앞쪽'],
  build({ THREE, scene, h }) {
    // add lights and meshes to `scene`, then return the places in route order
    return [{ o: '잔과 뒤쪽', f: '잔', n: '유리잔 테두리', F: [5, 24, -40.4], N: [0, 0, 1], cam: [5, 29, -26], pin: true }];
  },
});
</script>
```

- Build is IIFE (global `LociEngine`) with three.js r128 bundled and exposed as `LociEngine.THREE`, so it works from `file://`.
- Place fields: `o`/`f`/`n` group, face, name · `F` surface point · `N` outward normal (picks the scaffolding) · `cam` drone position · `via` waypoints from the previous place · `w` deck width · `s` frame half width · `h` hanging frame height · `pin` lantern arm.
- Other options: `sideSupport` ('stays' cables to the wall, or 'legs' for decks just above a tabletop), `railMinY`, `ready(ctx)` (after fonts load), `hint`, `example`, `listNote`, `placeholders`, `loadingText`, `seed`, `minCamY`, `preloadFonts`, `onFrame(time, dt)`, `storage`.
- `wim.markerScale` sizes the drone marker in the overview.
- `h` helpers: `V Y TAU rnd std basic lam tex box rod ringFacing tube blob lump M bulb tower truss ladder`.

## Develop

```sh
npm install
npm run build                                 # dist/loci-engine.iife.js
node test/shots.mjs examples/skewer.html out  # 390×780 screenshot per place (swiftshader)
node test/smoke.mjs examples/skewer.html      # edit/save/reload, overview jump, recenter
```

Tests serve this checkout's `dist` in place of any jsDelivr-pinned engine, so palace files that live elsewhere can be tested against unreleased changes. CI fails if the committed `dist/` is stale or a `v*` tag doesn't match `package.json`.

MIT licensed. Fonts (Marcellus, Gowun Batang, Noto Sans KR) load from Google Fonts under the OFL.
