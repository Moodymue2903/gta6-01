// VERMILION KEYS — animated water surface (Fix Round 7, C4).
// Turquoise gradient planes over the harbour / shoreline, laid just
// above the city's base sea (y -1.5), plus small additive glints that
// twinkle with time. Deliberately small: three channel/shoreline
// sheets and ~60 glints. The base sea already scrolls its texture
// in city.update; this module adds the harbour colour and the sparkle
// the flat sea lacks. Cut candidate per FIX7_PLAN (fold into
// harbourLandmarks if time runs short) — it is written as its own
// module anyway, so the fold is a one-import deletion.

import * as THREE from 'three';
import { canvasTexture, mulberry32, rand } from '../util.js';

function gradientTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#19b8ad');
    grad.addColorStop(0.5, '#2e8f9e');
    grad.addColorStop(1, '#1d6f7d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    // Faint wave streaks.
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
      const y = Math.random() * h;
      ctx.beginPath();
      ctx.moveTo(Math.random() * w, y);
      ctx.lineTo(Math.random() * w + 50, y + (Math.random() - 0.5) * 10);
      ctx.stroke();
    }
  }, 6, 6);
}

export function buildWaterSurface(game) {
  const group = new THREE.Group();
  const rng = mulberry32(20261122);
  const tex = gradientTexture();

  // Gradient sheets: the two causeway channels, the port quay strip,
  // and the beach shoreline foam line. All above the base sea (-1.5)
  // and below the road decks (0.05), so nothing z-fights the road.
  const sheets = [
    { x: 240, z: -27, w: 16, d: 26 },
    { x: 240, z: 27, w: 16, d: 26 },
    { x: 380, z: -200, w: 160, d: 10 },
    { x: 80, z: 160, w: 280, d: 12 },
  ];
  for (const s of sheets) {
    const sheet = new THREE.Mesh(
      new THREE.PlaneGeometry(s.w, s.d),
      new THREE.MeshLambertMaterial({ map: tex, transparent: true, opacity: 0.9 }),
    );
    sheet.rotation.x = -Math.PI / 2;
    sheet.position.set(s.x, -1.2, s.z);
    group.add(sheet);
  }

  // Sparkle glints: small additive planes on the sheets that twinkle
  // (opacity + scale oscillate with individual phases in update).
  const GLINTS = 60;
  const glintGeo = new THREE.PlaneGeometry(1.6, 0.5);
  glintGeo.rotateX(-Math.PI / 2); // lie flat on the water; yaw about Y then spins it in-plane
  const glintMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const glints = new THREE.InstancedMesh(glintGeo, glintMat, GLINTS);
  glints.renderOrder = 2;
  const phases = [];
  const m4 = new THREE.Matrix4();
  const q4 = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < GLINTS; i++) {
    const s = sheets[i % sheets.length];
    const x = s.x + rand(rng, -s.w / 2 + 2, s.w / 2 - 2);
    const z = s.z + rand(rng, -s.d / 2 + 2, s.d / 2 - 2);
    phases.push({ x, z, phase: rand(rng, 0, Math.PI * 2), speed: rand(rng, 0.8, 2.2), rot: rand(rng, 0, Math.PI) });
    q4.setFromAxisAngle(up, phases[i].rot);
    m4.compose(new THREE.Vector3(x, -1.1, z), q4, new THREE.Vector3(1, 1, 1));
    glints.setMatrixAt(i, m4);
  }
  // InstancedMesh shares one material, so per-glint opacity twinkle
  // is done via scale (a glint shrinking to a point reads as fading).
  group.add(glints);

  game.scene.add(group);
  let t = 0;
  return {
    group,
    update(dt) {
      t += dt;
      tex.offset.x += dt * 0.003;
      tex.offset.y += dt * 0.0015;
      for (let i = 0; i < GLINTS; i++) {
        const p = phases[i];
        const k = 0.35 + 0.65 * Math.abs(Math.sin(t * p.speed + p.phase));
        q4.setFromAxisAngle(up, p.rot);
        m4.compose(new THREE.Vector3(p.x, -1.1, p.z), q4, new THREE.Vector3(k, k, 1));
        glints.setMatrixAt(i, m4);
      }
      glints.instanceMatrix.needsUpdate = true;
    },
  };
}
