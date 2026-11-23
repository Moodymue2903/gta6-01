// VERMILION KEYS — shared character rig (Fix Round 8, Builder A).
// One builder for the player, pedestrians, guards and police:
// createCharacter({ bodyType, clothing, skinTone, hairColor, weapon }).
// Hierarchy: characterRoot -> pelvis -> torso -> neck -> head,
// leftShoulder -> leftArm, rightShoulder -> rightArm, leftLeg, rightLeg.
// Every limb pivots on a Group at its joint, so the existing animation
// system can rotate limbs without rebuilding geometry.
// Construction: tapered capsules, NOT rectangular prisms. Proportions
// (~1.78 m): head 0.23, neck 0.10, torso 0.52, pelvis 0.23, upper leg
// 0.43, lower leg 0.42, foot 0.24, upper arm 0.30, forearm 0.27.
// Local convention (matches entities/player.js): the character faces
// local +Z, right arm on +X, left arm on -X. A limb hanging down (-Y)
// swings FORWARD (+Z) with a NEGATIVE rotation.x.
// userData is compatible with the existing player/ped animation code:
// { armL, armR, legL, legR, phone, gun, phase, rig } where armL/armR
// are the shoulder joints and legL/legR the hip joints.

import * as THREE from 'three';

function std(color, roughness = 0.75, metalness = 0.0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// MAKO SMG: receiver + barrel + magazine + stock + grip + sight.
// Origin at the grip, barrel pointing +Z (character forward).
export function buildMakoSMG() {
  const gunmetal = std(0x1c1e24, 0.45, 0.7);
  const gripMat = std(0x14161a, 0.8, 0.1);
  const g = new THREE.Group();
  const receiver = mesh(new THREE.BoxGeometry(0.09, 0.12, 0.42), gunmetal, 0, 0.1, 0.08);
  g.add(receiver);
  const barrelGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.26, 8);
  barrelGeo.rotateX(Math.PI / 2);
  const barrel = mesh(barrelGeo, gunmetal, 0, 0.12, 0.4);
  g.add(barrel);
  const muzzleRing = mesh(new THREE.TorusGeometry(0.035, 0.012, 6, 12), std(0x33363e, 0.4, 0.7), 0, 0.12, 0.52);
  g.add(muzzleRing);
  const mag = mesh(new THREE.BoxGeometry(0.06, 0.2, 0.09), gunmetal, 0, -0.04, 0.12);
  mag.rotation.x = 0.25;
  g.add(mag);
  const stock = mesh(new THREE.BoxGeometry(0.07, 0.09, 0.2), gripMat, 0, 0.09, -0.2);
  g.add(stock);
  const grip = mesh(new THREE.BoxGeometry(0.06, 0.14, 0.07), gripMat, 0, -0.02, -0.06);
  grip.rotation.x = 0.3;
  g.add(grip);
  const sight = mesh(new THREE.BoxGeometry(0.03, 0.05, 0.06), gunmetal, 0, 0.19, 0.05);
  g.add(sight);
  // Muzzle anchor: the flash / tracer start here.
  const muzzle = new THREE.Group();
  muzzle.position.set(0, 0.12, 0.55);
  g.add(muzzle);
  g.userData.muzzle = muzzle;
  return g;
}

function makeMuzzleTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255, 240, 170, 1)');
  grad.addColorStop(0.35, 'rgba(255, 200, 80, 0.9)');
  grad.addColorStop(1, 'rgba(255, 140, 40, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let muzzleTex = null;

// Additive star sprite for the muzzle flash (test/combat use).
export function makeMuzzleFlashSprite(scale = 0.7) {
  if (!muzzleTex) muzzleTex = makeMuzzleTexture();
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: muzzleTex, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  s.scale.set(scale, scale, 1);
  return s;
}

// Short fat tracer from -> to (same look as combat.js tracers).
export function makeTracer(from, to, r = 0.09) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, len, 6, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  m.position.copy(from).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

const SKIN_TONES = { light: 0xe8b98a, medium: 0xc98a5a, dark: 0x8a5a34 };
const HAIR_COLORS = { black: 0x1a1a1a, brown: 0x4a2e18, blond: 0xc8a040, grey: 0x888888 };

function buildHead(joints, opts, skinMat, hairMat) {
  const head = joints.head;
  const skull = mesh(new THREE.SphereGeometry(0.115, 14, 12), skinMat, 0, 0.1, 0);
  skull.scale.set(0.92, 1.08, 0.96);
  head.add(skull);
  // Hair cap + swept quiff (or bun for the bun variant).
  const cap = mesh(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat, 0, 0.115, -0.01);
  head.add(cap);
  if (opts.hairStyle === 'bun') {
    const bun = mesh(new THREE.SphereGeometry(0.05, 8, 6), hairMat, 0, 0.2, -0.1);
    head.add(bun);
  } else {
    const quiff = mesh(new THREE.SphereGeometry(0.055, 8, 6), hairMat, 0, 0.21, 0.05);
    quiff.scale.set(1.3, 0.6, 1.0);
    head.add(quiff);
  }
  // Sunglasses (player / guards); eyes + brows + nose + mouth for all.
  if (opts.sunglasses) {
    const shades = mesh(new THREE.BoxGeometry(0.19, 0.045, 0.03), std(0x0c0e12, 0.15, 0.4), 0, 0.13, 0.105);
    head.add(shades);
  } else {
    for (const s of [-1, 1]) {
      head.add(mesh(new THREE.SphereGeometry(0.014, 6, 6), std(0x14141a, 0.4), s * 0.04, 0.12, 0.105, 0));
      const brow = mesh(new THREE.BoxGeometry(0.045, 0.012, 0.01), hairMat, s * 0.04, 0.155, 0.108);
      brow.castShadow = false;
      head.add(brow);
    }
  }
  const nose = mesh(new THREE.BoxGeometry(0.03, 0.05, 0.03), skinMat, 0, 0.08, 0.112);
  head.add(nose);
  const mouth = mesh(new THREE.BoxGeometry(0.06, 0.012, 0.01), std(0x6a2a22, 0.7), 0, 0.03, 0.108);
  mouth.castShadow = false;
  head.add(mouth);
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.025, 6, 6), skinMat, s * 0.11, 0.1, 0);
    ear.scale.set(0.5, 1, 0.8);
    head.add(ear);
  }
  // Syndicate bandana: the one visual that separates a guard.
  if (opts.bandana) {
    const band = mesh(new THREE.BoxGeometry(0.24, 0.05, 0.24), std(0xd93a2a, 0.7), 0, 0.16, 0);
    head.add(band);
  }
}

export function createCharacter(opts = {}) {
  const bodyType = opts.bodyType || 'ped';
  const clothing = opts.clothing || {};
  const shirtCol = clothing.shirt ?? (bodyType === 'player' ? 0x2ea88a : 0x3a7ad9);
  const pantsCol = clothing.pants ?? 0x2a2a34;
  const vestCol = clothing.vest ?? 0x1e2126;
  const skinCol = SKIN_TONES[opts.skinTone] || opts.skinTone || 0xc98a5a;
  const hairCol = HAIR_COLORS[opts.hairColor] || opts.hairColor || 0x1a1a1a;
  const skinMat = std(skinCol, 0.65);
  const shirtMat = std(shirtCol, 0.8);
  const pantsMat = std(pantsCol, 0.85);
  const vestMat = std(vestCol, 0.7);
  const hairMat = std(hairCol, 0.9);
  const shoeMat = std(clothing.shoes ?? 0xe8e8e8, 0.6);
  const gloveMat = std(0x1a1a20, 0.8);

  const root = new THREE.Group();
  const J = {};

  // Pelvis -> torso -> neck -> head chain.
  J.pelvis = new THREE.Group();
  J.pelvis.position.y = 0.88;
  root.add(J.pelvis);
  const pelvisMesh = mesh(new THREE.CapsuleGeometry(0.16, 0.12, 4, 10), pantsMat, 0, 0, 0);
  pelvisMesh.scale.set(1.25, 0.8, 0.85);
  J.pelvis.add(pelvisMesh);

  J.torso = new THREE.Group();
  J.torso.position.y = 0.06;
  J.pelvis.add(J.torso);
  const torsoMesh = mesh(new THREE.CapsuleGeometry(0.19, 0.38, 8, 16), shirtMat, 0, 0.26, 0);
  torsoMesh.scale.set(1.15, 1.0, 0.72);
  J.torso.add(torsoMesh);
  // Tactical vest (player/police/guard) or open jacket (pedestrians).
  if (bodyType !== 'ped' || clothing.vest) {
    const vest = mesh(new THREE.CapsuleGeometry(0.205, 0.32, 8, 16), vestMat, 0, 0.24, 0);
    vest.scale.set(1.12, 1.0, 0.78);
    J.torso.add(vest);
    const collar = mesh(new THREE.BoxGeometry(0.24, 0.05, 0.06), vestMat, 0, 0.47, 0.12);
    J.torso.add(collar);
    const strap = mesh(new THREE.BoxGeometry(0.3, 0.04, 0.02), std(0x0c0e12, 0.8), 0, 0.32, 0.16);
    strap.castShadow = false;
    J.torso.add(strap);
    const belt = mesh(new THREE.BoxGeometry(0.4, 0.06, 0.3), std(0x0c0e12, 0.8), 0, 0.02, 0);
    J.torso.add(belt);
  }

  J.neck = new THREE.Group();
  J.neck.position.y = 0.52;
  J.torso.add(J.neck);
  J.neck.add(mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8), skinMat, 0, 0.05, 0));
  J.head = new THREE.Group();
  J.head.position.y = 0.1;
  J.neck.add(J.head);
  buildHead(J, {
    sunglasses: bodyType === 'player' || bodyType === 'guard',
    bandana: bodyType === 'guard',
    hairStyle: opts.hairStyle,
  }, skinMat, hairMat);

  // Arms: shoulder joint -> upper arm -> elbow joint -> forearm -> hand.
  function buildArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.24, 0.44, 0);
    J.torso.add(shoulder);
    shoulder.add(mesh(new THREE.CapsuleGeometry(0.065, 0.28, 6, 12), shirtMat, 0, -0.15, 0));
    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    shoulder.add(elbow);
    elbow.add(mesh(new THREE.CapsuleGeometry(0.06, 0.26, 6, 12), bodyType === 'player' ? gloveMat : skinMat, 0, -0.13, 0));
    const hand = new THREE.Group();
    hand.position.y = -0.28;
    elbow.add(hand);
    hand.add(mesh(new THREE.SphereGeometry(0.055, 8, 6), bodyType === 'player' ? gloveMat : skinMat, 0, -0.02, 0));
    return { shoulder, elbow, hand };
  }
  const armL = buildArm(-1);
  const armR = buildArm(1);
  J.leftShoulder = armL.shoulder;
  J.leftElbow = armL.elbow;
  J.leftHand = armL.hand;
  J.rightShoulder = armR.shoulder;
  J.rightElbow = armR.elbow;
  J.rightHand = armR.hand;

  // Legs: hip joint -> thigh -> knee joint -> shin -> foot.
  function buildLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.11, -0.02, 0);
    J.pelvis.add(hip);
    hip.add(mesh(new THREE.CapsuleGeometry(0.08, 0.34, 6, 12), pantsMat, 0, -0.21, 0));
    const knee = new THREE.Group();
    knee.position.y = -0.43;
    hip.add(knee);
    knee.add(mesh(new THREE.CapsuleGeometry(0.075, 0.32, 6, 12), pantsMat, 0, -0.2, 0));
    const foot = new THREE.Group();
    foot.position.y = -0.42;
    knee.add(foot);
    foot.add(mesh(new THREE.BoxGeometry(0.11, 0.07, 0.26), shoeMat, 0, -0.02, 0.05));
    const sole = mesh(new THREE.BoxGeometry(0.12, 0.03, 0.28), std(0x222226, 0.9), 0, -0.06, 0.05);
    foot.add(sole);
    return { hip, knee, foot };
  }
  const legL = buildLeg(-1);
  const legR = buildLeg(1);
  J.leftHip = legL.hip;
  J.leftKnee = legL.knee;
  J.leftFoot = legL.foot;
  J.rightHip = legR.hip;
  J.rightKnee = legR.knee;
  J.rightFoot = legR.foot;

  // Weapon: attached to the RIGHT hand, never floating.
  let weapon = null;
  let muzzle = null;
  if (opts.weapon === 'smg' || opts.weapon === 'mako') {
    weapon = buildMakoSMG();
    const grip = new THREE.Group();
    grip.position.set(0, -0.03, 0.02);
    J.rightHand.add(grip);
    grip.add(weapon);
    muzzle = weapon.userData.muzzle;
    J.weaponGrip = grip;
  }

  // Phone (witnesses only): raised while reporting, hidden otherwise.
  const phone = mesh(
    new THREE.BoxGeometry(0.16, 0.3, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x1a1a22, emissive: 0xfff2c0, emissiveIntensity: 1.0 }),
    -0.2, 0.55, 0.25,
  );
  phone.visible = false;
  J.torso.add(phone);

  const rig = {
    root, joints: J, weapon, muzzle, bodyType,
    setPose(pose, t = 0) { setPose(rig, pose, t); },
  };
  root.userData = {
    armL: J.leftShoulder, armR: J.rightShoulder,
    legL: J.leftHip, legR: J.rightHip,
    phone, gun: weapon, phase: Math.random() * 6, rig,
  };
  root.userData.rig = rig;
  setPose(rig, 'idle', 0);
  return root;
}

// Reset every joint, then apply one named pose. No per-limb randomness.
export function setPose(rig, pose, t = 0) {
  const J = rig.joints;
  for (const k of Object.keys(J)) {
    if (J[k] && J[k].rotation) J[k].rotation.set(0, 0, 0);
  }
  rig.root.rotation.set(0, 0, 0);
  rig.root.position.y = 0;
  const s = Math.sin(t * 9) * 0.55;
  if (pose === 'walk') {
    // Opposite arm/leg sinusoidal swing.
    J.leftHip.rotation.x = -s;
    J.rightHip.rotation.x = s;
    J.leftKnee.rotation.x = Math.max(0, Math.sin(t * 9 - 0.6)) * 0.7;
    J.rightKnee.rotation.x = Math.max(0, Math.sin(t * 9 + Math.PI - 0.6)) * 0.7;
    J.leftShoulder.rotation.x = s * 0.8;
    J.rightShoulder.rotation.x = -s * 0.8;
    J.leftElbow.rotation.x = -0.3;
    J.rightElbow.rotation.x = -0.3;
  } else if (pose === 'aim' || pose === 'fire') {
    // Over-the-shoulder shooter stance: forward knee bent, rear leg
    // braced, torso turned 25 deg, right arm at the trigger, left arm
    // forward under the fore-end, head on the target.
    J.leftHip.rotation.x = -0.35;
    J.leftKnee.rotation.x = 0.38;
    J.rightHip.rotation.x = 0.31;
    J.rightKnee.rotation.x = 0.1;
    J.torso.rotation.y = -0.44;
    J.torso.rotation.x = 0.1;
    J.head.rotation.y = 0.44;
    J.rightShoulder.rotation.x = -1.15;
    J.rightElbow.rotation.x = -0.25;
    J.leftShoulder.rotation.x = -0.9;
    J.leftElbow.rotation.x = -0.7;
    if (pose === 'fire') {
      J.rightShoulder.rotation.x = -1.25;
      J.torso.rotation.x = 0.14;
    }
  } else if (pose === 'hit') {
    J.torso.rotation.x = -0.25;
    J.head.rotation.x = -0.2;
    J.leftShoulder.rotation.x = -0.7;
    J.rightShoulder.rotation.x = -0.7;
    J.leftElbow.rotation.x = -0.9;
    J.rightElbow.rotation.x = -0.9;
    J.leftHip.rotation.x = 0.15;
    J.rightHip.rotation.x = -0.1;
  } else if (pose === 'death') {
    rig.root.rotation.x = Math.PI / 2 - 0.15;
    rig.root.position.y = 0.35;
  } else {
    // idle
    J.leftShoulder.rotation.x = 0.06;
    J.rightShoulder.rotation.x = 0.06;
    J.leftElbow.rotation.x = -0.15;
    J.rightElbow.rotation.x = -0.15;
  }
}

// Muzzle world position of a rigged character mesh (null if none).
export function getRigMuzzle(mesh) {
  const rig = mesh?.userData?.rig;
  if (!rig || !rig.muzzle) return null;
  const v = new THREE.Vector3();
  rig.muzzle.getWorldPosition(v);
  return v;
}
