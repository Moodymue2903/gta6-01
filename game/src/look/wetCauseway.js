// VERMILION KEYS -- wet causeway (Fix Round 8, Builder B).
// Wet asphalt + puddle/lane texture + reflection streaks + tire
// spray + exhaust flares. NO planar Reflector, no second scene
// render: the wet look is a clearcoat physical material with a
// procedural roughness/texture variation, plus flattened elongated
// transparent streaks under the lights and the hero car.
// Do NOT set road roughness to zero: a perfectly reflective road
// looks like glass, not wet asphalt (roughness ~0.2 with variation,
// clearcoat ~0.90). Streaks are elongated ALONG the road, never
// circular blobs, and carry the colour of their light source at
// much lower brightness. Tire spray is 60-80 small transparent
// particle quads behind the rear tires.

import * as THREE from 'three';
import { canvasTexture, mulberry32, rand, clamp } from '../util.js';

const SPRAY_MAX = 72;

// 512x512 procedural road texture: dark blue-grey asphalt with damp
// longitudinal variation, dashed yellow centreline, white lane
// dividers. Drawn once at boot, never regenerated per frame.
function roadTexture() {
  const tex = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#1e222d';
    ctx.fillRect(0, 0, w, h);
    // Damp longitudinal bands: darker wet strips along the wheel lines.
    for (let i = 0; i < 7; i++) {
      const y = 40 + i * 68 + Math.random() * 20;
      const grad = ctx.createLinearGradient(0, y - 22, 0, y + 22);
      grad.addColorStop(0, 'rgba(10,14,22,0)');
      grad.addColorStop(0.5, 'rgba(10,14,22,0.55)');
      grad.addColorStop(1, 'rgba(10,14,22,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, y - 22, w, 44);
    }
    // Asphalt speckle.
    for (let i = 0; i < 2600; i++) {
      const v = Math.random();
      ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.16)';
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    // Puddle sheen: a few soft pale ellipses that catch the sun.
    for (let i = 0; i < 9; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const rx = 26 + Math.random() * 46;
      const ry = 8 + Math.random() * 12;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
      g.addColorStop(0, 'rgba(255,180,110,0.20)');
      g.addColorStop(1, 'rgba(255,180,110,0)');
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, ry / rx);
      ctx.translate(-x, -y);
      ctx.fillRect(x - rx, y - rx, rx * 2, rx * 2);
      ctx.restore();
    }
    // Dashed yellow centreline (runs along U = road length).
    ctx.fillStyle = '#d8b93a';
    for (let x = 0; x < w; x += 64) ctx.fillRect(x + 8, h / 2 - 4, 36, 8);
    // White lane dividers, dashed.
    ctx.fillStyle = 'rgba(240,240,230,0.9)';
    for (let x = 0; x < w; x += 64) {
      ctx.fillRect(x + 8, h * 0.25 - 3, 36, 6);
      ctx.fillRect(x + 8, h * 0.75 - 3, 36, 6);
    }
  }, 8, 1);
  tex.anisotropy = 4;
  return tex;
}

function softDiscTexture() {
  return canvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

// One flattened transparent streak, elongated along the road (X).
function makeStreak(x, z, len, wid, color, opacity, y = 0.08) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(len, wid),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.renderOrder = 3;
  return m;
}

export function buildWetCauseway(game) {
  const group = new THREE.Group();
  const rng = mulberry32(20261122);

  // Wet asphalt overlay on the causeway deck (x 195-305, the flat
  // road either side of the drawbridge leaves). The leaves rise above
  // it where they lift, so the overlay never pokes through the ramp.
  // MeshPhysicalMaterial: dark blue-grey, metalness ~0.2, roughness
  // ~0.2 with texture variation, clearcoat 0.90 for the wet look.
  const tex = roadTexture();
  const roadMat = new THREE.MeshPhysicalMaterial({
    map: tex,
    bumpMap: tex,
    bumpScale: 0.6,
    color: 0xffffff,
    metalness: 0.2,
    roughness: 0.22,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
    envMapIntensity: 0.7,
  });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(110, 10.4), roadMat);
  road.rotation.x = -Math.PI / 2;
  // y 0.095: above the road soup (0.06) AND the round-6 wet band
  // (0.08) on the chase stretch, so the texture actually shows;
  // the shot-staging streaks sit at 0.10-0.12, above this overlay.
  road.position.set(250, 0.095, 0);
  road.receiveShadow = true;
  group.add(road);

  // Static reflection streaks along the causeway: warm sun streaks
  // running west toward the sunset, cool streaks under the lamps.
  // Elongated along the road, same colour as the source light at
  // much lower brightness. Shot staging adds its own hero streaks
  // on top for the cover; these carry the wet read everywhere else.
  const streaks = [
    [208, -1.5, 16, 1.6, 0xff9a3a, 0.15], [222, 1.5, 20, 1.2, 0xff7a2a, 0.12],
    [236, -2.0, 14, 1.4, 0xffb347, 0.11], [258, 1.0, 18, 1.2, 0xff9a3a, 0.13],
    [272, -1.0, 16, 1.4, 0xff7a2a, 0.12], [288, 0.5, 18, 1.2, 0xffb347, 0.11],
    [216, -4.2, 9, 0.9, 0xffc27a, 0.09], [264, 4.2, 9, 0.9, 0xffc27a, 0.09],
    [240, -4.2, 9, 0.9, 0xcfe8ff, 0.08], [296, -4.2, 9, 0.9, 0xffc27a, 0.09],
  ];
  for (const s of streaks) group.add(makeStreak(s[0], s[1], s[2], s[3], s[4], s[5], 0.11));

  // Warm reflection pool that follows the hero car. Kept small and
  // dim: the first drive render showed a 7 m pool at 0.22 reading
  // as a solid beige carpet under the car, not a reflection.
  const heroPool = makeStreak(250, 0, 6, 2.8, 0xff8a2a, 0.12, 0.115);
  group.add(heroPool);
  const heroPoolCore = makeStreak(250, 0, 4, 1.8, 0xffd9a0, 0.10, 0.12);
  group.add(heroPoolCore);

  // Tire spray: one InstancedMesh of soft quads, 60-80 active.
  // Particles spawn behind the rear tires of the focus car and die
  // by shrinking (per-instance opacity is not available on a shared
  // material, so fade reads as shrink).
  const sprayTex = softDiscTexture();
  const sprayGeo = new THREE.PlaneGeometry(0.9, 0.9);
  const sprayMat = new THREE.MeshBasicMaterial({
    map: sprayTex, color: 0xcfd8e0, transparent: true, opacity: 0.45,
    depthWrite: false,
  });
  const spray = new THREE.InstancedMesh(sprayGeo, sprayMat, SPRAY_MAX);
  spray.renderOrder = 4;
  spray.frustumCulled = false;
  group.add(spray);
  const parts = [];
  for (let i = 0; i < SPRAY_MAX; i++) {
    parts.push({ x: 0, y: -10, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, s: 0 });
  }
  const m4 = new THREE.Matrix4();
  const q4 = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < SPRAY_MAX; i++) spray.setMatrixAt(i, zero);

  // Exhaust flares: two orange sprites + one warm point light that
  // ride behind the tailpipes of the focus car. Sprites only carry
  // the colour; the single point light is the only real light here
  // (local-light budget: this + 4 harbour lamps + the cover glow).
  const flareMat = new THREE.SpriteMaterial({
    map: sprayTex, color: 0xff8a2a, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const flares = [];
  for (let i = 0; i < 2; i++) {
    const sp = new THREE.Sprite(flareMat);
    sp.scale.set(0.7, 0.7, 1);
    sp.visible = false;
    group.add(sp);
    flares.push(sp);
  }
  const exhaustGlow = new THREE.PointLight(0xff8a2a, 6, 6, 1.6);
  exhaustGlow.visible = false;
  group.add(exhaustGlow);

  game.scene.add(group);

  const tmpV = new THREE.Vector3();
  let spawnAcc = 0;
  let t = 0;
  return {
    group,
    sprayMax: SPRAY_MAX,
    update(dt) {
      t += dt;
      const car = game.player ? game.player.inCar : null;
      const speed = car ? Math.abs(car.speed) : 0;
      const fwd = car
        ? tmpV.set(Math.sin(car.heading), 0, Math.cos(car.heading))
        : null;
      // Hero pool follows the car; hidden on foot.
      heroPool.visible = !!car;
      heroPoolCore.visible = !!car;
      if (car) {
        heroPool.position.set(car.pos.x, 0.115, car.pos.z);
        heroPoolCore.position.set(car.pos.x, 0.12, car.pos.z);
      }
      // Spray: spawn behind the rear tires while moving, integrate,
      // shrink to nothing at end of life.
      if (car && speed > 8) {
        spawnAcc += dt * 42;
        while (spawnAcc >= 1) {
          spawnAcc -= 1;
          const p = parts.find((q) => q.life <= 0);
          if (!p) break;
          const side = Math.random() < 0.5 ? -1 : 1;
          const rear = new THREE.Vector3(-car.def.len * 0.32, 0.15, side * car.def.wid * 0.42);
          car.mesh.localToWorld(rear);
          p.x = rear.x;
          p.y = rear.y;
          p.z = rear.z;
          p.vx = -fwd.x * speed * 0.22 + rand(rng, -0.8, 0.8);
          p.vy = rand(rng, 0.8, 2.2);
          p.vz = -fwd.z * speed * 0.22 + rand(rng, -0.8, 0.8);
          p.max = rand(rng, 0.5, 0.9);
          p.life = p.max;
          p.s = rand(rng, 0.5, 1.0);
          p.rot = rand(rng, 0, Math.PI * 2);
        }
      }
      const camQ = game.camera ? game.camera.quaternion : q4;
      for (let i = 0; i < SPRAY_MAX; i++) {
        const p = parts[i];
        if (p.life > 0) {
          p.life -= dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          p.vy -= 3.5 * dt;
          if (p.y < 0.05) p.y = 0.05;
          const k = clamp(p.life / p.max, 0, 1);
          const s = p.s * (0.4 + 0.6 * (1 - k));
          // Billboard quads: face the camera, so a puff never goes
          // edge-on to the chase lens.
          m4.compose(new THREE.Vector3(p.x, p.y, p.z), camQ, new THREE.Vector3(s, s, 1));
          spray.setMatrixAt(i, m4);
        } else {
          spray.setMatrixAt(i, zero);
        }
      }
      spray.instanceMatrix.needsUpdate = true;
      // Exhaust flares: at the tailpipes (local -X is the rear: the
      // mesh nose is +X), flickering with speed, off when slow.
      const show = !!car && speed > 10;
      exhaustGlow.visible = show;
      for (let i = 0; i < 2; i++) {
        const sp = flares[i];
        sp.visible = show;
        if (show) {
          const side = i === 0 ? -0.55 : 0.55;
          const tp = new THREE.Vector3(-car.def.len / 2 - 0.35, 0.32, side);
          car.mesh.localToWorld(tp);
          sp.position.copy(tp);
          const fl = 0.55 + 0.35 * Math.sin(t * 31 + i * 2.1) + speed * 0.004;
          sp.scale.set(fl, fl, 1);
          exhaustGlow.position.copy(tp);
        }
      }
    },
  };
}
