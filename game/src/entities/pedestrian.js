// VERMILION KEYS — pedestrians: 35 walkers on the sidewalks.
// Walkers wander between sidewalk points, idle, and flee from the player
// when a crime happens nearby. A car hit knocks one down (and adds heat).
// FIX ROUND 3 — a real crowd, not a backdrop:
//   * states: walk / alert / flee / hide / witness / guard / down.
//     idle -> alerted -> fleeing -> hiding -> returning.
//   * gunfire within 30 m makes civilians panic and bolt (reactToGunfire).
//   * a witness (phone up, 2 s) reports a crime they saw; interrupt them
//     before the timer runs out and the police are never told.
//   * syndicate guards: dark-clothed, red bandana, gun in hand. They hold
//     their post, take cover, and stay down when shot (no respawn) — they
//     are the container-yard fight (mission 5).
// FIX ROUND 4 — downed guards must read as BODIES, not dark-on-dark
// debris: downBody() lays a guard out with a pale shirt, a blood pool
// and a dropped gun. Witnesses keep filming after they report (phone
// stays up while they flee), so the witness is still identifiable at
// the screenshot freeze — in fix 3 the phone vanished the moment the
// report landed. The phone itself is bigger now, with a glowing screen.
// FIX ROUND 5 — the panic radius is 30 m (was 28): gunfire anywhere in
// the yard fight makes the whole aisle bolt.

import * as THREE from 'three';
import { choice, rand } from '../util.js';
import { randomSidewalkPoint } from '../world/roadNetwork.js';

const COUNT = 35;
const SHIRTS = [0xe84a3a, 0x3a7ad9, 0xe8c93a, 0x2ea88a, 0xd97bd9, 0xe8e8e8, 0x222226, 0xd97b2e, 0x8a6a3a];

function makePedMesh(shirt, opts = {}) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.72, 0.3), mat(shirt));
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), mat(0xc98a5a));
  head.position.y = 1.68;
  g.add(head);
  // Syndicate bandana: a thin red band around the head. It is the one
  // visual that separates a guard from a civilian at 320 px.
  if (opts.guard) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.1, 0.52), mat(0xd93a2a));
    band.position.y = 1.78;
    g.add(band);
  }
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), mat(0x2a2a34));
  legL.position.set(-0.14, 0.35, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  g.add(legL, legR);
  // Gun in the right hand (guards only): a short dark box, held forward.
  let gun = null;
  if (opts.guard) {
    gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.55), mat(0x14141a));
    gun.position.set(0.42, 1.15, 0.25);
    g.add(gun);
  }
  // Phone in the right hand (witnesses only): raised while reporting.
  // FIX ROUND 4: bigger (0.16 x 0.3) with a glowing screen — the fix-3
  // phone was a 0.1 x 0.2 dark box, invisible at frame scale, so the
  // witness never read as a witness.
  const phone = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.3, 0.05),
    new THREE.MeshLambertMaterial({ color: 0x1a1a22, emissive: 0xfff2c0, emissiveIntensity: 1.0 }),
  );
  phone.position.set(0.44, 1.52, 0.18);
  phone.visible = false;
  g.add(phone);
  g.userData = { legL, legR, phase: Math.random() * 6, phone, gun };
  return g;
}

export class Pedestrians {
  constructor(game) {
    this.game = game;
    this.peds = [];
    for (let i = 0; i < COUNT; i++) {
      const p = randomSidewalkPoint(game.rng, 0, 0, 400);
      this.peds.push(this.spawn(game.rng, p.x, p.z));
    }
  }

  spawn(rng, x, z) {
    const mesh = makePedMesh(choice(rng, SHIRTS));
    this.game.scene.add(mesh);
    return {
      mesh,
      pos: new THREE.Vector3(x, 0, z),
      heading: rand(rng, 0, Math.PI * 2),
      state: 'walk',
      target: randomSidewalkPoint(rng, x, z, 60),
      idle: rand(rng, 0, 2),
      speed: rand(rng, 1.1, 1.8),
      downTimer: 0,
      fleeT: 0,
      alertT: 0,
      hideT: 0,
      reportTimer: 0,
      witnessCrime: null,
      filming: false,
      filmT: 0,
      guard: false,
    };
  }

  // A syndicate guard: holds a fixed post, never wanders, never respawns.
  // cover=true puts them crouched behind a stall.
  spawnGuard(x, z, heading, cover = false) {
    const mesh = makePedMesh(0x1a1a20, { guard: true });
    this.game.scene.add(mesh);
    const p = {
      mesh,
      pos: new THREE.Vector3(x, 0, z),
      heading,
      state: cover ? 'guard-cover' : 'guard',
      target: null,
      idle: 0,
      speed: 0,
      downTimer: 0,
      fleeT: 0,
      alertT: 0,
      hideT: 0,
      reportTimer: 0,
      witnessCrime: null,
      filming: false,
      filmT: 0,
      guard: true,
      cover,
    };
    mesh.position.copy(p.pos);
    mesh.rotation.y = heading;
    if (cover) mesh.scale.y = 0.72;
    this.peds.push(p);
    return p;
  }

  // A static figure that never wanders (the garage mechanic Lo).
  spawnStatic(x, z, heading, shirt) {
    const mesh = makePedMesh(shirt);
    this.game.scene.add(mesh);
    const p = {
      mesh,
      pos: new THREE.Vector3(x, 0, z),
      heading,
      state: 'idle',
      target: null,
      idle: Infinity,
      speed: 0,
      downTimer: 0,
      fleeT: 0,
      alertT: 0,
      hideT: 0,
      reportTimer: 0,
      witnessCrime: null,
      filming: false,
      filmT: 0,
      guard: false,
      static: true,
    };
    mesh.position.copy(p.pos);
    mesh.rotation.y = heading;
    this.peds.push(p);
    return p;
  }

  removePed(p) {
    const i = this.peds.indexOf(p);
    if (i >= 0) this.peds.splice(i, 1);
    this.game.scene.remove(p.mesh);
  }

  // Lay a body out so it reads as a body, not debris (FIX ROUND 4).
  // The dark guard uniform vanishes against the dark market floor, so a
  // downed guard gets a pale shirt, a blood pool under the torso and
  // (guards only) the dropped gun beside the hand. Used by knockDown()
  // and by screenshot staging for guards down before the frame.
  downBody(p) {
    p.state = 'down';
    p.filming = false;
    p.mesh.userData.phone.visible = false;
    p.mesh.rotation.set(Math.PI / 2 - 0.15, p.heading, 0);
    p.mesh.position.y = 0.35;
    // Pale shirt: the torso is the first child of the ped group.
    const body = p.mesh.children[0];
    if (body) body.material = new THREE.MeshLambertMaterial({ color: 0xd8cbb8 });
    // Blood pool under the torso.
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 12),
      new THREE.MeshBasicMaterial({ color: 0x6a0d0d }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(p.pos.x, 0.03, p.pos.z);
    this.game.scene.add(pool);
    p._pool = pool;
    // Dropped gun beside the body (guards only).
    if (p.guard) {
      const gun = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.06, 0.1),
        new THREE.MeshLambertMaterial({ color: 0x14141a }),
      );
      gun.position.set(p.pos.x + 0.7, 0.05, p.pos.z + 0.3);
      gun.rotation.y = p.heading;
      this.game.scene.add(gun);
      p._droppedGun = gun;
    }
  }

  // Gunfire nearby: civilians panic and bolt away from the shots.
  // Guards hold their post and face the shooter instead.
  reactToGunfire(x, z) {
    const player = this.game.player;
    const px = player.inCar ? player.inCar.pos.x : player.pos.x;
    const pz = player.inCar ? player.inCar.pos.z : player.pos.z;
    for (const p of this.peds) {
      if (p.state === 'down' || p.static) continue;
      const d = Math.hypot(p.pos.x - x, p.pos.z - z);
      if (d > 30) continue;
      if (p.guard) {
        p.heading = Math.atan2(px - p.pos.x, pz - p.pos.z);
        p.mesh.rotation.y = p.heading;
      } else if (p.state !== 'flee' && p.state !== 'witness') {
        p.state = 'flee';
        p.fleeT = rand(this.game.rng, 3, 5);
      }
    }
  }

  // A crime at (x, z): the nearest civilian who can see it becomes a
  // witness (phone up, 2 s). Returns the witness or null. The police
  // system drives the report through witnessReported().
  findWitness(x, z) {
    let best = null;
    let bestD = 30;
    for (const p of this.peds) {
      if (p.state === 'down' || p.guard || p.static || p.state === 'witness') continue;
      const d = Math.hypot(p.pos.x - x, p.pos.z - z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  update(dt) {
    const player = this.game.player;
    const px = player.inCar ? player.inCar.pos.x : player.pos.x;
    const pz = player.inCar ? player.inCar.pos.z : player.pos.z;
    const playerSpeed = player.inCar ? Math.abs(player.inCar.speed) : 0;
    for (const p of this.peds) {
      if (p.state === 'down') {
        if (p.guard) continue; // guards stay down — they are the body count
        p.downTimer -= dt;
        if (p.downTimer <= 0) {
          // Get back up somewhere else and walk on.
          const spot = randomSidewalkPoint(this.game.rng, px, pz, 120);
          p.pos.set(spot.x, 0, spot.z);
          p.mesh.rotation.set(0, p.heading, 0);
          p.mesh.visible = true;
          p.state = 'walk';
          p.target = randomSidewalkPoint(this.game.rng, spot.x, spot.z, 60);
        }
        continue;
      }
      if (p.state === 'witness') {
        // Phone up, reporting. If the timer runs out, the police are told.
        p.mesh.userData.phone.visible = true;
        p.reportTimer -= dt;
        if (p.reportTimer <= 0) {
          // FIX ROUND 4: the witness keeps FILMING after the call — the
          // phone stays up while they flee, so the witness is still
          // identifiable at the screenshot freeze (in fix 3 the phone
          // vanished the moment the report landed).
          p.filming = true;
          p.filmT = 4;
          this.game.police.witnessReported(p);
          p.state = 'flee';
          p.fleeT = 4;
        }
        p.mesh.position.copy(p.pos);
        continue;
      } else {
        // Phone stays up while a witness is filming after their call.
        p.mesh.userData.phone.visible = !!p.filming;
      }
      if (p.state === 'guard' || p.state === 'guard-cover') {
        // Hold the post. Face the player when they are close enough to
        // be a threat; the cover guard stays crouched.
        const d = Math.hypot(p.pos.x - px, p.pos.z - pz);
        if (d < 30) {
          p.heading = Math.atan2(px - p.pos.x, pz - p.pos.z);
          p.mesh.rotation.y = p.heading;
        }
        p.mesh.position.copy(p.pos);
        continue;
      }
      if (p.static) {
        p.mesh.position.copy(p.pos);
        p.mesh.rotation.y = p.heading;
        continue;
      }
      const dx = p.pos.x - px;
      const dz = p.pos.z - pz;
      const d = Math.hypot(dx, dz);
      // Alert: a police unit passes close, or the heat just went up.
      if (p.state === 'walk' && this.game.police.stars > 0 && d < 12) {
        p.state = 'alert';
        p.alertT = 1.5;
        p.heading = Math.atan2(-dx, -dz);
      }
      if (p.state === 'alert') {
        p.alertT -= dt;
        p.mesh.position.copy(p.pos);
        p.mesh.rotation.y = p.heading;
        if (p.alertT <= 0) p.state = 'walk';
        continue;
      }
      if (p.state === 'hide') {
        // Crouched against cover. Then back to the street.
        p.hideT -= dt;
        p.mesh.scale.y = 0.72;
        p.mesh.position.copy(p.pos);
        if (p.hideT <= 0) {
          p.mesh.scale.y = 1;
          p.state = 'walk';
        }
        continue;
      }
      // Flee a nearby crime or a fast car.
      if (p.state !== 'flee' && ((this.game.police.stars > 0 && d < 16) || (player.inCar && playerSpeed > 8 && d < 9))) {
        p.state = 'flee';
        p.fleeT = rand(this.game.rng, 2.5, 4.5);
      }
      if (p.state === 'flee') {
        p.fleeT -= dt;
        const run = 5.5;
        p.pos.x += (dx / (d || 1)) * run * dt;
        p.pos.z += (dz / (d || 1)) * run * dt;
        p.heading = Math.atan2(dx, dz);
        // Filming stops a few seconds after the call.
        if (p.filming) {
          p.filmT -= dt;
          if (p.filmT <= 0) {
            p.filming = false;
            p.mesh.userData.phone.visible = false;
          }
        }
        if (p.fleeT <= 0) {
          // Half the crowd hides after fleeing; the rest walk on.
          if (this.game.rng() < 0.5) {
            p.state = 'hide';
            p.hideT = rand(this.game.rng, 3, 5);
          } else {
            p.state = 'walk';
          }
        }
      } else if (p.idle > 0) {
        p.idle -= dt;
      } else {
        const tx = p.target.x - p.pos.x;
        const tz = p.target.z - p.pos.z;
        const td = Math.hypot(tx, tz);
        if (td < 1.5) {
          p.target = randomSidewalkPoint(this.game.rng, p.pos.x, p.pos.z, 60);
          p.idle = rand(this.game.rng, 0.5, 3);
        } else {
          p.pos.x += (tx / td) * p.speed * dt;
          p.pos.z += (tz / td) * p.speed * dt;
          p.heading = Math.atan2(tx, tz);
          p.mesh.userData.phase += dt * p.speed * 4;
        }
      }
      // Hit by the player's car: knock down, add heat.
      if (player.inCar && playerSpeed > 3 && d < 1.9 && p.state !== 'down') {
        this.knockDown(p, 'car');
      }
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.y = p.heading;
      if (p.state === 'walk' && p.idle <= 0) {
        const s = Math.sin(p.mesh.userData.phase) * 0.5;
        p.mesh.userData.legL.rotation.x = s;
        p.mesh.userData.legR.rotation.x = -s;
      }
    }
  }

  knockDown(p, cause) {
    p.state = 'down';
    p.filming = false;
    p.mesh.userData.phone.visible = false;
    if (p.guard) {
      // Guards stay down: they are the fight's body count, and the
      // mission counts them. No respawn, no getting back up.
      p.downTimer = Infinity;
      this.downBody(p);
      this.game.progression?.recordTakedown();
    } else {
      p.downTimer = 6;
      p.mesh.rotation.set(Math.PI / 2 - 0.15, p.heading, 0);
      p.mesh.position.y = 0.35;
      if (cause === 'car') {
        this.game.police.addHeat(30, 'pedestrian struck');
        this.game.progression?.recordTakedown();
      }
    }
    if (cause === 'shot') this.game.police.addHeat(15, 'pedestrian shot');
    this.game.audio?.blip('thud');
  }

  // Nearest pedestrian within range of a point (for shooting).
  nearest(x, z, range) {
    let best = null;
    let bestD = range;
    for (const p of this.peds) {
      if (p.state === 'down') continue;
      const d = Math.hypot(p.pos.x - x, p.pos.z - z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }
}
