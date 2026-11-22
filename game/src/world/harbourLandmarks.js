// VERMILION KEYS — harbour landmarks (Fix Round 7, C4).
// The signature silhouette: copper (0xb87333) + turquoise (0x19b8ad)
// + limestone. One huge arched copper tidal gate spanning the causeway
// west of the hero, two smaller copper arched bridges over the water
// channels flanking the east causeway, a stepped waterfront warehouse
// on the Caldera Docks quay, turquoise water channels, and illuminated
// dock signage. NO colliders are added: the gate's towers stand
// off-road (z +/-9.5, road half-width 5) and the arch clears 8 m over
// the road, so traffic — including the braked cover queue at x 200-224
// — drives straight under it.

import * as THREE from 'three';
import { canvasTexture } from '../util.js';

const COPPER = 0xb87333;
const COPPER_DARK = 0x8a5a28;
const TURQUOISE = 0x19b8ad;
const LIMESTONE = 0xf2e6d8;
const TERRACOTTA = 0xd96b43;

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}

// Emissive canvas-texture sign: the font shrinks until the line fits
// (the garage sign's fix-4 lesson: text clipped inside the texture).
function signTexture(text, sub, fg = '#ffd9a0', bg = '#140a18') {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    let fs = 52;
    ctx.font = `bold ${fs}px Arial`;
    while (ctx.measureText(text).width > w - 60 && fs > 12) {
      fs -= 2;
      ctx.font = `bold ${fs}px Arial`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = fg;
    ctx.shadowBlur = 16;
    ctx.fillStyle = fg;
    ctx.fillText(text, w / 2, sub ? h / 2 - 16 : h / 2);
    if (sub) {
      ctx.font = 'bold 24px Arial';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#9fd8ff';
      ctx.fillText(sub, w / 2, h / 2 + 30);
    }
  });
}

function signPlane(text, sub, w, h, fg) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: signTexture(text, sub, fg) }),
  );
  return m;
}

// A copper arch standing in the YZ plane (span across z, apex up):
// a half-torus (arc PI = upper half) plus two pier boxes at its feet.
function copperArch(cx, cz, radius, tube, pierH) {
  const arch = new THREE.Group();
  const torus = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 32, Math.PI), lambert(COPPER));
  torus.rotation.y = Math.PI / 2; // XY plane -> ZY plane, arch over z
  torus.position.y = 0;
  torus.castShadow = true;
  arch.add(torus);
  for (const s of [-1, 1]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(2.4, pierH, 2.4), lambert(COPPER_DARK));
    pier.position.set(0, pierH / 2, s * radius);
    pier.castShadow = true;
    arch.add(pier);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(3, 0.7, 3), lambert(TURQUOISE));
    cap.position.set(0, pierH + 0.35, s * radius);
    arch.add(cap);
  }
  arch.position.set(cx, 0, cz);
  return arch;
}

export function buildHarbourLandmarks(game) {
  const g = new THREE.Group();

  // --- The tidal gate: x = 210, spanning the causeway. ---
  // Cover camera at (263, 2, 6.2) looks west-northwest, so the gate
  // stands ~53 m out, dead centre of the background, behind the
  // braked queue (x 200-224) and the roadblock. Towers at z +/-9.5
  // are off the road; the arch clears ~8 m over the carriageway.
  const gate = copperArch(210, 0, 9.5, 1.1, 9);
  g.add(gate);
  // Turquoise inlay ring following the arch, slightly east of it.
  const inlay = new THREE.Mesh(new THREE.TorusGeometry(9.5, 0.32, 6, 32, Math.PI), lambert(TURQUOISE));
  inlay.rotation.y = Math.PI / 2;
  inlay.position.set(211.4, 0, 0);
  g.add(inlay);
  // Keystone + beacon at the apex.
  const key = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), lambert(COPPER_DARK));
  key.position.set(210, 10.4, 0);
  key.castShadow = true;
  g.add(key);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
  beacon.position.set(210, 12.2, 0);
  g.add(beacon);
  // "VERMILION KEYS" on the arch, facing east toward the cover camera.
  const gateSign = signPlane('VERMILION KEYS', 'TIDAL GATE · EST. 1962', 13, 3.2, '#ffd9a0');
  gateSign.position.set(211.6, 7.6, 0);
  gateSign.rotation.y = Math.PI / 2;
  g.add(gateSign);

  // --- Two smaller copper bridges over the water channels flanking
  // the east causeway (the strips x 230-250, |z| 14-40, are open
  // water beside the causeway deck). Decks run north-south, arches
  // over the water, piers in the shallows — never over the road.
  for (const [bx, bz] of [[238, -24], [246, 24]]) {
    const bridge = copperArch(bx, bz, 10, 0.55, 2.5);
    g.add(bridge);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 21), lambert(0x8a7a6a));
    deck.position.set(bx, 2.4, bz);
    deck.castShadow = true;
    g.add(deck);
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 21), lambert(COPPER));
      rail.position.set(bx + s * 1.05, 3.1, bz);
      g.add(rail);
    }
  }

  // --- Stepped waterfront warehouse, Caldera Docks quay (462, -160).
  // East of the container yard (yard ends x 445) and clear of the
  // lighthouse at (470, -195). Three steps: limestone base, terracotta
  // middle, copper crown — the stepped silhouette reads from the
  // combat frame's east edge and from the port road.
  const wh = new THREE.Group();
  wh.position.set(462, 0, -160);
  const base = new THREE.Mesh(new THREE.BoxGeometry(30, 8, 20), lambert(LIMESTONE));
  base.position.y = 4;
  base.castShadow = true;
  wh.add(base);
  const mid = new THREE.Mesh(new THREE.BoxGeometry(22, 6, 15), lambert(TERRACOTTA));
  mid.position.y = 11;
  mid.castShadow = true;
  wh.add(mid);
  const top = new THREE.Mesh(new THREE.BoxGeometry(14, 5, 10), lambert(COPPER));
  top.position.y = 16.5;
  top.castShadow = true;
  wh.add(top);
  // Turquoise window band on the south face + copper roof trim.
  const band = new THREE.Mesh(new THREE.BoxGeometry(24, 1.2, 0.3), lambert(TURQUOISE));
  band.position.set(0, 6.2, 10.1);
  wh.add(band);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(31, 0.6, 21), lambert(COPPER_DARK));
  trim.position.y = 8.2;
  wh.add(trim);
  g.add(wh);

  // --- Turquoise water channels (planes just above the base sea at
  // y -1.5): the two causeway channels and the port quay channel.
  const channelMat = new THREE.MeshLambertMaterial({ color: TURQUOISE, transparent: true, opacity: 0.85 });
  for (const [cx, cz, w, d] of [
    [240, -27, 16, 26],
    [240, 27, 16, 26],
    [380, -200, 160, 10],
  ]) {
    const ch = new THREE.Mesh(new THREE.PlaneGeometry(w, d), channelMat);
    ch.rotation.x = -Math.PI / 2;
    ch.position.set(cx, -1.2, cz);
    g.add(ch);
  }

  // --- Illuminated dock signage. ---
  // "MARINA DELI": kiosk on the Coral Marina quay (80, -138).
  const kiosk = new THREE.Group();
  kiosk.position.set(80, 0, -138);
  const kioskBox = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 5), lambert(LIMESTONE));
  kioskBox.position.y = 2;
  kioskBox.castShadow = true;
  kiosk.add(kioskBox);
  const kioskRoof = new THREE.Mesh(new THREE.BoxGeometry(7, 0.4, 6), lambert(TERRACOTTA));
  kioskRoof.position.y = 4.2;
  kiosk.add(kioskRoof);
  const deliSign = signPlane('MARINA DELI', 'COFFEE · BAIT · ICE', 5.4, 1.4, '#9fd8ff');
  deliSign.position.set(0, 3.1, 2.6);
  kiosk.add(deliSign);
  g.add(kiosk);
  // "SUNSET MOTORS": dockside workshop hut by the port road (300, -88).
  const hut = new THREE.Group();
  hut.position.set(300, 0, -88);
  const hutBox = new THREE.Mesh(new THREE.BoxGeometry(8, 4.5, 6), lambert(0x8a7a6a));
  hutBox.position.y = 2.25;
  hutBox.castShadow = true;
  hut.add(hutBox);
  const hutRoof = new THREE.Mesh(new THREE.BoxGeometry(9, 0.4, 7), lambert(COPPER));
  hutRoof.position.y = 4.7;
  hut.add(hutRoof);
  const motorsSign = signPlane('SUNSET MOTORS', 'REPAIRS · SPARES', 7, 1.8, '#ffd9a0');
  motorsSign.position.set(0, 3.4, 3.1);
  hut.add(motorsSign);
  g.add(hut);

  game.scene.add(g);
  return g;
}
