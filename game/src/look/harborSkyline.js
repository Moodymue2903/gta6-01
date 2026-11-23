// VERMILION KEYS -- harbour skyline (Fix Round 8, Builder B).
// Four depth layers: foreground (road, police, spray, markings,
// barrier), midground (streetlights every 24 m, palms every 18 m,
// vehicles, buildings, signs), harbour (cargo ship, cranes, port
// lights, container stacks, water), sky (sunset gradient, cloud
// bands, distant skyline, haze). The ship sits 200-300 m out, the
// cranes are three DISTINCT silhouettes, the ocean is dark blue
// with a broad warm reflection under the sunset and low-amplitude
// displacement, relatively calm: the car chase is the focal point.
// The helicopter is the EXISTING one (userData rotor / tailRotor /
// cone / coneOuter / hotspot, scene-level pool): this module only
// improves it -- dark cockpit glass, navigation lights, tail strobe
// -- so it reads visibly above the police chase, not as a small
// icon in the sky. Repeated objects are InstancedMesh; geometry
// and materials are reused, never regenerated per frame.

import * as THREE from 'three';
import { canvasTexture, mulberry32, rand } from '../util.js';

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}
function basic(color) {
  return new THREE.MeshBasicMaterial({ color });
}

function waveNormalTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8080ff';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const g = ctx.createLinearGradient(x, y, x + 40 + Math.random() * 40, y);
      g.addColorStop(0, 'rgba(160,160,255,0.7)');
      g.addColorStop(1, 'rgba(96,96,200,0.1)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 2 + Math.random() * 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 40 + Math.random() * 40, y + (Math.random() - 0.5) * 8);
      ctx.stroke();
    }
  }, 6, 6);
}

function sunsetPathTexture() {
  return canvasTexture(256, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,180,90,0.55)');
    g.addColorStop(0.5, 'rgba(255,140,50,0.35)');
    g.addColorStop(1, 'rgba(255,120,40,0.05)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,220,160,0.25)';
    for (let i = 0; i < 26; i++) {
      const y = h * 0.5 + (Math.random() - 0.5) * h * 0.7;
      ctx.fillRect(Math.random() * w, y, 20 + Math.random() * 40, 2);
    }
  });
}

// One port gantry crane: two vertical legs, horizontal top beam,
// diagonal support, trolley + hook. Params vary so the three
// cranes do not look duplicated.
function buildCrane(x, z, height, legSpread, beamLen, trolleyX, hookDrop, accent) {
  const g = new THREE.Group();
  const steel = lambert(0x2a3138);
  const accentMat = lambert(accent);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(1.4, height, 1.4), steel);
    leg.position.set(0, height / 2, s * legSpread / 2);
    leg.castShadow = true;
    g.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 2.4), steel);
    foot.position.set(0, 0.6, s * legSpread / 2);
    g.add(foot);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, beamLen), accentMat);
  beam.position.set(0, height, 0);
  beam.castShadow = true;
  g.add(beam);
  // Diagonal support from the beam end down to the far leg.
  const diagLen = Math.hypot(height * 0.55, legSpread / 2 + 2);
  const diag = new THREE.Mesh(new THREE.BoxGeometry(0.8, diagLen, 0.8), steel);
  diag.position.set(0, height * 0.72, -legSpread / 2 - 1);
  diag.rotation.x = Math.atan2(legSpread / 2 + 2, height * 0.55) * 0.9;
  g.add(diag);
  // Trolley + cable + hook under the beam.
  const trolley = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 2.4), steel);
  trolley.position.set(0, height - 1.6, trolleyX);
  g.add(trolley);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, hookDrop, 4), steel);
  cable.position.set(0, height - 2.4 - hookDrop / 2, trolleyX);
  g.add(cable);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.9), accentMat);
  hook.position.set(0, height - 2.4 - hookDrop, trolleyX);
  g.add(hook);
  // Red warning light on the beam tip.
  const warn = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), basic(0xff2a2a));
  warn.position.set(0, height + 1.2, beamLen / 2 - 0.5);
  g.add(warn);
  g.position.set(x, -1.4, z);
  return g;
}

function buildCargoShip() {
  const g = new THREE.Group();
  const hullMat = lambert(0x263642);
  const deckMat = lambert(0x3a4a58);
  // Hull: long dark silhouette, bow tapered with a wedge.
  const hull = new THREE.Mesh(new THREE.BoxGeometry(64, 7, 15), hullMat);
  hull.position.y = 3.5;
  hull.castShadow = true;
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 13), hullMat);
  bow.rotation.y = 0.5;
  bow.position.set(35, 3, 0);
  g.add(bow);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(60, 1.2, 13.5), deckMat);
  deck.position.y = 7.4;
  g.add(deck);
  // Bridge tower with an emissive window strip.
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(9, 11, 12), lambert(0xd8d8d0));
  bridge.position.set(-24, 13, 0);
  bridge.castShadow = true;
  g.add(bridge);
  const windows = new THREE.Mesh(
    new THREE.BoxGeometry(9.2, 1.4, 12.2),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0 }),
  );
  windows.position.set(-24, 17.5, 0);
  g.add(windows);
  // Funnel: copper, with a black top.
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.2, 7, 10), lambert(0xb56d48));
  funnel.position.set(-14, 11, 0);
  g.add(funnel);
  const funnelTop = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 1.2, 10), lambert(0x1a1a20));
  funnelTop.position.set(-14, 15, 0);
  g.add(funnelTop);
  // Container stacks: one InstancedMesh, coloured per instance.
  const contGeo = new THREE.BoxGeometry(6, 2.5, 2.5);
  const contMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const cols = [0x2e8f9e, 0xd96b43, 0xe8c98f, 0x3a7ad9, 0x8a6ad9, 0x2ea88a];
  const rng = mulberry32(77);
  const spots = [];
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 7; i++) {
      const stack = 1 + Math.floor(rng() * 3);
      for (let s = 0; s < stack; s++) {
        spots.push([2 + i * 7.2, 8.6 + s * 2.6, -4.4 + row * 8.8]);
      }
    }
  }
  const conts = new THREE.InstancedMesh(contGeo, contMat, spots.length);
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  spots.forEach((p, i) => {
    m4.makeTranslation(p[0], p[1], p[2]);
    conts.setMatrixAt(i, m4);
    conts.setColorAt(i, col.setHex(cols[i % cols.length]));
  });
  conts.castShadow = true;
  g.add(conts);
  // Navigation lights: red port, green starboard, white masthead.
  const nav = [
    [0xff2a2a, 32, 8.5, -7.6], [0x2aff66, 32, 8.5, 7.6], [0xfff2d0, -24, 19.5, 0],
  ];
  for (const [c, x, y, z] of nav) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), basic(c));
    lamp.position.set(x, y, z);
    g.add(lamp);
  }
  // Ship on the open sea SOUTH-WEST of the causeway, broadside to the
  // low chase camera (long axis NE-SW, rotation -0.46), so the camera
  // sees the 64 m side + bridge + containers + funnel, not the stern.
  // (Fix round 8 small-fix, revised: broadside at (140,-45) does NOT
  // read — the north harbour is hidden from the grounded camera by
  // the tidal-gate arch tube + north pier (bridge/funnel rays) and
  // the boardwalk building at (155,-44) (containers/hull), with the
  // bow off-frame; the channel is ~90 deg off-axis and the far-north
  // water is off-frame/blocked. An analytic occlusion scan (exact
  // perspective + replicated building plots + gate geometry) over all
  // in-water placements found this one: 5 of 6 key points visible —
  // bridge, funnel, containers, hull, stern — only the bow is just
  // past the left frame edge. Fog at 300 m is ~10% (density 0.0011),
  // and the base sea (y -1.5) renders under it, so the ship floats
  // on the sunset ocean at the frame's left edge.)
  g.position.set(110, -1.5, 269);
  g.rotation.y = -0.46;
  return g;
}

export function buildHarborSkyline(game) {
  const group = new THREE.Group();
  const rng = mulberry32(20261122);
  const m4 = new THREE.Matrix4();

  // --- Layer 1: guardrails along the causeway (instanced). ---
  const railGeo = new THREE.BoxGeometry(1.9, 0.45, 0.12);
  const railMat = new THREE.MeshStandardMaterial({ color: 0x8a94a0, metalness: 0.6, roughness: 0.4 });
  const railSpots = [];
  for (let x = 196; x <= 300; x += 2) {
    railSpots.push([x, 0.62, -5.7]);
    railSpots.push([x, 0.62, 5.7]);
  }
  const rails = new THREE.InstancedMesh(railGeo, railMat, railSpots.length);
  railSpots.forEach((p, i) => {
    m4.makeTranslation(p[0], p[1], p[2]);
    rails.setMatrixAt(i, m4);
  });
  group.add(rails);

  // --- Layer 2: streetlamps every 24 m (instanced poles + heads). ---
  const lampXs = [204, 228, 252, 276, 300];
  const lampPos = [];
  for (const x of lampXs) {
    lampPos.push([x, -6.4]);
    lampPos.push([x, 6.4]);
  }
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6.2, 6);
  const poleMat = lambert(0x2a3138);
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampPos.length);
  const headGeo = new THREE.BoxGeometry(0.9, 0.18, 0.3);
  const headMat = lambert(0x1a1a20);
  const heads = new THREE.InstancedMesh(headGeo, headMat, lampPos.length);
  const bulbGeo = new THREE.SphereGeometry(0.22, 8, 6);
  const bulbMat = basic(0xffd9a0);
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, lampPos.length);
  lampPos.forEach((p, i) => {
    m4.makeTranslation(p[0], 3.1, p[1]);
    poles.setMatrixAt(i, m4);
    m4.makeTranslation(p[0], 6.25, p[1]);
    heads.setMatrixAt(i, m4);
    m4.makeTranslation(p[0], 6.1, p[1]);
    bulbs.setMatrixAt(i, m4);
  });
  group.add(poles);
  group.add(heads);
  group.add(bulbs);
  // Four real point lights at alternating lamps: nearby surfaces
  // only. Kept dim (intensity 6, distance 10): the first drive
  // render showed 12/14 blowing a huge orange smear on the road.
  const lampLights = [];
  for (const [x, z] of [[216, -6.4], [240, 6.4], [264, -6.4], [288, 6.4]]) {
    const pl = new THREE.PointLight(0xffc27a, 6, 10, 1.6);
    pl.position.set(x, 5.8, z);
    group.add(pl);
    lampLights.push(pl);
  }

  // --- Layer 2: royal palms every 18 m (instanced trunks + fronds).
  // South side skips x 236-260: that is the camera zone, and a crown
  // there would fill the lens (the fix-6 palm lesson).
  const palmSpots = [];
  for (let x = 200; x <= 296; x += 18) {
    palmSpots.push([x, -8.6]);
    if (x < 236 || x > 260) palmSpots.push([x, 8.6]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.22, 5.2, 6);
  const trunkMat = lambert(0x7a5a42);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const frondGeo = new THREE.PlaneGeometry(0.55, 2.6);
  frondGeo.translate(0, 1.3, 0);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f, side: THREE.DoubleSide });
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, palmSpots.length * 6);
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const sv = new THREE.Vector3();
  palmSpots.forEach((p, i) => {
    m4.makeTranslation(p[0], 2.6, p[1]);
    trunks.setMatrixAt(i, m4);
    for (let f = 0; f < 6; f++) {
      const ang = (f / 6) * Math.PI * 2 + i * 0.35;
      e.set(0.9, ang, 0, 'YXZ');
      q.setFromEuler(e);
      sv.set(1, 1, 1);
      m4.compose(new THREE.Vector3(p[0], 5.2, p[1]), q, sv);
      fronds.setMatrixAt(i * 6 + f, m4);
    }
  });
  group.add(trunks);
  group.add(fronds);

  // --- Layer 3: cargo ship + three distinct cranes + ocean. ---
  group.add(buildCargoShip());
  group.add(buildCrane(130, -45, 34, 9, 26, -6, 12, 0xb56d48));
  group.add(buildCrane(150, -55, 42, 11, 32, 8, 18, 0x2e8f9e));
  group.add(buildCrane(120, -60, 38, 8, 24, 2, 8, 0xd96b43));

  // Ocean: dark blue, low-amplitude vertex displacement, procedural
  // normal texture, broad warm reflection under the sunset. Calm:
  // the chase is the focal point, not the sea.
  const oceanGeo = new THREE.PlaneGeometry(700, 320, 48, 24);
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x0e4d64, metalness: 0.65, roughness: 0.18,
    normalMap: waveNormalTexture(), envMapIntensity: 0.9,
  });
  const ocean = new THREE.Mesh(oceanGeo, oceanMat);
  ocean.position.set(80, -1.4, -140);
  group.add(ocean);
  const oceanBase = oceanGeo.attributes.position.array.slice();
  // Warm sunset path on the water, elongated toward the low sun.
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(190, 60),
    new THREE.MeshBasicMaterial({
      map: sunsetPathTexture(), transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  path.rotation.x = -Math.PI / 2;
  path.rotation.z = 0.35;
  path.position.set(110, -1.3, -70);
  path.renderOrder = 1;
  group.add(path);

  // --- Layer 4: distant skyline silhouettes on the west horizon. ---
  const skylineMat = lambert(0x2a1e3a);
  const skyline = new THREE.Group();
  const towers = [
    [30, -150, 14, 26, 12], [48, -120, 18, 34, 14], [70, -160, 12, 20, 10],
    [88, -90, 16, 28, 12], [105, -140, 20, 40, 16], [55, 120, 14, 24, 12],
    [80, 150, 18, 30, 14], [100, 90, 12, 18, 10],
  ];
  for (const [x, z, w, h, d] of towers) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), skylineMat);
    t.position.set(x, h / 2 - 1.4, z);
    skyline.add(t);
  }
  // A few lit windows on the two tallest towers.
  const winMat = basic(0xffd9a0);
  for (const [x, z, h] of [[48, -120, 34], [105, -140, 40]]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.2), winMat);
    win.position.set(x, h * 0.6, z + 7.2);
    skyline.add(win);
  }
  group.add(skyline);

  game.scene.add(group);

  let t = 0;
  let heliEnhanced = false;
  let oceanTick = 0;
  return {
    group,
    lampLights,
    update(dt) {
      t += dt;
      // Ocean: gentle low-amplitude displacement, no foam, no chop.
      // Normals are recomputed every 4th tick: the displacement is
      // slow, and a full recompute every tick costs staging time.
      const pos = oceanGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const bx = oceanBase[i * 3];
        const bz = oceanBase[i * 3 + 2];
        pos.array[i * 3 + 1] =
          Math.sin(bx * 0.08 + t * 0.9) * 0.12 + Math.cos(bz * 0.06 + t * 0.6) * 0.1;
      }
      pos.needsUpdate = true;
      if ((oceanTick++ % 4) === 0) oceanGeo.computeVertexNormals();
      // Heli improvement, applied once when the police heli exists:
      // dark cockpit glass (the stock canopy is pale blue), small
      // red/green navigation lights and a white tail strobe, so the
      // heli reads as a real aircraft above the chase. The existing
      // searchlight cones and pool are left exactly as staged.
      if (!heliEnhanced && game.police && game.police.heli) {
        const heli = game.police.heli.mesh;
        heli.traverse((o) => {
          if (o.isMesh && o.material && o.material.color &&
              o.material.color.getHex() === 0x7ab8d9) {
            o.material.color.setHex(0x0e1a24);
            if (o.material.emissive) o.material.emissive.setHex(0x0a2030);
          }
        });
        const navL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), basic(0xff2a2a));
        navL.position.set(0.4, -0.4, -1.15);
        heli.add(navL);
        const navR = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), basic(0x2aff66));
        navR.position.set(0.4, -0.4, 1.15);
        heli.add(navR);
        const strobe = new THREE.Sprite(new THREE.SpriteMaterial({
          map: canvasTexture(64, 64, (ctx, w, h) => {
            const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
          }),
          color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending,
          depthWrite: false,
        }));
        strobe.scale.set(1.6, 1.6, 1);
        strobe.position.set(-5.6, 1.8, 0);
        heli.add(strobe);
        heli.userData.__enhanced = true;
        heli.userData.__strobe = strobe;
        heliEnhanced = true;
      }
      if (heliEnhanced && game.police && game.police.heli) {
        const st = game.police.heli.mesh.userData.__strobe;
        if (st) st.material.opacity = (Math.sin(t * 6) > 0.6) ? 0.9 : 0.12;
      }
    },
  };
}
