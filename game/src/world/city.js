// VERMILION KEYS — city: authored spine + procedural infill.
// Ground, roads and sidewalks are merged into a few meshes; buildings,
// palms and lamps are InstancedMesh; landmarks are individual meshes.
// The drawbridge on the east causeway is a live world event: when it is UP
// the span is a ramp with a gap cars can leap.
// FIX ROUND 3 — the night market and the garage are real places now:
//   * a row of market stalls along the boardwalk (the JOB 5 fight), with
//     warm stall lights so the night frame reads at small size;
//   * the VERMILION MOTOR WORKS garage: canopy, glowing pad, neon sign;
//   * beach umbrellas so the sand is not an empty beige band.
// FIX ROUND 4 — look (C4 was 0-4): balcony slabs on road-facing
// facades, a light speckle texture on the island ground slabs and the
// roads (no more flat tan ground), and the garage neon sign's text
// auto-fits its canvas (the 44 px line was wider than the canvas, so
// both ends were cut in the texture itself).
// FIX ROUND 5 — brightness + identity: low buildings wear the limestone
// facade and mid buildings the terracotta facade (CanvasTexture, not
// flat window grids), ambient props fill the market/boardwalk/docks,
// the container yard is a real place on the port island (JOB 5's fight
// ground), and the garage is a real interior with a lift, a turntable
// and warm bay lights.

import * as THREE from 'three';
import { PALETTE, canvasTexture, choice, mulberry32, rand, randInt } from '../util.js';
import { CAUSEWAYS, DRAWBRIDGE, GRAPH, ISLANDS, isLand, lanePoint, nearestRoadPoint } from './roadNetwork.js';
import { limestoneFacade, terracottaFacade } from './buildingFactory.js';
import { placeProps } from './propsPlacer.js';
import { buildContainerYard } from './containerYard.js';
import { buildGarageInterior } from './garageInterior.js';

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

// FIX ROUND 4 — light speckle grain: a mostly-white canvas with dark
// and light dots. Used as a map it modulates the slab/road colour just
// enough to break the flat tan, without changing the palette.
function speckleTexture(dots = 120) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < dots; i++) {
      const s = 1 + Math.random() * 2.5;
      ctx.fillStyle = Math.random() < 0.6 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.28)';
      ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
    }
  }, 16, 16);
}

export function buildCity(scene, rng, game) {
  const colliders = [];
  const animated = { ferris: null, ferrisCabins: [], beam: null, mastLight: null, bridgeLeafE: null, bridgeLeafW: null, waterTex: null, garage: null };
  let yardVehicles = [];

  // --- Water: one big teal plane with a scrolling wave texture. ---
  // FIX ROUND: the sea read as a flat dark slab in the police frame.
  // Lighter base + more sun glints so it reads as water at golden hour.
  const waterTex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3a9aa8';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,220,170,0.4)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 40; i++) {
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
  // FIX ROUND: ground slabs lifted a touch — the first sheet's streets
  // and plazas sat in the same dark brown band as the buildings.
  // FIX ROUND 4: a speckle map on each slab so the ground reads as a
  // surface, not flat tan.
  const groundCols = { downtown: 0x9a8a7a, boardwalk: 0xb89a78, port: 0x8d8478 };
  const groundSpeckle = speckleTexture(140);
  for (const isl of ISLANDS) {
    const w = isl.x1 - isl.x0;
    const d = isl.z1 - isl.z0;
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshLambertMaterial({ color: groundCols[isl.name], map: groundSpeckle }),
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
  // FIX ROUND 3 — beach umbrellas: the sand was an empty beige band in
  // every beach frame. Six fixed umbrellas, bright colours, no RNG
  // stream touched (fixed positions, dedicated colours).
  {
    const umbCols = [0xff6a4a, 0x2ea88a, 0xe8c93a, 0xd95a8a, 0x3a7ad9, 0xff9a3a];
    const umbSpots = [[-20, 146], [10, 152], [45, 144], [90, 150], [130, 145], [160, 150]];
    umbSpots.forEach(([x, z], i) => {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 2.4, 5),
        new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }),
      );
      pole.position.set(x, 1.2, z);
      scene.add(pole);
      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(1.9, 0.9, 8),
        new THREE.MeshLambertMaterial({ color: umbCols[i % umbCols.length] }),
      );
      canopy.position.set(x, 2.6, z);
      canopy.castShadow = true;
      scene.add(canopy);
    });
  }
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
  // HARBOUR FIX — quay slabs: the land model includes the two side
  // strips, but the moving bridge leaves cover only the middle. These
  // slabs give the side strips a visible top at y = 0 and a wall
  // reaching below the water. The moving span stays clear.
  const quayGeometry = new THREE.BoxGeometry(20, 1.8, 7);
  const quayMaterial = new THREE.MeshLambertMaterial({ color: 0xb79c7b });

  for (const z of [-10.5, 10.5]) {
    const quay = new THREE.Mesh(quayGeometry, quayMaterial);
    quay.position.set(240, -0.9, z);
    quay.castShadow = true;
    quay.receiveShadow = true;
    scene.add(quay);
  }
  // HARBOUR FIX — moored boat: a small boat floating on the channel
  // water just south of the quay, placed so it reads in the cover
  // frame (the teal water strip at the frame's left edge).
  // COORDINATES (z is SOUTH in this world): the boardwalk island
  // covers x -70..230, z -160..160, so any boat at x < 230 sits on
  // LAND (y=0) and its hull is buried. The only water near the quay
  // is the channel x 230..250, z beyond +-14. First spot (222,22)
  // was land AND occluded by VKPD-71 (a cruiser that converges onto
  // the quay at (229.7,13.5) during the sim); second spot (208,27)
  // was also land. This spot (231,22) is water (isLand false), in
  // the frame at 42-50 deg left, 2-12 m south of the quay wall, and
  // clear of every police unit. Hull sits in the water (water plane
  // y = -1.5); the mast gives it a vertical read at 620 px. Long
  // axis north-south so the broad side faces the west-looking
  // cover camera.
  // ROUND 2 (Codex correction) — moored boat: moved to (232, 0, 19)
  // and given a tapered bow. The centre at (231, 0, 22) was in water
  // but the 3 m hull extended 0.5 m into the bank (x < 230 is land).
  // At (232, 0, 19) the hull spans x 230.5–233.5 (0.5 m clear of the
  // bank) and z 15–23 (1 m clear of the quay slab at z 7–14). The bow
  // is a pointed extruded plan shape (not a rectangular box end) so
  // the hull reads as a boat, and the hull is vivid red so it
  // contrasts with both the tan quay (0xb79c7b) and the teal water.
  // Shape coords: x = across (world X), y = along (world Z after the
  // -90° X rotation); bow point at shape y = -4 maps to world z = +4
  // (south, away from the quay). Extrude depth 1.2 is the hull height.
  const boat = new THREE.Group();
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-1.5, 4);
  hullShape.lineTo(1.5, 4);
  hullShape.lineTo(1.5, -2.5);
  hullShape.lineTo(0, -4);
  hullShape.lineTo(-1.5, -2.5);
  hullShape.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 1.2, bevelEnabled: false });
  hullGeo.rotateX(-Math.PI / 2);
  const boatHull = new THREE.Mesh(
    hullGeo,
    new THREE.MeshLambertMaterial({ color: 0xd21f2b }),
  );
  boatHull.position.y = -1.6;
  boatHull.castShadow = true;
  boat.add(boatHull);
  const boatCabin = new THREE.Mesh(
    new THREE.BoxGeometry(2, 1, 3),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
  );
  boatCabin.position.set(0, 0.1, -0.5);
  boatCabin.castShadow = true;
  boat.add(boatCabin);
  const boatMast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 4.5, 6),
    new THREE.MeshLambertMaterial({ color: 0x4a3428 }),
  );
  boatMast.position.set(0, 2.2, 0.5);
  boat.add(boatMast);
  const boatFlag = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.4, 0.02),
    new THREE.MeshLambertMaterial({ color: 0xffd23f }),
  );
  boatFlag.position.set(0.35, 4.2, 0.5);
  boat.add(boatFlag);
  boat.position.set(232, 0, 19);
  scene.add(boat);
  // FIX ROUND 6 — wet causeway band: the chase stretch (x 230-300)
  // is dark wet asphalt, not the tan promenade slabs, so the road
  // reads as a road and the sun glints on it read as reflections.
  // It sits 2 cm above the road mesh (no z-fight at this range) and
  // just below the lane dashes, which still poke through it.
  const wetBand = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 10),
    // FIX ROUND 6 (finish): Lambert has no specular, so the band read
    // as flat dark grey, not wet. Phong with a warm specular gives the
    // low sun a real glint on the asphalt, and the additive streaks
    // below read as reflections on top of it.
    new THREE.MeshPhongMaterial({ color: 0x484852, specular: 0xff9a50, shininess: 70, map: speckleTexture(100) }),
  );
  wetBand.rotation.x = -Math.PI / 2;
  wetBand.position.set(265, 0.08, 0);
  wetBand.receiveShadow = true;
  scene.add(wetBand);
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
  // FIX ROUND 4: speckle on the asphalt too — the road UVs already tile
  // every 12 m, so the grain lands at road scale.
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt, map: speckleTexture(100) });
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
        if (z > 104 && z < 146 && x > 58 && x < 152) continue; // night-market plaza (FIX ROUND 3)
        if (Math.hypot(x - 52, z - 128) < 24) continue; // garage clearing (FIX ROUND 3)
        if (z > 132 && x > -30 && x < 190) continue; // beach frontage: no buildings on the sand
        if (x > 330 && x < 450 && z > -190 && z < -142) continue; // container yard (FIX ROUND 5)
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
  // FIX ROUND 5 — facades: low buildings wear limestone arches, mid
  // buildings terracotta shutters (CanvasTexture, painted once and
  // shared); only the towers keep the flat window grid.
  const classes = [
    { max: 18, tex: limestoneFacade() },
    { max: 40, tex: terracottaFacade() },
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
  // FIX ROUND: a dedicated RNG for the roof/clutter colours, so the main
  // plot stream — and everything after it — is untouched.
  const fixRng = mulberry32(20261122);
  buckets.forEach((list, bi) => {
    if (!list.length) return;
    // FIX ROUND: the brown emissive wash (0x664422 @ 0.35) tinted every
    // facade muddy. Amber, weaker — the windows stay warm, the walls keep
    // their instance colour.
    const mat = new THREE.MeshLambertMaterial({ map: classes[bi].tex, emissive: 0x7a4a22, emissiveMap: classes[bi].tex, emissiveIntensity: 0.22 });
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
    // Roof caps, one per building, in varied roof colours so the skyline
    // is not one dark mauve band (FIX ROUND).
    const roofCols = [0x5a4a52, 0x7a4a3a, 0x4a5a6a, 0x8a6a4a, 0x6a4a5a];
    const roofGeo = new THREE.BoxGeometry(1, 1, 1);
    const roofMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const roofs = new THREE.InstancedMesh(roofGeo, roofMat, list.length);
    list.forEach((p, i) => {
      q4.setFromAxisAngle(up, p.rot);
      m4.compose(new THREE.Vector3(p.x, p.h, p.z), q4, new THREE.Vector3(p.w + 0.6, 0.8, p.d + 0.6));
      roofs.setMatrixAt(i, m4);
      col.setHex(choice(fixRng, roofCols));
      roofs.setColorAt(i, col);
    });
    roofs.castShadow = true;
    scene.add(roofs);
  });
  // ROUND 2 — hand-placed waterfront buildings flanking the causeway
  // approach, so the cover frame has textured stone/terracotta in the
  // near field. The plot system leaves the drawbridge landing plaza
  // (within 75 m of (250, 0)) empty, and the probe showed every
  // instanced building in the cover frame is 100+ m away — too far
  // for any facade to read at 620 px. These four sit 37–52 m from the
  // cover camera, on the island (x -70..230), and use
  // limestoneFacade()/terracottaFacade() directly with a white
  // material colour — NO PALETTE.building instance tint, which is what
  // washes the instanced facades out into flat coloured blocks.
  // Fixed positions, no rng() calls, colliders included.
  // ROUND 3 (Codex): the two at x=205 sat ON the north-south road at
  // x=200 — their colliders (x 197.5–212.5) covered the centerline
  // (x=200) and the traffic lane (x=202.2), blocking the
  // market-to-port route. They move to x=216 (colliders 208.5–223.5),
  // clear of the road edge at x=205. The two at x=190 stay: their
  // eastern edge is 196.5, west of the centerline.
  {
    const limeMat = new THREE.MeshLambertMaterial({ map: limestoneFacade() });
    const terraMat = new THREE.MeshLambertMaterial({ map: terracottaFacade() });
    const near = [
      { x: 216, z: 24, w: 14, d: 12, h: 16, mat: limeMat },
      { x: 216, z: -24, w: 14, d: 12, h: 22, mat: terraMat },
      { x: 190, z: 28, w: 12, d: 10, h: 14, mat: limeMat },
      { x: 190, z: -28, w: 12, d: 10, h: 26, mat: terraMat },
    ];
    for (const b of near) {
      const m = new THREE.Mesh(boxGeo, b.mat);
      m.position.set(b.x, 0, b.z);
      m.scale.set(b.w, b.h, b.d);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
      colliders.push({ x0: b.x - b.w / 2 - 0.5, z0: b.z - b.d / 2 - 0.5, x1: b.x + b.w / 2 + 0.5, z1: b.z + b.d / 2 + 0.5 });
    }
  }
  // Roof clutter (water tanks, vents, antennae) on a share of tall
  // buildings, so the skyline steps instead of running flat. Uses the same
  // dedicated RNG (see above) so the main plot stream is untouched.
  {
    const clutterRng = fixRng;
    const spots = [];
    for (const list of buckets) {
      for (const p of list) {
        if (p.h < 25 || clutterRng() > 0.45) continue;
        spots.push({
          x: p.x + rand(clutterRng, -p.w / 4, p.w / 4),
          y: p.h + 0.8,
          z: p.z + rand(clutterRng, -p.d / 4, p.d / 4),
          w: rand(clutterRng, 1.6, 3.2),
          h: rand(clutterRng, 1.2, 3.4),
          d: rand(clutterRng, 1.6, 3.2),
          rot: p.rot,
          col: choice(clutterRng, [0x8a7a6a, 0x6a6a72, 0xa88a5a, 0x7a5a4a]),
        });
      }
    }
    if (spots.length) {
      const cGeo = new THREE.BoxGeometry(1, 1, 1);
      cGeo.translate(0, 0.5, 0);
      const cMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
      const clutter = new THREE.InstancedMesh(cGeo, cMat, spots.length);
      spots.forEach((s, i) => {
        q4.setFromAxisAngle(up, s.rot);
        m4.compose(new THREE.Vector3(s.x, s.y, s.z), q4, new THREE.Vector3(s.w, s.h, s.d));
        clutter.setMatrixAt(i, m4);
        col.setHex(s.col);
        clutter.setColorAt(i, col);
      });
      clutter.castShadow = true;
      scene.add(clutter);
    }
  }

  // --- FIX ROUND 2: ground-floor dressing + roof variety. ---
  // The re-test faulted "boxy primitives" and flat facades: every
  // building was one box with one window grid. Three additions, all from
  // a dedicated RNG (seeded separately, after the plots array is built)
  // so the plot stream — and the sim — is untouched:
  //  (1) a ground-floor band on every building: sign band + shopfront
  //      glass + awning stripes painted into one canvas texture;
  //  (2) 3D awning boxes on the road-facing side of most buildings;
  //  (3) pyramid roofs on a third of low/mid buildings so the skyline steps.
  const dressRng = mulberry32(20261123);
  const bandTex = canvasTexture(128, 64, (ctx, w, h) => {
    // Sign band (top quarter): light base with dark dashes as lettering.
    ctx.fillStyle = '#f2e8d8';
    ctx.fillRect(0, 0, w, 16);
    ctx.fillStyle = '#3a2a3a';
    for (let x = 8; x < w - 8; x += 14) ctx.fillRect(x, 5, 8, 6);
    // Shopfront glass (middle half): dark glass with warm lit panes.
    ctx.fillStyle = '#2a3a44';
    ctx.fillRect(0, 16, w, 32);
    for (let x = 8; x < w - 14; x += 26) {
      ctx.fillStyle = dressRng() < 0.6 ? '#ffd9a0' : '#4a6a7a';
      ctx.fillRect(x, 22, 16, 20);
    }
    // Awning stripes (bottom quarter): alternating light/dark bands.
    for (let x = 0; x < w; x += 16) {
      ctx.fillStyle = (x / 16) % 2 === 0 ? '#e8e8e8' : '#c95a4a';
      ctx.fillRect(x, 48, 16, 16);
    }
  });
  {
    const bandGeo = new THREE.BoxGeometry(1, 1, 1);
    bandGeo.translate(0, 0.5, 0);
    const bandMat = new THREE.MeshLambertMaterial({ map: bandTex, emissive: 0x332211, emissiveMap: bandTex, emissiveIntensity: 0.35 });
    const bandCols = [0xffe0b0, 0xffc0c0, 0xc0e0ff, 0xd0ffc0, 0xffe8a0];
    const bands = new THREE.InstancedMesh(bandGeo, bandMat, plots.length);
    plots.forEach((p, i) => {
      q4.setFromAxisAngle(up, p.rot);
      m4.compose(new THREE.Vector3(p.x, 0, p.z), q4, new THREE.Vector3(p.w + 0.5, 3.6, p.d + 0.5));
      bands.setMatrixAt(i, m4);
      col.setHex(choice(dressRng, bandCols));
      bands.setColorAt(i, col);
    });
    bands.receiveShadow = true;
    scene.add(bands);
  }
  // Awnings on the road-facing side of most buildings (no rotation: the
  // width is the smaller footprint side, so it fits either face).
  {
    const awnCols = [0xff6a4a, 0x2ea88a, 0xe8c93a, 0xd95a8a, 0x3a7ad9, 0x7ad9b0];
    const awnSpots = [];
    for (const p of plots) {
      if (dressRng() > 0.6) continue;
      const near = nearestRoadPoint(p.x, p.z);
      const dx = near.x - p.x;
      const dz = near.z - p.z;
      const fw = Math.min(p.w, p.d) * 0.6;
      if (Math.abs(dx) > Math.abs(dz)) {
        const s = Math.sign(dx) || 1;
        awnSpots.push({ x: p.x + s * (p.w / 2 + 0.8), y: 3.4, z: p.z, w: 1.8, d: fw });
      } else {
        const s = Math.sign(dz) || 1;
        awnSpots.push({ x: p.x, y: 3.4, z: p.z + s * (p.d / 2 + 0.8), w: fw, d: 1.8 });
      }
    }
    if (awnSpots.length) {
      const aGeo = new THREE.BoxGeometry(1, 0.25, 1);
      const aMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
      const awns = new THREE.InstancedMesh(aGeo, aMat, awnSpots.length);
      awnSpots.forEach((s, i) => {
        m4.makeTranslation(s.x, s.y, s.z);
        m4.scale(new THREE.Vector3(s.w, 1, s.d));
        awns.setMatrixAt(i, m4);
        col.setHex(choice(dressRng, awnCols));
        awns.setColorAt(i, col);
      });
      awns.castShadow = true;
      scene.add(awns);
    }
  }
  // Pyramid roofs on a third of low/mid buildings.
  {
    const pyrCols = [0x5a4a52, 0x7a4a3a, 0x4a5a6a, 0x8a6a4a, 0x6a4a5a, 0xa84a3a];
    const pyrSpots = [];
    for (const p of plots) {
      if (p.h >= 40 || dressRng() > 0.35) continue;
      pyrSpots.push(p);
    }
    if (pyrSpots.length) {
      const pGeo = new THREE.ConeGeometry(1, 1, 4);
      pGeo.rotateY(Math.PI / 4);
      const pMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
      const pyrs = new THREE.InstancedMesh(pGeo, pMat, pyrSpots.length);
      pyrSpots.forEach((p, i) => {
        q4.setFromAxisAngle(up, p.rot);
        m4.compose(new THREE.Vector3(p.x, p.h + 0.8 + 1.1, p.z), q4, new THREE.Vector3(p.w * 0.72, 2.2, p.d * 0.72));
        pyrs.setMatrixAt(i, m4);
        col.setHex(choice(dressRng, pyrCols));
        pyrs.setColorAt(i, col);
      });
      pyrs.castShadow = true;
      scene.add(pyrs);
    }
  }
  // FIX ROUND 4 — balconies: a slab + railing on the road-facing side
  // of about half the buildings, one or two storeys up. Same dedicated
  // dressRng, drawn AFTER the awnings and pyramids, so nothing before
  // this block changes.
  {
    const balSpots = [];
    for (const p of plots) {
      if (p.h < 8 || dressRng() > 0.5) continue;
      const near = nearestRoadPoint(p.x, p.z);
      const dx = near.x - p.x;
      const dz = near.z - p.z;
      const bw = Math.min(p.w, p.d) * 0.55;
      const floors = p.h >= 20 && dressRng() < 0.4 ? 2 : 1;
      for (let f = 0; f < floors; f++) {
        const y = 5.5 + f * 4.5 + rand(dressRng, 0, 1.5);
        if (y > p.h - 2) continue;
        if (Math.abs(dx) > Math.abs(dz)) {
          const s = Math.sign(dx) || 1;
          balSpots.push({ x: p.x + s * (p.w / 2 + 0.7), y, z: p.z, w: 1.5, d: bw, ox: s, oz: 0 });
        } else {
          const s = Math.sign(dz) || 1;
          balSpots.push({ x: p.x, y, z: p.z + s * (p.d / 2 + 0.7), w: bw, d: 1.5, ox: 0, oz: s });
        }
      }
    }
    if (balSpots.length) {
      const slabGeo = new THREE.BoxGeometry(1, 0.22, 1);
      const slabMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
      const slabs = new THREE.InstancedMesh(slabGeo, slabMat, balSpots.length);
      const railGeo = new THREE.BoxGeometry(1, 0.85, 0.08);
      const railMat = new THREE.MeshLambertMaterial({ color: 0x2a2a34 });
      const rails = new THREE.InstancedMesh(railGeo, railMat, balSpots.length);
      const balCols = [0xd8d0c8, 0xc8b8a8, 0xb8c8d0, 0xe0d8c8];
      balSpots.forEach((s, i) => {
        m4.makeTranslation(s.x, s.y, s.z);
        m4.scale(new THREE.Vector3(s.w, 1, s.d));
        slabs.setMatrixAt(i, m4);
        col.setHex(choice(dressRng, balCols));
        slabs.setColorAt(i, col);
        // Railing on the slab's outer edge, running along its long side.
        m4.makeTranslation(s.x + s.ox * 0.75, s.y + 0.5, s.z + s.oz * 0.75);
        m4.scale(new THREE.Vector3(s.ox !== 0 ? 0.08 : s.w, 1, s.oz !== 0 ? 0.08 : s.d));
        rails.setMatrixAt(i, m4);
      });
      slabs.castShadow = true;
      scene.add(slabs);
      scene.add(rails);
    }
  }

  // --- FIX ROUND 3: the night market (JOB 5) + the garage. ---
  // Fixed positions, dedicated RNG (20261124) — no existing stream is
  // touched, so the city, traffic and missions reproduce exactly.
  // The market runs along the boardwalk at z = 125, x 70..140: eight
  // stalls (counter + posts + striped awning + goods), two warm lights,
  // and colliders so nobody walks through a stall.
  const marketRng = mulberry32(20261124);
  {
    const awnCols = [0xff6a4a, 0x2ea88a, 0xe8c93a, 0xd95a8a, 0x3a7ad9, 0xff9a3a, 0x7ad9b0, 0xe8e8e8];
    const goodsCols = [0xff6a4a, 0xe8c93a, 0x2ea88a, 0xd95a8a, 0x8ad9ff, 0xff9a3a];
    for (let i = 0; i < 8; i++) {
      const x = 70 + i * 10;
      const z = 125;
      const awnCol = awnCols[i % awnCols.length];
      // Counter.
      const counter = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 1.1, 1.5),
        new THREE.MeshLambertMaterial({ color: 0x6a4a3a }),
      );
      counter.position.set(x, 0.55, z);
      counter.castShadow = true;
      counter.receiveShadow = true;
      scene.add(counter);
      // Goods on the counter: small bright boxes.
      for (let j = 0; j < 4; j++) {
        const good = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, 0.35 + marketRng() * 0.25, 0.45),
          new THREE.MeshLambertMaterial({ color: choice(marketRng, goodsCols) }),
        );
        good.position.set(x - 0.9 + j * 0.6, 1.25, z + (marketRng() - 0.5) * 0.5);
        scene.add(good);
      }
      // Four posts + striped awning.
      const postMat = new THREE.MeshLambertMaterial({ color: 0x3a2a2a });
      for (const [ox, oz] of [[-1.3, -0.7], [1.3, -0.7], [-1.3, 0.7], [1.3, 0.7]]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 5), postMat);
        post.position.set(x + ox, 1.3, z + oz);
        scene.add(post);
      }
      const awnTex = canvasTexture(64, 16, (ctx, w, h) => {
        for (let sx = 0; sx < w; sx += 16) {
          ctx.fillStyle = (sx / 16) % 2 === 0 ? '#f2e8d8' : '#' + awnCol.toString(16).padStart(6, '0');
          ctx.fillRect(sx, 0, 16, h);
        }
      });
      const awn = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.1, 2.0),
        new THREE.MeshLambertMaterial({ map: awnTex }),
      );
      awn.position.set(x, 2.7, z);
      awn.rotation.x = 0.12;
      awn.castShadow = true;
      scene.add(awn);
      // Warm bulb under the awning: a small glowing sphere.
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffd9a0 }),
      );
      bulb.position.set(x, 2.45, z);
      scene.add(bulb);
      colliders.push({ x0: x - 1.5, z0: z - 0.9, x1: x + 1.5, z1: z + 0.9 });
    }
    // Two warm lights over the market aisle (no shadows — cheap).
    for (const lx of [85, 125]) {
      const pl = new THREE.PointLight(0xffb36a, 30, 26, 1.4);
      pl.position.set(lx, 5, 122);
      scene.add(pl);
    }
  }
  // VERMILION MOTOR WORKS — the garage at (52, 128), by the safehouse:
  // canopy on four posts, a back wall, a glowing pad the car sits on,
  // and a neon sign. The pad and sign are the garage's read at dusk.
  {
    const postMat = new THREE.MeshLambertMaterial({ color: 0x2a2a34 });
    for (const [ox, oz] of [[-5.5, -4], [5.5, -4], [-5.5, 4], [5.5, 4]]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.6, 0.35), postMat);
      post.position.set(52 + ox, 2.3, 128 + oz);
      post.castShadow = true;
      scene.add(post);
    }
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(12.5, 0.3, 9.5),
      new THREE.MeshLambertMaterial({ color: 0x3a3a44 }),
    );
    roof.position.set(52, 4.75, 128);
    roof.castShadow = true;
    scene.add(roof);
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(12.5, 4.6, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x4a3a4a }),
    );
    back.position.set(52, 2.3, 123.4);
    back.castShadow = true;
    scene.add(back);
    colliders.push({ x0: 45.5, z0: 123.2, x1: 58.5, z1: 123.7 });
    // Glowing pad under the car.
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(6.5, 4.5),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.3 }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(52, 0.08, 128);
    scene.add(pad);
    // Neon sign on the back wall. FIX ROUND 4b: the fix-4 move (x 52 ->
    // 49.5, 9 -> 8 m) fixed the wrong cause — the text was clipped IN
    // THE TEXTURE: "VERMILION MOTOR WORKS" at bold 44 px is ~580 px
    // wide on a 512 px canvas, so both ends were cut before the plane
    // ever rendered. The font now shrinks until the line fits the
    // canvas (measureText loop), and the plane narrows to 6 m so the
    // full sign fits between the canopy post (which occludes the wall
    // left of x~46) and the DOM garage panel's left edge (frame 820):
    // a 6 m plane still lost "KS" behind the panel, so 5.5 m.
    const signTex = canvasTexture(512, 96, (ctx, w, h) => {
      ctx.fillStyle = '#140a18';
      ctx.fillRect(0, 0, w, h);
      let fs = 44;
      ctx.font = `bold ${fs}px Arial`;
      // Inset the line from the canvas edges as well: the plane's right
      // end sits close to the DOM panel, so the text must end well
      // inside the plane, not flush with it.
      while (ctx.measureText('VERMILION MOTOR WORKS').width > w - 90 && fs > 10) {
        fs -= 2;
        ctx.font = `bold ${fs}px Arial`;
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ff4ad9';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ff9ad9';
      ctx.fillText('VERMILION MOTOR WORKS', w / 2, h / 2 - 12);
      ctx.font = 'bold 22px Arial';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#9fd8ff';
      ctx.fillText('TUNE · ARMOUR · RESPRAY', w / 2, h / 2 + 26);
    });
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(5.5, 1.7),
      new THREE.MeshBasicMaterial({ map: signTex }),
    );
    sign.position.set(49.5, 3.6, 123.6);
    scene.add(sign);
  }

  // --- FIX ROUND 5: ambient props, the container yard, the garage interior. ---
  // Props (fruit stands, crates, neon signs, bins) from a dedicated RNG;
  // the container yard on the port island (JOB 5's fight ground, the
  // EXPORT gate, six parked yard cars); the garage interior (walls,
  // ceiling, lift, turntable, warm bay lights) over the canopy.
  {
    const props = placeProps(scene);
    colliders.push(...props.colliders);
    const yard = buildContainerYard(scene, game);
    colliders.push(...yard.colliders);
    yardVehicles = yard.yardVehicles;
    const garage = buildGarageInterior(scene);
    colliders.push(...garage.colliders);
    animated.garage = garage;
  }

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
  // FIX ROUND 6 — causeway palms, REMOVED: a palm crown in this
  // engine is a solid 3.4 m cone, and one 15-30 m from the cover
  // camera filled the frame as a giant green pyramid, not a palm.
  // The boulevard palms already in the world carry the palm read
  // from a distance; the causeway stays clear.
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

  // FIX ROUND 6 — cargo ship + dock crane on the north side of the
  // east causeway mouth, so the cover's right side carries the port
  // (cranes, containers, a ship in the channel) the way the target
  // does. Permanent world landmarks, not staging: the ship sits in
  // the channel water just north of the causeway (the water plane is
  // at y -1.5, so the hull sits low with its deck just above it),
  // moored east-west along the channel so the cover camera sees its
  // long side, and the crane stands on the Caldera Docks bank above
  // it with its jib over the water.
  {
    const ship = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(34, 3.2, 9),
      new THREE.MeshLambertMaterial({ color: 0x2a3542 }),
    );
    hull.position.y = 0;
    hull.castShadow = true;
    ship.add(hull);
    const bow = new THREE.Mesh(
      new THREE.BoxGeometry(3, 3.2, 9),
      new THREE.MeshLambertMaterial({ color: 0xd93a2a }),
    );
    bow.position.set(17.5, 0, 0);
    ship.add(bow);
    const contCols = [0xd93a2a, 0x2ea88a, 0xe8c93a, 0x3a7ad9, 0xff7a55];
    for (let i = 0; i < 8; i++) {
      const c = new THREE.Mesh(
        new THREE.BoxGeometry(6, 2.4, 7.6),
        new THREE.MeshLambertMaterial({ color: contCols[i % contCols.length] }),
      );
      c.position.set(-12 + i * 6.4, 2.6, 0);
      c.castShadow = true;
      ship.add(c);
    }
    // FIX ROUND 6 (finish): the first placement put the ship 14.5 m
    // off the causeway with a 7 m blank cream tower dead on the cover
    // camera's sightline — it read as a giant pale box, not a ship.
    // The ship now sits 10 m further out in the channel and the tower
    // is lower and slate, so it reads as a superstructure on the
    // right of the frame, with the containers carrying the colour.
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(4, 5, 8),
      new THREE.MeshLambertMaterial({ color: 0x8a97a8 }),
    );
    tower.position.set(-15.5, 4.0, 0);
    tower.castShadow = true;
    ship.add(tower);
    const funnel = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 3, 4),
      new THREE.MeshLambertMaterial({ color: 0xff7a55 }),
    );
    funnel.position.set(-12.5, 7.2, 0);
    ship.add(funnel);
    // FIX ROUND 6 (finish 2): the ship was moored north-south, so
    // the camera saw its 9 m end and the tower's 8 m side — a big
    // blank slab, grey instead of cream. Moored east-west along the
    // channel, the camera sees the 34 m side: a long cargo-ship
    // profile with the colourful containers on deck, the tower at
    // the west end. (The tower's local offset now maps to world x,
    // not z.)
    ship.position.set(232, 0, -40);
    scene.add(ship);
    const dockCrane = new THREE.Group();
    const dcMat = new THREE.MeshLambertMaterial({ color: 0xd9a83a });
    const dcBase = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 6), dcMat);
    dcBase.position.y = 1.5;
    dcBase.castShadow = true;
    dockCrane.add(dcBase);
    const dcMast = new THREE.Mesh(new THREE.BoxGeometry(2, 26, 2), dcMat);
    dcMast.position.y = 16;
    dcMast.castShadow = true;
    dockCrane.add(dcMast);
    const dcJib = new THREE.Mesh(new THREE.BoxGeometry(24, 1.6, 1.6), dcMat);
    dcJib.position.set(-8, 28, 0);
    dcJib.castShadow = true;
    dockCrane.add(dcJib);
    const dcHook = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 2.2, 2.2),
      new THREE.MeshLambertMaterial({ color: 0x2ea88a }),
    );
    dcHook.position.set(-18, 24, 0);
    dockCrane.add(dcHook);
    // FIX ROUND 6 (finish 2): the mast stood dead on the cover
    // camera's sightline with its jib pointing away from the lens,
    // so it read as a random yellow pillar, not a crane. It now
    // stands further west with the jib swung north over the water,
    // so the silhouette reads as a dock crane.
    dockCrane.position.set(198, 0, -38);
    dockCrane.rotation.y = -Math.PI / 2;
    scene.add(dockCrane);
  }
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
  // FIX ROUND 2: lighter steel (0x8a7a6a -> 0xa89a8a) — the leaves read as
  // a dark slab in the cover's lower right.
  const leafMat = new THREE.MeshLambertMaterial({ color: 0xa89a8a });
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
    yardVehicles,
    // Exposed so screenshot staging can hide the lamps right at the leap
    // (SECOND FIX ROUND: a causeway lamp head filled the cover frame).
    // The live game keeps them; only the cover staging hides them.
    lamps,
    lampPoles: poles,
    // FIX ROUND 6 (finish): the palms too, for the same reason — the
    // crown is a solid cone, and one on the cover sightline reads as a
    // giant green pyramid. Staging hides the ones in the sightline
    // band; the live game keeps its palms.
    palms: { trunks, crowns, spots: palmSpots },
    groundHeightAt: (x, z) => bridge.heightAt(x, z),
    update(dt, t) {
      bridge.update(dt);
      animated.bridgeLeafE.rotation.z = bridge.angle;
      animated.bridgeLeafW.rotation.z = -bridge.angle;
      if (animated.garage) animated.garage.update(dt);
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
