// VERMILION KEYS — signal flares: smuggler contraband pickups.
// Twelve glowing flares are hidden around the Keys; walking or driving
// within three metres of one collects it (Smuggler Contraband +1, V$100).
// Three sit on the east causeway approach, so a bridge run collects
// them. Collected flares stay collected in the save.

import * as THREE from 'three';

export const FLARE_SPOTS = [
  { id: 'f1', x: 285, z: 2 },
  { id: 'f2', x: 270, z: -2 },
  { id: 'f3', x: 255, z: 2 },
  { id: 'f4', x: 100, z: 130 },
  { id: 'f5', x: 60, z: -120 },
  { id: 'f6', x: 390, z: -170 },
  { id: 'f7', x: -280, z: 0 },
  { id: 'f8', x: 120, z: 145 },
  { id: 'f9', x: 460, z: 80 },
  { id: 'f10', x: 60, z: 132 },
  { id: 'f11', x: 380, z: 160 },
  { id: 'f12', x: -70, z: 0 },
];

const FLARE_RADIUS = 3;

export function buildFlares(game) {
  const flares = [];
  for (const s of FLARE_SPOTS) {
    const group = new THREE.Group();
    // Ground flare: a short orange stick with a glowing tip.
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.5, 6),
      new THREE.MeshLambertMaterial({ color: 0xd94a2a }),
    );
    stick.position.y = 0.25;
    stick.rotation.z = 0.5;
    group.add(stick);
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffb703 }),
    );
    tip.position.set(0.12, 0.55, 0);
    group.add(tip);
    // Glow halo so the flare reads at a distance.
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(0.9, 16),
      new THREE.MeshBasicMaterial({ color: 0xff9a2a, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.06;
    group.add(halo);
    group.position.set(s.x, 0, s.z);
    game.scene.add(group);
    const taken = game.activities ? game.activities.flareIds.has(s.id) : false;
    group.visible = !taken;
    flares.push({ id: s.id, x: s.x, z: s.z, mesh: group, taken });
  }
  return flares;
}

export function updateFlares(game) {
  if (!game.flares) return;
  const p = game.player;
  const px = p.inCar ? p.inCar.pos.x : p.pos.x;
  const pz = p.inCar ? p.inCar.pos.z : p.pos.z;
  for (const f of game.flares) {
    if (f.taken) continue;
    if (Math.hypot(f.x - px, f.z - pz) < FLARE_RADIUS) {
      f.taken = true;
      f.mesh.visible = false;
      if (game.activities?.recordFlare(f.id)) {
        game.hud?.banner('CONTRABAND SECURED', 'Signal flare collected — V$100');
        game.audio?.blip('pass');
      }
    }
  }
}
