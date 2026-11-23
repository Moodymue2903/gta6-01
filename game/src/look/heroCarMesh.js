// VERMILION KEYS — hero car factory (Fix Round 8, Builder A).
// ChatGPT cross-section loft (BufferGeometry, 7 rings) for the main
// body shell, scaled to the REAL vehicle dimensions from
// entities/vehicle.js — NOT Gemini's 4.6 m or ChatGPT's 4.75 m.
// Sports (Comet GT): L 4.3, W 2.0, H 1.15; wheels at x = +/-L*0.32.
// Local convention (verified from entities/vehicle.js): +X is the nose
// (forward), +Z is the car's right side, +Y is up. syncMesh yaws the
// group Ry(heading - PI/2) and spins each wheel about local Z, so the
// wheels here are Groups whose local Z is the axle.
// DROP-IN replacement for buildSmoothBody: same signature, same
// userData shape { wheels, lightBar, cls, def, bodyMat, tails,
// tailDim, tailBright, braking }, same dims and wheel positions, so
// Car.syncMesh / Car.repaint / setBraking / police light-bar flashing
// all work unchanged. The garage reuses this same builder.

import * as THREE from 'three';
import { VEHICLE_CLASSES } from '../entities/vehicle.js';
import { PALETTE } from '../util.js';

export const HERO_PAINT = 0xe85a24;

// Shared (never repainted) materials.
const RUBBER = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.88, metalness: 0.0 });
const CHROME = new THREE.MeshStandardMaterial({ color: 0xd8dce2, metalness: 0.95, roughness: 0.25, envMapIntensity: 1.2 });
const DARK_TRIM = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.6, metalness: 0.3 });
const DARK_WELL = new THREE.MeshBasicMaterial({ color: 0x0a0a0e });
const STEEL = new THREE.MeshStandardMaterial({ color: 0x555560, metalness: 0.8, roughness: 0.4 });
const DARK_BARREL = new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.6, roughness: 0.5 });
const SPOKE_MAT = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.9, roughness: 0.35, envMapIntensity: 1.0 });
const CALIPER_MAT = new THREE.MeshStandardMaterial({ color: 0xc02020, roughness: 0.4, metalness: 0.4 });
const INTERIOR_MAT = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.9, metalness: 0.0 });
const GLASS_MAT = new THREE.MeshPhysicalMaterial({
  color: 0x1e3a52, metalness: 0.3, roughness: 0.08, transparent: true,
  opacity: 0.82, side: THREE.DoubleSide, envMapIntensity: 1.8,
});
const HALO_MAT = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });
const LENS_MAT = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
const STRIPE_MAT = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.1 });

function paintMat(color) {
  return new THREE.MeshPhysicalMaterial({
    color, metalness: 0.5, roughness: 0.23, clearcoat: 1.0,
    clearcoatRoughness: 0.08, envMapIntensity: 1.4, side: THREE.DoubleSide,
  });
}

function mesh(geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  return m;
}

// One cross-section ring of the loft, in the (y, z) plane: a flat sill,
// sides that taper inward near the sill, a shoulder, and a curved top.
// Returns 15 [y, z] points, ordered around the loop.
function ringPoints(halfW, topY, bottomY) {
  const raw = [
    bottomY,
    bottomY + 0.06,
    bottomY + 0.18,
    topY * 0.7,
    topY - 0.1,
    topY - 0.04,
    topY,
  ];
  const ys = [];
  for (let i = 0; i < raw.length; i++) {
    const floor = i === 0 ? raw[0] : ys[i - 1] + 0.015;
    const cap = topY - (6 - i) * 0.015;
    ys.push(Math.min(Math.max(raw[i], floor), cap));
  }
  const w = halfW;
  const z = [0.7 * w, 0.92 * w, 1.0 * w, 0.99 * w, 0.94 * w, 0.8 * w, 0.55 * w];
  return [
    [ys[0], -z[0]], [ys[0], z[0]],
    [ys[1], z[1]], [ys[2], z[2]], [ys[3], z[3]], [ys[4], z[4]], [ys[5], z[5]],
    [ys[6], z[6]], [ys[6], 0], [ys[6], -z[6]],
    [ys[5], -z[5]], [ys[4], -z[4]], [ys[3], -z[3]], [ys[2], -z[2]], [ys[1], -z[1]],
  ];
}

// Loft a closed shell through rings [{ x, w, top, bottom }].
// Rings are ordered nose -> tail (+X -> -X).
function loftGeometry(rings) {
  const per = ringPoints(1, 1, 0).length;
  const pos = [];
  const idx = [];
  for (const r of rings) {
    for (const [y, z] of ringPoints(r.w, r.top, r.bottom)) pos.push(r.x, y, z);
  }
  for (let ri = 0; ri < rings.length - 1; ri++) {
    for (let p = 0; p < per; p++) {
      const a = ri * per + p;
      const b = ri * per + (p + 1) % per;
      const c = (ri + 1) * per + p;
      const d = (ri + 1) * per + (p + 1) % per;
      idx.push(a, c, b, b, c, d);
    }
  }
  // End caps: fan around each end ring's centroid.
  for (const ri of [0, rings.length - 1]) {
    const base = ri * per;
    let cy = 0;
    let cz = 0;
    for (let p = 0; p < per; p++) { cy += pos[(base + p) * 3 + 1]; cz += pos[(base + p) * 3 + 2]; }
    cy /= per;
    cz /= per;
    const ci = pos.length / 3;
    pos.push(rings[ri].x, cy, cz);
    for (let p = 0; p < per; p++) {
      const a = base + p;
      const b = base + (p + 1) % per;
      if (ri === 0) idx.push(ci, b, a);
      else idx.push(ci, a, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Body rings, in fractions: x of L/2, half-width of W/2, top of H.
// Guide rings scaled from 4.7 m to the real length (4.3 m sports).
const BODY_RINGS = [
  { xf: 1.0, wf: 0.78, tf: 0.3 },
  { xf: 0.86, wf: 0.94, tf: 0.45 },
  { xf: 0.44, wf: 0.99, tf: 0.5 },
  { xf: 0.0, wf: 0.98, tf: 0.57 },
  { xf: -0.44, wf: 0.99, tf: 0.56 },
  { xf: -0.8, wf: 0.97, tf: 0.52 },
  { xf: -1.0, wf: 0.82, tf: 0.39 },
];

// Top height of the body loft at car-local x (linear interpolation
// across the ring table) — stripes sit flush on this surface.
function bodyTopAt(x, L, H) {
  const xf = x / (L / 2);
  const rings = BODY_RINGS;
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i];
    const b = rings[i + 1];
    if ((xf <= a.xf && xf >= b.xf) || (i === 0 && xf > a.xf) || (i === rings.length - 2 && xf < b.xf)) {
      const f = (a.xf - xf) / (a.xf - b.xf || 1);
      return (a.tf + f * (b.tf - a.tf)) * H;
    }
  }
  return 0.5 * H;
}

function plateTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#f8fafc';
  g.fillRect(0, 0, 256, 96);
  g.strokeStyle = '#1a2a44';
  g.lineWidth = 6;
  g.strokeRect(4, 4, 248, 88);
  g.fillStyle = '#1a2a44';
  g.font = 'bold 54px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('VK-773', 128, 52);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// One wheel: lathe tire + recessed chrome dish + 5 spokes + brake
// disc. The returned spin group rotates about local Z (the axle).
// side: +1 = right (+Z outboard), -1 = left.
function buildWheel(side) {
  const spin = new THREE.Group();
  const profile = [
    [0.2, -0.13], [0.28, -0.145], [0.34, -0.13], [0.365, -0.07],
    [0.365, 0.07], [0.34, 0.13], [0.28, 0.145], [0.2, 0.13],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const tireGeo = new THREE.LatheGeometry(profile, 20);
  tireGeo.rotateX(Math.PI / 2);
  spin.add(mesh(tireGeo, RUBBER));
  const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.24, 16);
  rimGeo.rotateX(Math.PI / 2);
  spin.add(mesh(rimGeo, DARK_BARREL));
  const ringGeo = new THREE.TorusGeometry(0.19, 0.02, 6, 20);
  const ring = mesh(ringGeo, CHROME);
  ring.position.z = side * 0.125;
  spin.add(ring);
  const discGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.03, 16);
  discGeo.rotateX(Math.PI / 2);
  const disc = mesh(discGeo, STEEL);
  disc.position.z = side * 0.1;
  spin.add(disc);
  const hubGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.29, 10);
  hubGeo.rotateX(Math.PI / 2);
  spin.add(mesh(hubGeo, DARK_TRIM));
  for (let k = 0; k < 5; k++) {
    const pivot = new THREE.Group();
    pivot.rotation.z = (k * Math.PI * 2) / 5;
    const spoke = mesh(new THREE.BoxGeometry(0.05, 0.3, 0.025), SPOKE_MAT);
    spoke.position.set(0, 0.09, side * 0.125);
    pivot.add(spoke);
    spin.add(pivot);
  }
  // Brake caliper: fixed to the car, NOT the spinning group.
  const caliper = mesh(new THREE.BoxGeometry(0.06, 0.1, 0.05), CALIPER_MAT);
  caliper.position.set(0.1, 0.1, side * 0.1);
  return { spin, caliper };
}

export function buildHeroCar(cls, color, police = false) {
  const def = VEHICLE_CLASSES[cls];
  const g = new THREE.Group();
  const L = def.len;
  const W = def.wid;
  const H = def.h;
  const bodyMat = paintMat(police ? PALETTE.policeWhite : color);
  const roofTop = H * 0.96;
  const glassBase = H * 0.52;

  if (cls === 'bike') {
    // Slim two-wheeler: same wheel positions, same userData shape.
    const spine = mesh(new THREE.BoxGeometry(L * 0.5, 0.22, 0.3), bodyMat, 0, 0.55, 0);
    g.add(spine);
    const seat = mesh(new THREE.BoxGeometry(0.7, 0.12, 0.5), DARK_TRIM, -L * 0.18, H * 0.62, 0);
    g.add(seat);
    const torso = mesh(new THREE.CapsuleGeometry(0.2, 0.35, 4, 10), DARK_TRIM, -L * 0.05, H * 0.95, 0);
    g.add(torso);
    const helmet = mesh(new THREE.SphereGeometry(0.24, 10, 8), STRIPE_MAT, -L * 0.02, H * 1.35, 0);
    g.add(helmet);
  } else {
    // Lower body: the cross-section loft.
    const rings = BODY_RINGS.map((r) => ({
      x: r.xf * (L / 2), w: r.wf * (W / 2), top: r.tf * H, bottom: 0.1,
    }));
    const body = mesh(loftGeometry(rings), bodyMat);
    g.add(body);

    // Greenhouse: recessed tinted glass shell (0.96x inset feel — the
    // glass loft is narrower than the body and sits inside the beltline).
    const cabinX = -L * 0.04;
    const cabinL = L * 0.48;
    const glassRings = [
      { x: cabinX + cabinL / 2, w: 0.78 * (W / 2), top: glassBase + 0.18, bottom: glassBase },
      { x: cabinX + cabinL * 0.22, w: 0.86 * (W / 2), top: roofTop, bottom: glassBase },
      { x: cabinX - cabinL * 0.26, w: 0.86 * (W / 2), top: roofTop + 0.01, bottom: glassBase },
      { x: cabinX - cabinL / 2, w: 0.78 * (W / 2), top: glassBase + 0.2, bottom: glassBase },
    ];
    const glass = mesh(loftGeometry(glassRings), GLASS_MAT, 0, 0, 0, false);
    glass.castShadow = false;
    g.add(glass);

    // ROUND 2 — chrome beltline strip along each side at the base of
    // the glasshouse, so the glass reads as a separate surface from
    // the paint. The strip sits just outside the glass surface
    // (glass half-width 0.86*W/2 at the beltline).
    for (const s of [-1, 1]) {
      const belt = mesh(new THREE.BoxGeometry(cabinL * 0.95, 0.03, 0.02), CHROME, cabinX, glassBase + 0.02, s * 0.87);
      belt.castShadow = false;
      g.add(belt);
    }

    // Dark interior behind the glass (dashboard, two seats, steering
    // wheel, rear-view mirror) — without it the glass is a hole.
    const dash = mesh(new THREE.BoxGeometry(0.35, 0.12, 1.5), INTERIOR_MAT, cabinX + cabinL / 2 - 0.12, glassBase + 0.12, 0);
    g.add(dash);
    for (const s of [-1, 1]) {
      const seatBase = mesh(new THREE.BoxGeometry(0.45, 0.1, 0.42), INTERIOR_MAT, -0.15, glassBase + 0.08, s * 0.38);
      g.add(seatBase);
      const back = mesh(new THREE.BoxGeometry(0.1, 0.45, 0.42), INTERIOR_MAT, -0.4, glassBase + 0.3, s * 0.38);
      back.rotation.z = -0.15;
      g.add(back);
    }
    const wheelGeo = new THREE.TorusGeometry(0.16, 0.02, 6, 16);
    const steer = mesh(wheelGeo, INTERIOR_MAT, 0.45, glassBase + 0.25, -0.38);
    steer.rotation.set(0.35, Math.PI / 2, 0);
    g.add(steer);
    const mirror = mesh(new THREE.BoxGeometry(0.04, 0.06, 0.16), INTERIOR_MAT, 0.55, glassBase + 0.38, 0);
    g.add(mirror);

    // Painted roof panel on top of the greenhouse.
    const roof = mesh(new THREE.BoxGeometry(cabinL * 0.52, 0.05, W * 0.75), bodyMat, -0.05, roofTop - 0.005, 0);
    g.add(roof);

    // Racing stripes: two crisp white stripes with a thin dark
    // pinstripe edge, sunk FLUSH into the body surface (tops 6 mm
    // proud) so they read as paint, not rails. Heights come from the
    // real loft surface, not a guessed constant.
    if (!police && (cls === 'sports' || cls === 'muscle' || cls === 'sedan')) {
      const segs = [
        { x: 1.35, y: bodyTopAt(1.35, L, H), len: 0.8, tilt: -0.064 },
        { x: -0.05, y: roofTop + 0.026, len: 1.05, tilt: 0 },
        { x: -1.15, y: bodyTopAt(-1.15, L, H), len: 0.95, tilt: 0.035 },
      ];
      for (const seg of segs) {
        for (const s of [-1, 1]) {
          const pin = mesh(new THREE.BoxGeometry(seg.len, 0.012, 0.2), DARK_TRIM, seg.x, seg.y, s * 0.13);
          pin.rotation.z = seg.tilt;
          pin.castShadow = false;
          g.add(pin);
          const stripe = mesh(new THREE.BoxGeometry(seg.len, 0.012, 0.16), STRIPE_MAT, seg.x, seg.y + 0.001, s * 0.13);
          stripe.rotation.z = seg.tilt;
          stripe.castShadow = false;
          g.add(stripe);
        }
      }
    }

    // Hood bulge + two shallow channels + front intake + side vents.
    const bulge = mesh(new THREE.SphereGeometry(0.5, 12, 8), bodyMat, L * 0.31, H * 0.47, 0);
    bulge.scale.set(1.5, 0.1, 0.85);
    g.add(bulge);
    for (const s of [-1, 1]) {
      const ch = mesh(new THREE.BoxGeometry(0.9, 0.015, 0.06), DARK_TRIM, L * 0.3, H * 0.52, s * 0.55);
      ch.castShadow = false;
      g.add(ch);
      const vent = mesh(new THREE.BoxGeometry(0.25, 0.06, 0.02), DARK_TRIM, L * 0.36, H * 0.39, s * (W / 2 + 0.005));
      vent.castShadow = false;
      g.add(vent);
    }
    const intake = mesh(new THREE.BoxGeometry(0.06, 0.1, 0.9), DARK_TRIM, L / 2 - 0.02, 0.22, 0);
    g.add(intake);

    // Front grille: wide black inset + horizontal slats. The front
    // face is nearly vertical and only 0.30*H tall, so the grille
    // (centre 0.21*H) and headlights (centre 0.19*H) stay inside it.
    const grille = mesh(new THREE.BoxGeometry(0.06, 0.16, 1.0), DARK_TRIM, L / 2 + 0.005, H * 0.21, 0);
    g.add(grille);
    for (const dy of [-0.045, 0, 0.045]) {
      const slat = mesh(new THREE.BoxGeometry(0.02, 0.025, 0.9), STEEL, L / 2 + 0.04, H * 0.21 + dy, 0);
      slat.castShadow = false;
      g.add(slat);
    }
    // Halo headlights: one warm-white ring + lens per side, centred on
    // the front face (radius 0.09 at y 0.19*H stays inside the face).
    for (const s of [-1, 1]) {
      const halo = mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 18), HALO_MAT, L / 2 + 0.02, H * 0.19, s * 0.6);
      halo.rotation.y = Math.PI / 2;
      halo.castShadow = false;
      g.add(halo);
      const lens = mesh(new THREE.CircleGeometry(0.075, 14), LENS_MAT, L / 2 + 0.015, H * 0.19, s * 0.6);
      lens.rotation.y = Math.PI / 2;
      lens.castShadow = false;
      g.add(lens);
    }
    // Lower bumper: three air intakes + body-colour splitter, so the
    // nose is not one solid black wall.
    const bumper = mesh(new THREE.BoxGeometry(0.1, 0.14, 1.1), DARK_TRIM, L / 2 - 0.01, 0.15, 0);
    g.add(bumper);
    const splitter = mesh(new THREE.BoxGeometry(0.22, 0.03, 1.3), bodyMat, L / 2 + 0.06, 0.09, 0);
    g.add(splitter);

    // Spoiler: two swept stanchions + airfoil blade (sports/muscle).
    if (cls === 'muscle' || cls === 'sports') {
      for (const s of [-1, 1]) {
        const st = mesh(new THREE.BoxGeometry(0.06, 0.2, 0.05), DARK_TRIM, -L * 0.44, H * 0.55, s * 0.55);
        g.add(st);
      }
      const blade = mesh(new THREE.BoxGeometry(0.22, 0.03, 1.78), bodyMat, -L * 0.46, H * 0.6, 0);
      blade.rotation.z = -0.08;
      g.add(blade);
    }

    // Side mirrors: short stalks + angled teardrop pods.
    for (const s of [-1, 1]) {
      const stalk = mesh(new THREE.BoxGeometry(0.04, 0.03, 0.12), DARK_TRIM, L * 0.14, H * 0.6, s * (W / 2 + 0.03));
      g.add(stalk);
      const pod = mesh(new THREE.SphereGeometry(0.07, 10, 8), bodyMat, L * 0.14, H * 0.62, s * (W / 2 + 0.1));
      pod.scale.set(1.3, 0.8, 1.0);
      g.add(pod);
    }

    // Side skirts.
    for (const s of [-1, 1]) {
      const skirt = mesh(new THREE.BoxGeometry(L * 0.92, 0.16, 0.06), DARK_TRIM, 0, H * 0.16, s * (W / 2 + 0.01));
      g.add(skirt);
    }

    // ROUND 2 — rear haunch bulges: a subtle sculpted shoulder over
    // each rear fender, so the rear quarter reads as a haunch, not a
    // flat slab. The bulge intersects the body (inner edge inside the
    // body side) and its top sits just above the beltline.
    for (const s of [-1, 1]) {
      const haunch = mesh(new THREE.SphereGeometry(0.5, 12, 8), bodyMat, -L * 0.3, H * 0.48, s * (W / 2 - 0.08));
      haunch.scale.set(1.3, 0.18, 0.35);
      g.add(haunch);
    }

    // Police livery: black doors + hood, white roof, light bar, push bar.
    if (police) {
      const hood = mesh(new THREE.BoxGeometry(L * 0.3, 0.02, W * 0.85), DARK_TRIM, L * 0.3, H * 0.52, 0);
      hood.castShadow = false;
      g.add(hood);
      for (const s of [-1, 1]) {
        const door = mesh(new THREE.BoxGeometry(L * 0.44, 0.3, 0.02), DARK_TRIM, -L * 0.02, H * 0.33, s * (W / 2 + 0.005));
        door.castShadow = false;
        g.add(door);
      }
    }
  }

  // Wheels + fender flares + wheel-well backing (all classes).
  const wheels = [];
  const wx = cls === 'bike' ? [L * 0.32, -L * 0.32] : [L * 0.32, L * 0.32, -L * 0.32, -L * 0.32];
  const wz = cls === 'bike' ? [0, 0] : [W / 2, -W / 2, W / 2, -W / 2];
  const archGeo = new THREE.TorusGeometry(0.44, 0.05, 8, 24, Math.PI);
  // ROUND 2 — dark arch trim: a slightly larger, thinner half-torus
  // just outside the body-colour flare, so the wheel opening reads as
  // a cut arch with a dark outline.
  const trimGeo = new THREE.TorusGeometry(0.47, 0.03, 8, 24, Math.PI);
  const wellGeo = new THREE.CircleGeometry(0.46, 16);
  for (let i = 0; i < wx.length; i++) {
    const side = wz[i] === 0 ? 1 : Math.sign(wz[i]);
    const { spin, caliper } = buildWheel(side);
    spin.position.set(wx[i], 0.36, wz[i]);
    g.add(spin);
    wheels.push(spin);
    caliper.position.x += wx[i];
    caliper.position.y += 0.36;
    caliper.position.z += wz[i];
    g.add(caliper);
    if (cls !== 'bike') {
      const flare = mesh(archGeo, bodyMat, wx[i], 0.36, wz[i] + side * 0.04);
      g.add(flare);
      const trim = mesh(trimGeo, DARK_TRIM, wx[i], 0.36, wz[i] + side * 0.055);
      g.add(trim);
      const well = mesh(wellGeo, DARK_WELL, wx[i], 0.36, wz[i] + side * 0.005, false);
      well.castShadow = false;
      if (side < 0) well.rotation.y = Math.PI;
      g.add(well);
    }
  }

  // Rear (most visible part of the cover): recessed black valance,
  // 6 LED taillight bars, VK-773 plate, twin chrome exhausts.
  const tailDim = new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xff1e27, emissiveIntensity: 0.6, roughness: 0.4 });
  const tailBright = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff1e27, emissiveIntensity: 3.5, roughness: 0.4 });
  const tails = [];
  if (cls !== 'bike') {
    const valance = mesh(new THREE.BoxGeometry(0.06, 0.26, 1.72), DARK_TRIM, -L / 2 - 0.005, H * 0.32, 0);
    g.add(valance);
    for (const s of [-1, 1]) {
      for (const dz of [0.28, 0.55, 0.82]) {
        const bar = mesh(new THREE.BoxGeometry(0.05, 0.05, 0.22), tailDim, -L / 2 - 0.04, H * 0.42, s * dz);
        bar.castShadow = false;
        g.add(bar);
        tails.push(bar);
      }
    }
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.13),
      new THREE.MeshBasicMaterial({ map: plateTexture() }),
    );
    plate.position.set(-L / 2 - 0.045, H * 0.26, 0);
    plate.rotation.y = -Math.PI / 2;
    g.add(plate);
    for (const s of [-1, 1]) {
      const tipGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.14, 10);
      tipGeo.rotateZ(Math.PI / 2);
      const tip = mesh(tipGeo, CHROME, -L / 2 - 0.03, 0.17, s * 0.55);
      g.add(tip);
    }
    const rearBumper = mesh(new THREE.BoxGeometry(0.1, 0.2, W * 0.78), DARK_TRIM, -L / 2 + 0.02, H * 0.3, 0);
    g.add(rearBumper);
  }

  // Police roof light bar (per-car pod materials: police.js flashes
  // them by setHex on r/b material.color).
  let lightBar = null;
  if (police && cls !== 'bike') {
    lightBar = new THREE.Group();
    const base = mesh(new THREE.BoxGeometry(0.95, 0.05, 0.42), DARK_TRIM, 0, 0, 0);
    lightBar.add(base);
    const r = mesh(new THREE.BoxGeometry(0.38, 0.15, 0.36), new THREE.MeshBasicMaterial({ color: 0xff2222 }), -0.24, 0.09, 0);
    const b = mesh(new THREE.BoxGeometry(0.38, 0.15, 0.36), new THREE.MeshBasicMaterial({ color: 0x2244ff }), 0.24, 0.09, 0);
    lightBar.add(r, b);
    // REV1 — steady-glow halo: a slightly larger additive shell over
    // each pod so the bar reads at thumbnail size even in a still.
    // police.js drives shell colour/opacity with the flash; a unit
    // staged lightBarSteady keeps both shells bright.
    const rGlow = mesh(new THREE.BoxGeometry(0.48, 0.24, 0.46), new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }), -0.24, 0.09, 0);
    const bGlow = mesh(new THREE.BoxGeometry(0.48, 0.24, 0.46), new THREE.MeshBasicMaterial({ color: 0x2244ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }), 0.24, 0.09, 0);
    lightBar.add(rGlow, bGlow);
    lightBar.position.set(-L * 0.04, roofTop + 0.1, 0);
    lightBar.userData = { r, b, rGlow, bGlow };
    g.add(lightBar);
    // Push-bar bumper.
    for (const s of [-1, 1]) {
      const vbar = mesh(new THREE.BoxGeometry(0.05, 0.3, 0.06), DARK_TRIM, L / 2 + 0.1, 0.3, s * 0.55);
      g.add(vbar);
    }
    const hbar = mesh(new THREE.BoxGeometry(0.05, 0.06, 1.2), DARK_TRIM, L / 2 + 0.1, 0.3, 0);
    g.add(hbar);
  }

  // Soft additive ground glow under the car (as in buildSmoothBody).
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 20),
    new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.05;
  glow.scale.set(L * 0.62, W * 0.72, 1);
  glow.renderOrder = 3;
  g.add(glow);

  g.userData = { wheels, lightBar, cls, def, bodyMat, tails, tailDim, tailBright, braking: false };
  return g;
}
