// VERMILION KEYS — vehicle bodies (Fix Round 7, C4/C3).
// Smooth, not boxy: an extruded side profile (sloped hood and deck,
// rounded nose/tail), a rounded extruded cabin, wheel-arch trim rings,
// tinted glass, emissive head/taillights and a soft ground glow.
// DROP-IN replacement for makeCarMesh in entities/vehicle.js: same
// signature, same userData shape { wheels, lightBar, cls, def, bodyMat },
// same overall dims (def.len/wid/h) and same wheel positions, so
// Car.syncMesh / Car.update work unchanged.
// NOTE (latent fix): vehicleMaterials.makeCarLights stores the tail
// meshes on group.userData — this builder assigns userData BEFORE
// calling it, so the tails survive (the old makeCarMesh assigned
// userData after the call and silently dropped them, so setBraking
// was a no-op on the old meshes).

import * as THREE from 'three';
import { VEHICLE_CLASSES } from '../entities/vehicle.js';
import { tintedGlassMaterial, lighterShade, makeCarLights, addRoofPanel } from './vehicleMaterials.js';
import { PALETTE } from '../util.js';

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}

// Side profile of the lower body, drawn in the XY plane (x = length,
// y = height, nose at +x). Sloped hood, rounded nose/tail, flat sill.
function bodyProfile(L, H) {
  const s = new THREE.Shape();
  const top = H * 0.58;
  const nose = H * 0.30;
  s.moveTo(-L / 2 + 0.15, 0.10);
  s.lineTo(L / 2 - 0.35, 0.10);
  s.quadraticCurveTo(L / 2 + 0.05, 0.12, L / 2 + 0.02, nose); // rounded nose
  s.lineTo(L * 0.42, H * 0.44); // sloped hood
  s.lineTo(L * 0.05, top * 0.98); // cowl
  s.lineTo(-L * 0.30, top); // deck
  s.lineTo(-L / 2 + 0.10, H * 0.46); // sloped tail
  s.quadraticCurveTo(-L / 2 - 0.05, 0.30, -L / 2 + 0.15, 0.10);
  s.closePath();
  return s;
}

// Cabin profile: sloped windshield, flat roof, sloped rear glass.
function cabinProfile(L, H, cabinL, cabinH) {
  const s = new THREE.Shape();
  const x0 = -cabinL / 2;
  const x1 = cabinL / 2;
  s.moveTo(x0, 0);
  s.lineTo(x1 - cabinL * 0.22, 0); // base
  s.lineTo(x1, cabinH * 0.55); // sloped windshield
  s.lineTo(x1 - cabinL * 0.18, cabinH); // roof front
  s.lineTo(x0 + cabinL * 0.22, cabinH); // roof
  s.lineTo(x0, cabinH * 0.5); // sloped rear glass
  s.closePath();
  return s;
}

function extrude(shape, depth, material) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.06,
    bevelSegments: 2,
    steps: 1,
  });
  geo.translate(0, 0, -depth / 2);
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  return m;
}

export function buildSmoothBody(cls, color, police = false) {
  const def = VEHICLE_CLASSES[cls];
  const g = new THREE.Group();
  const L = def.len;
  const W = def.wid;
  const H = def.h;
  const bodyMat = new THREE.MeshLambertMaterial({ color: police ? PALETTE.policeWhite : color });

  if (cls === 'bike') {
    // Scooter / Key Hopper: a slim extruded spine, a seat, a rider
    // torso + helmet, two wheels on the centreline. Same wheel
    // positions as makeCarMesh (x +/-L*0.32, z 0, y 0.36).
    const spine = extrude(bodyProfile(L, H * 0.8), W * 0.55, bodyMat);
    spine.position.y = 0.18;
    g.add(spine);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.5), lambert(0x1a1a20));
    seat.position.set(-L * 0.18, H * 0.62, 0);
    g.add(seat);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.4), lambert(0x2a2a34));
    torso.position.set(-L * 0.05, H * 0.95, 0);
    torso.castShadow = true;
    g.add(torso);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), lambert(0xe8e8e8));
    helmet.position.set(-L * 0.02, H * 1.35, 0);
    g.add(helmet);
  } else {
    // Lower body: extruded profile, bevelled edges catch the light.
    const body = extrude(bodyProfile(L, H), W * 0.92, bodyMat);
    body.position.y = 0.12;
    g.add(body);

    // Cabin: extruded rounded profile, two-tone (lighter shade of the
    // body colour; police keeps the black cabin). Glass band inset on
    // the cabin flanks, slightly wider than the cabin so it reads.
    const cabinH = cls === 'van' ? H * 0.55 : H * 0.5;
    const cabinL = cls === 'van' ? L * 0.62 : L * 0.48;
    const cabinX = cls === 'van' ? -L * 0.08 : -L * 0.04;
    const cabinColor = police ? PALETTE.policeBlack : lighterShade(color, 0.22);
    const cabin = extrude(cabinProfile(L, H, cabinL, cabinH), W * 0.82, lambert(cabinColor));
    cabin.position.set(cabinX, H * 0.6, 0);
    g.add(cabin);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(cabinL * 0.72, cabinH * 0.5, W * 0.88),
      tintedGlassMaterial(),
    );
    glass.position.set(cabinX, H * 0.6 + cabinH / 2, 0);
    glass.castShadow = true;
    g.add(glass);
    // Pale roof panel on the painted classes (same rule as makeCarMesh).
    if (!police && (cls === 'sports' || cls === 'muscle' || cls === 'sedan')) {
      addRoofPanel(g, L, W, H, color);
    }
    if (cls === 'muscle' || cls === 'sports') {
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(L * 0.16, 0.09, W * 0.9), lambert(0x1a1a20));
      spoiler.position.set(-L * 0.46, H * 0.62, 0);
      spoiler.castShadow = true;
      g.add(spoiler);
    }
    // Two-tone stripe down the hood and roof (same rule as makeCarMesh).
    if (!police && (cls === 'sports' || cls === 'muscle' || cls === 'sedan')) {
      const stripeCol = new THREE.Color(color).offsetHSL(0, -0.05, 0.22).getHex();
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(L * 0.62, 0.05, W * 0.34), lambert(stripeCol));
      stripe.position.set(L * 0.08, H * 0.6, 0);
      g.add(stripe);
    }
    // Side skirts, grille, rear bumper (same positions as makeCarMesh).
    for (const s of [-1, 1]) {
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(L * 0.92, 0.16, 0.06), lambert(0x1a1a20));
      skirt.position.set(0, H * 0.16, s * (W / 2 + 0.01));
      g.add(skirt);
    }
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, W * 0.78), lambert(0xc8c8d0));
    grille.position.set(L / 2 - 0.02, H * 0.3, 0);
    g.add(grille);
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, W * 0.78), lambert(0x2a2a30));
    bumper.position.set(-L / 2 + 0.02, H * 0.3, 0);
    g.add(bumper);
  }

  // Wheel arches: a dark torus trim ring over each wheel (upper half)
  // plus a dark wheel-well disc behind it, so the wheel reads as set
  // into the body instead of bolted onto a slab. Same wheel geometry
  // and positions as makeCarMesh, so syncMesh's spin still works.
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  wheelGeo.rotateX(Math.PI / 2);
  const wheelMat = lambert(0x14141a);
  const archGeo = new THREE.TorusGeometry(0.44, 0.09, 6, 12, Math.PI);
  const archMat = lambert(0x1a1a20);
  const wellGeo = new THREE.CircleGeometry(0.46, 12);
  const wellMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0e });
  const wx = cls === 'bike' ? [L * 0.32, -L * 0.32] : [L * 0.32, L * 0.32, -L * 0.32, -L * 0.32];
  const wz = cls === 'bike' ? [0, 0] : [W / 2, -W / 2, W / 2, -W / 2];
  for (let i = 0; i < wx.length; i++) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx[i], 0.36, wz[i]);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
    // Arch ring on the outer face of each wheel (bikes: both sides).
    const sides = cls === 'bike' ? [-1, 1] : [wz[i] > 0 ? 1 : -1];
    for (const s of sides) {
      const arch = new THREE.Mesh(archGeo, archMat);
      arch.position.set(wx[i], 0.36, wz[i] + s * 0.16);
      g.add(arch);
      const well = new THREE.Mesh(wellGeo, wellMat);
      well.position.set(wx[i], 0.36, wz[i] + s * 0.13);
      g.add(well);
    }
  }

  // Headlights / taillights: the shared set (emissive headlights,
  // brake-light tails stored on userData). userData is assigned FIRST
  // (see note at the top) so makeCarLights' tails survive.
  let lightBar = null;
  if (police) {
    lightBar = new THREE.Group();
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    r.position.x = -0.28;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    b.position.x = 0.28;
    lightBar.add(r);
    lightBar.add(b);
    const cabinH = H * 0.5;
    lightBar.position.set(-L * 0.04, H * 0.6 + cabinH + 0.1, 0);
    lightBar.userData = { r, b };
    g.add(lightBar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(L * 0.5, 0.06, W * 0.98), lambert(PALETTE.policeBlack));
    stripe.position.set(L * 0.2, H * 0.62, 0);
    g.add(stripe);
  }
  g.userData = { wheels, lightBar, cls, def, bodyMat };
  makeCarLights(g, L, W, H);

  // Soft additive ground glow: a warm ellipse under the car that
  // grounds it on the road (the hero blob in boot.js does the same
  // for the player's car; this one travels with every car).
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 20),
    new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.05;
  glow.scale.set(L * 0.62, W * 0.72, 1);
  glow.renderOrder = 3;
  g.add(glow);

  return g;
}
