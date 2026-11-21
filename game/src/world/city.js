// VERMILION KEYS — city: authored spine + procedural infill.
// Ground, roads and sidewalks are merged into a few meshes; buildings,
// palms and lamps are InstancedMesh; landmarks are individual meshes.
// The drawbridge on the east causeway is a live world event: when it is UP
// the span is a ramp with a gap cars can leap.

import * as THREE from 'three';
import { PALETTE, canvasTexture, choice, mulberry32, rand, randInt } from '../util.js';
import { CAUSEWAYS, DRAWBRIDGE, GRAPH, ISLANDS, isLand, lanePoint, nearestRoadPoint } from './roadNetwork.js';

// Collect quads into one BufferGeometry (positions, normals, uvs, indices).
class QuadSoup {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.idx = [];
    this.v = 0;
  }
  quad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, u0 = 0, v0 = 0, u1 = 1, v1 = 1) {
    this.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
    for (let i = 0; i < 4; i++) this.nor.push(0, 1, 0);
    this.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    this.idx.push(this.v, this.v + 1, this.v + 2, this.v, this.v + 2, this.v + 3);
    this.v += 4;
  }
  build(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true;
    return m;
  }
}

function windowTexture(base, lit) {
  // Light base so the instance colour reads vividly; windows are dark
  // glass with some lit warm, so towers read as coloured, not muddy.
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let y = 12; y < h - 10; y += 22) {
      for (let x = 10; x < w - 10; x += 18) {
        ctx.fillStyle = Math.random() < 0.42 ? lit : '#33272e';
        ctx.fillRect(x, y, 10, 14);
      }
    }
  });
}

export function buildCity(scene, rng) {
  const colliders = [];
  const animated = { ferris: null, ferrisCabins: [], beam: null, mastLight: null, bridgeLeafE: null, bridgeLeafW: null, waterTex: null };

  // --- Water: one big teal plane with a scrolling wave texture. ---
  const waterTex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2e8f9e';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,220,170,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const y = Math.random() * h;
      ctx.beginPath();
      ctx.moveTo(Math.random() * w, y);
      ctx.lineTo(Math.random() * w + 40, y + (Math.random() - 0.5) * 8);
      ctx.stroke();
    }
  }, 24, 24);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(2600, 2600),
    new THREE.MeshLambertMaterial({ map: waterTex, color: 0x9fd8dd }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -1.5;
  scene.add(water);
  animated.waterTex = waterTex;

  // --- Island ground slabs. ---
  const groundCols = { downtown: 0x8a7a6a, boardwalk: 0xa88a68, port: 0x7d7468 };
  for (const isl of ISLANDS) {
    const w = isl.x1 - isl.x0;
    const d = isl.z1 - isl.z0;
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshLambertMaterial({ color: groundCols[isl.name] }),
    );
    g.rotation.x = -Math.PI / 2;
    g.position.set((isl.x0 + isl.x1) / 2, 0, (isl.z0 + isl.z1) / 2);
    g.receiveShadow = true;
    scene.add(g);
  }
  // Beach sand strip along the boardwalk island's south edge.
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 46),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(80, 0.02, 137);
  beach.receiveShadow = true;
  scene.add(beach);
  // Causeway decks: west causeway whole; east causeway only the approach
  // west of the drawbridge leaves (the leaves are the road over the span).
  const westDeck = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 28),
    new THREE.MeshLambertMaterial({ color: 0x6a5a52 }),
  );
  westDeck.rotation.x = -Math.PI / 2;
  westDeck.position.set(-80, 0.05, 0);
  westDeck.receiveShadow = true;
  scene.add(westDeck);
  const eastApproach = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 28),
    new THREE.MeshLambertMaterial({ color: 0x6a5a52 }),
  );
  eastApproach.rotation.x = -Math.PI / 2;
  eastApproach.position.set(231, 0.05, 0);
  eastApproach.receiveShadow = true;
  scene.add(eastApproach);
  void CAUSEWAYS;

  // --- Roads + sidewalks, merged into two meshes. ---
  const roadSoup = new QuadSoup();
  const walkSoup = new QuadSoup();
  for (const e of GRAPH.edges) {
    const dx = e.bx - e.ax;
    const dz = e.bz - e.az;
    const len = e.len;
    const px = -e.dz * 5;
    const pz = e.dx * 5;
    const y = 0.06;
    // Road surface.
    roadSoup.quad(
      e.ax - px, y, e.az - pz, e.ax + px, y, e.az + pz,
      e.bx + px, y, e.bz + pz, e.bx - px, y, e.bz - pz,
      0, 0, len / 12, 1,
    );
    // Sidewalks on both sides.
    for (const s of [1, -1]) {
      const ox = -e.dz * 6.8 * s;
      const oz = e.dx * 6.8 * s;
      walkSoup.quad(
        e.ax - px * 0.36 + ox, 0.04, e.az - pz * 0.36 + oz,
        e.ax + px * 0.36 + ox, 0.04, e.az + pz * 0.36 + oz,
        e.bx + px * 0.36 + ox, 0.04, e.bz + pz * 0.36 + oz,
        e.bx - px * 0.36 + ox, 0.04, e.bz - pz * 0.36 + oz,
      );
    }
  }
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  scene.add(roadSoup.build(roadMat));
  scene.add(walkSoup.build(new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk })));

  // Centre dashes: one instanced mesh.
  const dashGeo = new THREE.BoxGeometry(2.2, 0.05, 0.35);
  const dashMat = new THREE.MeshBasicMaterial({ color: PALETTE.asphaltLine });
  const dashSpots = [];
  for (const e of GRAPH.edges) {
    for (let d = 4; d < e.len - 2; d += 7) {
      const t = d / e.len;
      dashSpots.push({ x: e.ax + (e.bx - e.ax) * t, z: e.az + (e.bz - e.az) * t, h: Math.atan2(e.dx, e.dz) });
    }
  }
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashSpots.length);
  const m4 = new THREE.Matrix4();
  const q4 = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  dashSpots.forEach((s, i) => {
    q4.setFromAxisAngle(up, s.h);
    m4.compose(new THREE.Vector3(s.x, 0.08, s.z), q4, new THREE.Vector3(1, 1, 1));
    dashes.setMatrixAt(i, m4);
  });
  scene.add(dashes);

  // --- Buildings: instanced boxes in three height classes. ---
  const plots = [];
  const plotRng = mulberry32(20261121);
  for (const isl of ISLANDS) {
    const hClass = isl.name === 'downtown' ? [22, 70] : isl.name === 'boardwalk' ? [9, 26] : [10, 20];
    for (let gx = isl.x0 + 14; gx < isl.x1 - 10; gx += 26) {
      for (let gz = isl.z0 + 14; gz < isl.z1 - 10; gz += 26) {
        const x = gx + rand(plotRng, -6, 6);
        const z = gz + rand(plotRng, -6, 6);
        if (!isLand(x, z)) continue;
        const near = nearestRoadPoint(x, z);
        if (near.dist < 12) continue;
        if (Math.hypot(x - 60, z + 120) < 30) continue; // ferris wheel clearing
        if (Math.hypot(x - 470, z + 195) < 16) continue; // lighthouse clearing
        if (Math.hypot(x - 250, z) < 75) continue; // drawbridge landing plaza (keeps the leap's sightline open)
        if (Math.hypot(x + 80, z) < 30) continue; // west causeway mouth
        plots.push({
          x, z,
          w: rand(plotRng, 12, 22),
          d: rand(plotRng, 12, 22),
          h: rand(plotRng, hClass[0], hClass[1]),
          rot: plotRng() < 0.5 ? 0 : Math.PI / 2,
        });
      }
    }
  }
  const classes = [
    { max: 18, tex: windowTexture('#f2e8d8', '#ffd9a0') },
    { max: 40, tex: windowTexture('#efe0d0', '#ffce8a') },
    { max: 999, tex: windowTexture('#e8d8e8', '#ffe0b0') },
  ];
  const buckets = [[], [], []];
  for (const p of plots) {
    buckets[p.h <= 18 ? 0 : p.h <= 40 ? 1 : 2].push(p);
    colliders.push({ x0: p.x - p.w / 2 - 0.5, z0: p.z - p.d / 2 - 0.5, x1: p.x + p.w / 2 + 0.5, z1: p.z + p.d / 2 + 0.5 });
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const col = new THREE.Color();
  buckets.forEach((list, bi) => {
    if (!list.length) return;
    const mat = new THREE.MeshLambertMaterial({ map: classes[bi].tex, emissive: 0x664422, emissiveMap: classes[bi].tex, emissiveIntensity: 0.35 });
    const inst = new THREE.InstancedMesh(boxGeo, mat, list.length);
    list.forEach((p, i) => {
      q4.setFromAxisAngle(up, p.rot);
      m4.compose(new THREE.Vector3(p.x, 0, p.z), q4, new THREE.Vector3(p.w, p.h, p.d));
      inst.setMatrixAt(i, m4);
      col.setHex(choice(plotRng, PALETTE.building));
      inst.setColorAt(i, col);
    });
    inst.castShadow = true;
    inst.receiveShadow = true;
    scene.add(inst);
    // Roof caps.
    const roofGeo = new THREE.BoxGeometry(1, 1, 1);
    const roofMat = new THREE.MeshLambertMaterial({ color: PALETTE.roof });
    const roofs = new THREE.InstancedMesh(roofGeo, roofMat, list.length);
    list.forEach((p, i) => {
      q4.setFromAxisAngle(up, p.rot);
      m4.compose(new THREE.Vector3(p.x, p.h, p.z), q4, new THREE.Vector3(p.w + 0.6, 0.8, p.d + 0.6));
      roofs.setMatrixAt(i, m4);
    });
    roofs.castShadow = true;
    scene.add(roofs);
  });

  // --- Palms along the beach and boulevards (instanced trunks + crowns). ---
  const palmSpots = [];
  for (let x = -60; x < 225; x += 13) {
    if (plotRng() < 0.8) palmSpots.push({ x: x + rand(plotRng, -3, 3), z: 122 + rand(plotRng, -3, 3) });
    if (plotRng() < 0.5) palmSpots.push({ x: x + rand(plotRng, -3, 3), z: 148 + rand(plotRng, -2, 2) });
  }
  for (const x of [-350, -280, -210, 60, 140]) {
    for (let z = -130; z < 150; z += 34) {
      if (plotRng() < 0.6) palmSpots.push({ x: x + 8, z });
    }
  }
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.45, 7, 6);
  trunkGeo.translate(0, 3.5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk }), palmSpots.length);
  const crownGeo = new THREE.ConeGeometry(3.4, 3.2, 7);
  crownGeo.translate(0, 8.2, 0);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf }), palmSpots.length);
  palmSpots.forEach((p, i) => {
    q4.setFromAxisAngle(up, rand(plotRng, 0, Math.PI * 2));
    m4.compose(new THREE.Vector3(p.x, 0, p.z), q4, new THREE.Vector3(1, rand(plotRng, 0.85, 1.25), 1));
    trunks.setMatrixAt(i, m4);
    crowns.setMatrixAt(i, m4);
  });
  trunks.castShadow = true;
  scene.add(trunks);
  scene.add(crowns);

  // --- Street lamps along the main roads. ---
  const lampSpots = [];
  for (const e of GRAPH.edges) {
    if (e.len < 40) continue;
    for (let d = 10; d < e.len - 5; d += 32) {
      const t = d / e.len;
      const p = lanePoint(e, t, 1);
      lampSpots.push({ x: p.x - e.dz * 4.4, z: p.z + e.dx * 4.4 });
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6.5, 5);
  poleGeo.translate(0, 3.25, 0);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0x2a2a30 }), lampSpots.length);
  const lampGeo = new THREE.SphereGeometry(0.32, 8, 6);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lampSpots.length);
  lampSpots.forEach((p, i) => {
    m4.makeTranslation(p.x, 0, p.z);
    poles.setMatrixAt(i, m4);
    m4.makeTranslation(p.x, 6.6, p.z);
    lamps.setMatrixAt(i, m4);
  });
  scene.add(poles);
  scene.add(lamps);

  // --- Landmarks. ---
  // Ferris wheel on the beach (rotates slowly; cabins stay upright).
  // Northwest of the boardwalk, so it reads in the westbound cover shot.
  const wheel = new THREE.Group();
  wheel.position.set(60, 0, -120);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0xff8a6a, emissive: 0x442211, emissiveIntensity: 0.4 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(17, 0.55, 8, 40), wheelMat);
  rim.position.y = 20;
  wheel.add(rim);
  const rim2 = rim.clone();
  rim2.position.z = 1.6;
  wheel.add(rim2);
  const rotor = new THREE.Group();
  rotor.position.set(0, 20, 0.8);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.4, 34, 0.4), wheelMat);
    spoke.position.set(Math.cos(a) * 0, 0, 0);
    spoke.rotation.z = a + Math.PI / 2;
    spoke.position.set(Math.cos(a + Math.PI / 2) * 0, 0, 0);
    rotor.add(spoke);
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 2.2, 2.2),
      new THREE.MeshLambertMaterial({ color: choice(plotRng, [0xffe08a, 0x8ad9ff, 0xff9ad9, 0x9affb0]) }),
    );
    cab.position.set(Math.cos(a) * 17, Math.sin(a) * 17, 0);
    cab.castShadow = true;
    rotor.add(cab);
    animated.ferrisCabins.push({ mesh: cab, angle: a });
  }
  wheel.add(rotor);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x4a3a42 });
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 22, 6), legMat);
    leg.position.set(s * 7, 10, 0.8);
    leg.rotation.z = -s * 0.33;
    wheel.add(leg);
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
  hub.position.set(0, 20, 0.8);
  wheel.add(hub);
  scene.add(wheel);
  animated.ferris = rotor;

  // Lighthouse on the port island's north tip, rotating beam.
  const lh = new THREE.Group();
  lh.position.set(470, 0, -195);
  const lhBody = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 4.6, 26, 10),
    new THREE.MeshLambertMaterial({ color: 0xf2e8d8 }),
  );
  lhBody.position.y = 13;
  lhBody.castShadow = true;
  lh.add(lhBody);
  const lhBand = new THREE.Mesh(
    new THREE.CylinderGeometry(3.5, 3.5, 2.4, 10),
    new THREE.MeshLambertMaterial({ color: 0xd94a3a }),
  );
  lhBand.position.y = 18;
  lh.add(lhBand);
  const lhLamp = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  lhLamp.position.y = 27;
  lh.add(lhLamp);
  const beamGeo = new THREE.ConeGeometry(4.5, 60, 12, 1, true);
  beamGeo.rotateX(Math.PI / 2);
  beamGeo.translate(0, 0, 30);
  const beam = new THREE.Mesh(
    beamGeo,
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  beam.position.y = 27;
  lh.add(beam);
  scene.add(lh);
  animated.beam = beam;

  // Hotel tower (downtown landmark) with a lit crown.
  const hotel = new THREE.Mesh(
    new THREE.BoxGeometry(30, 82, 30),
    new THREE.MeshLambertMaterial({ map: classes[2].tex, color: 0xffc27a, emissive: 0x664422, emissiveMap: classes[2].tex, emissiveIntensity: 0.5 }),
  );
  hotel.position.set(-280, 41, -140);
  hotel.castShadow = true;
  scene.add(hotel);
  colliders.push({ x0: -296, z0: -156, x1: -264, z1: -124 });
  const hotelCrown = new THREE.Mesh(
    new THREE.BoxGeometry(20, 4, 20),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0 }),
  );
  hotelCrown.position.set(-280, 84, -140);
  scene.add(hotelCrown);

  // Marina crane (boardwalk north) with a hanging container.
  const crane = new THREE.Group();
  crane.position.set(60, 0, -150);
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xd9a83a });
  const cBase = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 8), craneMat);
  cBase.position.y = 2;
  crane.add(cBase);
  const cMast = new THREE.Mesh(new THREE.BoxGeometry(2.4, 34, 2.4), craneMat);
  cMast.position.y = 20;
  crane.add(cMast);
  const cJib = new THREE.Mesh(new THREE.BoxGeometry(26, 1.8, 1.8), craneMat);
  cJib.position.set(10, 33, 0);
  crane.add(cJib);
  const cLine = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 12, 4), new THREE.MeshBasicMaterial({ color: 0x222222 }));
  cLine.position.set(20, 27, 0);
  crane.add(cLine);
  const cBox = new THREE.Mesh(new THREE.BoxGeometry(5, 2.4, 2.4), new THREE.MeshLambertMaterial({ color: 0x3a7ad9 }));
  cBox.position.set(20, 20, 0);
  cBox.castShadow = true;
  crane.add(cBox);
  scene.add(crane);

  // Radio mast (downtown) with a blinking beacon.
  const mast = new THREE.Group();
  mast.position.set(-420, 0, 140);
  const mastPole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.2, 55, 6), new THREE.MeshLambertMaterial({ color: 0x3a3a42 }));
  mastPole.position.y = 27.5;
  mast.add(mastPole);
  const mastLight = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3a3a }));
  mastLight.position.y = 56;
  mast.add(mastLight);
  scene.add(mast);
  animated.mastLight = mastLight;

  // --- Drawbridge leaves on the east causeway (two steel leaves). ---
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x8a7a6a });
  const leafEGeo = new THREE.BoxGeometry(8, 0.4, 13.4);
  leafEGeo.translate(4, 0, 0); // hinge at x = 232
  const leafE = new THREE.Mesh(leafEGeo, leafMat);
  leafE.position.set(232, 0.12, 0);
  leafE.castShadow = true;
  leafE.receiveShadow = true;
  scene.add(leafE);
  const leafWGeo = new THREE.BoxGeometry(8, 0.4, 13.4);
  leafWGeo.translate(-4, 0, 0); // hinge at x = 252
  const leafW = new THREE.Mesh(leafWGeo, leafMat);
  leafW.position.set(252, 0.12, 0);
  leafW.castShadow = true;
  leafW.receiveShadow = true;
  scene.add(leafW);
  animated.bridgeLeafE = leafE;
  animated.bridgeLeafW = leafW;
  // (No bridge towers: they sit exactly where the cover camera goes and
  // would fill the frame as a dark slab. The raised leaves + gap + water
  // carry the bridge read on their own.)

  // Key locations for spawn, missions and saves.
  const spots = {
    playerStart: { x: -20, z: 20, heading: Math.PI / 2 },
    safehouse: { x: 60, z: 138, heading: 0 },
    garage: { x: 52, z: 128, heading: 0 },
    hospital: { x: -280, z: 128, heading: 0 },
    portPickup: { x: 380, z: -150, heading: 0 },
    marina: { x: 60, z: -128, heading: 0 },
    raceStart: { x: -70, z: 0, heading: Math.PI / 2 },
    bridgeApproach: { x: 200, z: 0, heading: Math.PI / 2 },
  };

  // Drawbridge state machine: down -> raising -> up -> lowering -> down.
  // Up means both leaves raised: two ramps with open water between them.
  const bridge = {
    state: 'down',
    timer: 55,
    angle: 0,
    up: false,
    forceUp: false,
    heightAt(x, z) {
      if (!this.up) return 0;
      if (z < DRAWBRIDGE.z0 || z > DRAWBRIDGE.z1) return 0;
      if (x >= DRAWBRIDGE.x0 && x < DRAWBRIDGE.gap0) {
        return ((x - DRAWBRIDGE.x0) / (DRAWBRIDGE.gap0 - DRAWBRIDGE.x0)) * DRAWBRIDGE.height;
      }
      if (x >= DRAWBRIDGE.gap0 && x < DRAWBRIDGE.gap1) return -999;
      if (x >= DRAWBRIDGE.gap1 && x < DRAWBRIDGE.x1) {
        return ((DRAWBRIDGE.x1 - x) / (DRAWBRIDGE.x1 - DRAWBRIDGE.gap1)) * DRAWBRIDGE.height;
      }
      return 0;
    },
    update(dt) {
      if (this.forceUp) {
        this.state = 'up';
        this.up = true;
        this.angle = 0.55;
        return;
      }
      this.timer -= dt;
      if (this.state === 'down' && this.timer <= 0) {
        this.state = 'raising';
        this.timer = 2;
      } else if (this.state === 'raising' && this.timer <= 0) {
        this.state = 'up';
        this.up = true;
        this.timer = 22;
      } else if (this.state === 'up' && this.timer <= 0) {
        this.state = 'lowering';
        this.up = false;
        this.timer = 2;
      } else if (this.state === 'lowering' && this.timer <= 0) {
        this.state = 'down';
        this.timer = 60;
      }
      const target = this.state === 'up' || this.state === 'raising' ? 0.55 : 0;
      this.angle += (target - this.angle) * Math.min(1, dt * 2.5);
    },
  };

  return {
    colliders,
    spots,
    bridge,
    groundHeightAt: (x, z) => bridge.heightAt(x, z),
    update(dt, t) {
      bridge.update(dt);
      animated.bridgeLeafE.rotation.z = bridge.angle;
      animated.bridgeLeafW.rotation.z = -bridge.angle;
      if (animated.ferris) {
        animated.ferris.rotation.z -= dt * 0.12;
        const a = animated.ferris.rotation.z;
        for (const c of animated.ferrisCabins) {
          c.mesh.rotation.z = -(a + c.angle) + c.angle;
        }
      }
      if (animated.beam) animated.beam.rotation.y += dt * 0.5;
      if (animated.mastLight) animated.mastLight.visible = (t % 1.6) < 0.9;
      if (animated.waterTex) {
        animated.waterTex.offset.x += dt * 0.004;
        animated.waterTex.offset.y += dt * 0.002;
      }
    },
  };
}
