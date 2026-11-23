// VERMILION KEYS — police: 5-star wanted system, dispatch, roadblocks,
// spike strips, SWAT vans and the helicopter with its searchlight cone.
// Heat rises with crime and only decays once no unit can see the player.
// FIX ROUND 3 — the wanted level is witness-driven, like the real GTA 6:
//   * a crime nobody sees creates lingering Heat, not instant stars.
//   * a witness (phone up, 2 s) reports it: stars appear GREY (reported,
//     police heading to the scene), turn WHITE when units are dispatched,
//     turn RED when a unit has eyes on you.
//   * police have roles, not a single chase: Pursuit, Flanker (cuts to a
//     predicted interception point, P + V x 2.5, via the road graph),
//     Roadblock (two cruisers across the road + spike strip).
//   * spike strips deflate tires on contact; the scanner ticker narrates
//     it all with real dispatch strings.

import * as THREE from 'three';
import { Car } from './vehicle.js';
import { canvasTexture, choice, clamp, rand } from '../util.js';
import { edgeHeading, lanePoint, nearestRoadPoint } from '../world/roadNetwork.js';

const UNIT_NAMES = ['VKPD-07', 'VKPD-12', 'VKPD-19', 'VKPD-23', 'VKPD-31', 'VKPD-44', 'VKPD-52', 'VKPD-68', 'VKPD-71', 'VKPD-85'];
const MAX_UNITS = 8;

// FIX ROUND 8 — safe police spawn offsets. A spawned unit is never
// placed on top of the hero (the Tidebreak police-wedge bug: a unit
// spawning on the hero and pinning it to 0-3 km/h must NOT exist
// here): at least MIN_HERO_DIST from the hero car, at least
// MIN_UNIT_DIST from every other unit, on a road (a lane point on the
// nearest road edge, never inside a building), and never within
// AHEAD_CLEAR directly ahead of a moving hero's nose. Enforced in
// spawnUnit: retry candidates first, then push out / sweep to a road
// point that clears every rule.
const MIN_HERO_DIST = 12;
const MIN_UNIT_DIST = 8;
const AHEAD_CLEAR = 3;

function makeHeliMesh() {
  const g = new THREE.Group();
  // FIX ROUND 2 — full remodel. The old heli was a white box with a
  // black cross on top: a grey slab, not a helicopter. A real heli reads
  // at 320px by its silhouette, so every part below exists to make that
  // silhouette: rounded nose + glass canopy, tail boom + fin + tail
  // rotor, skids, a rotor mast, and the searchlight under the nose.
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1a20 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x7ab8d9, emissive: 0x1a3a4a, emissiveIntensity: 0.6 });
  // Rounded fuselage: capsule lying along X (nose +X), slightly squashed.
  const bodyGeo = new THREE.CapsuleGeometry(1.0, 2.0, 6, 12);
  bodyGeo.rotateZ(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.scale.set(1, 0.85, 1.05);
  body.castShadow = true;
  g.add(body);
  // Glass cockpit canopy: flattened sphere at the nose.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 10), glassMat);
  canopy.scale.set(1.1, 0.75, 0.95);
  canopy.position.set(1.5, 0.15, 0);
  g.add(canopy);
  // Red police stripe along each flank.
  for (const s of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.28, 0.06), new THREE.MeshBasicMaterial({ color: 0xd93a2a }));
    stripe.position.set(-0.3, -0.1, s * 1.02);
    g.add(stripe);
  }
  // Tail boom: tapered cylinder along -X.
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 4.2, 8), bodyMat);
  boom.rotation.z = Math.PI / 2;
  boom.position.set(-3.6, 0.25, 0);
  g.add(boom);
  // Tail fin (vertical) + horizontal stabilizer.
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 0.9), bodyMat);
  fin.position.set(-5.5, 0.9, 0);
  g.add(fin);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 2.2), bodyMat);
  stab.position.set(-5.2, 0.3, 0);
  g.add(stab);
  // Tail rotor: small cross on the fin side, spins about the lateral axis.
  const tailRotor = new THREE.Group();
  tailRotor.position.set(-5.6, 0.9, 0.55);
  const trBlade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.12), darkMat);
  tailRotor.add(trBlade);
  const trBlade2 = trBlade.clone();
  trBlade2.rotation.x = Math.PI / 2;
  tailRotor.add(trBlade2);
  g.add(tailRotor);
  // Skids: two rails + struts.
  const skidMat = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.6, 6), skidMat);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0.3, -1.15, s * 0.85);
    g.add(rail);
    for (const sx of [-0.9, 0.9]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6), skidMat);
      strut.position.set(sx, -0.85, s * 0.85);
      g.add(strut);
    }
  }
  // Rotor mast + head.
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.7, 8), skidMat);
  mast.position.y = 1.15;
  g.add(mast);
  const rotor = new THREE.Group();
  rotor.position.y = 1.55;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), darkMat);
  rotor.add(blade);
  const blade2 = blade.clone();
  blade2.rotation.y = Math.PI / 2;
  rotor.add(blade2);
  // Rotor blur disc: a faint disc under the blades so the spinning rotor
  // reads as a disc, not a black cross.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(4.5, 24),
    new THREE.MeshBasicMaterial({ color: 0x222226, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -0.05;
  rotor.add(disc);
  g.add(rotor);
  // Searchlight, LAYERED and mounted under the nose (FIX ROUND 2: it
  // hung from the body centre before). Outer cone faint and wide, inner
  // cone bright and narrow, a hotspot sprite at the lamp, and the ground
  // pool below — brightest at the core, fading toward the edges and
  // along the length.
  const lamp = new THREE.Group();
  lamp.position.set(1.9, -0.9, 0);
  function beam(radius, opacity) {
    const geo = new THREE.ConeGeometry(radius, 46, 14, 1, true);
    geo.translate(0, -23, 0);
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = radius > 4 ? 1 : 2; // outer draws first, inner over it
    return m;
  }
  const coneOuter = beam(4.5, 0.07);
  const cone = beam(2.4, 0.25);
  lamp.add(coneOuter);
  lamp.add(cone);
  // Hotspot glow at the lamp itself (shared radial-gradient sprite).
  const glowTex = canvasTexture(64, 64, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,242,176,1)');
    grad.addColorStop(0.4, 'rgba(255,242,176,0.5)');
    grad.addColorStop(1, 'rgba(255,242,176,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  const hotspot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff2b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  hotspot.scale.set(5, 5, 1);
  lamp.add(hotspot);
  g.add(lamp);
  g.userData = { rotor, tailRotor, cone, coneOuter, hotspot };
  return g;
}

export class Police {
  constructor(game) {
    this.game = game;
    this.heat = 0;
    this.stars = 0;
    this.units = [];
    this.heli = null;
    this.heliAngle = 0;
    this.unseenTimer = 0;
    this.bustedTimer = 0;
    this.roadblock = null; // {x, z, strip, cars}
    this.swat = [];
    this._unitSeq = 0;
    // FIX ROUND 3 — witness-driven wanted state.
    this.known = false; // the police have been told about you
    this.starState = 'none'; // none | grey (reported) | white (acknowledged) | red (engaged)
    this._greyT = 0;
    this.scanner = []; // newest-first dispatch strings for the HUD ticker
    this._stripCooldown = 0;
    this._prevStars = 0;
  }

  get wanted() {
    return this.stars > 0;
  }

  // Line of sight between two ground points: blocked if the segment
  // crosses a building collider (sampled). Cheap, deterministic.
  hasLOS(x1, z1, x2, z2) {
    for (let i = 1; i < 10; i++) {
      const t = i / 10;
      const x = x1 + (x2 - x1) * t;
      const z = z1 + (z2 - z1) * t;
      for (const c of this.game.city.colliders) {
        if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1) return false;
      }
    }
    return true;
  }

  pushScanner(text) {
    this.scanner.unshift(text);
    if (this.scanner.length > 4) this.scanner.length = 4;
  }

  // A crime at (x, z): the nearest civilian who can see it becomes a
  // witness (phone up, 2 s). A crime nobody sees adds lingering Heat
  // only — no stars, no dispatch. Called by combat.fire() and car hits.
  reportCrime(x, z, type) {
    const w = this.game.peds.findWitness(x, z);
    if (!w) {
      this.addHeat(5, type, { reported: false });
      return;
    }
    w.state = 'witness';
    w.reportTimer = 2.0;
    w.witnessCrime = type;
    this.pushScanner('Witness on the phone — possible ' + type + '.');
  }

  // A witness finished their call: the police are told.
  witnessReported(ped) {
    this.addHeat(25, ped.witnessCrime || 'crime reported');
    this.pushScanner('Civilian reported a crime — all units respond.');
    this.game.audio?.blip('mission');
  }

  addHeat(n, _reason, opts = {}) {
    this.heat = clamp(this.heat + n, 0, 100);
    this.stars = this.heat <= 0 ? 0 : Math.min(5, Math.ceil(this.heat / 20));
    if (opts.reported !== false && this.stars > 0) {
      this.known = true;
      if (this.starState === 'none') this.starState = 'grey';
    }
    this.game.progression?.noteWanted(this.stars);
  }

  clearHeat() {
    this.heat = 0;
    this.stars = 0;
    this.known = false;
    this.starState = 'none';
  }

  spawnUnit(kind) {
    const player = this.game.player;
    const px = player.inCar ? player.inCar.pos.x : player.pos.x;
    const pz = player.inCar ? player.inCar.pos.z : player.pos.z;
    const heroHeading = player.inCar ? player.inCar.heading : player.heading;
    const heroSpeed = player.inCar ? Math.abs(player.inCar.speed) : 0;
    // A candidate spawn point: a lane point on the nearest road edge
    // to a random point near the hero (on a road by construction).
    const pick = () => {
      const near = nearestRoadPoint(px + rand(this.game.rng, -90, 90), pz + rand(this.game.rng, -90, 90));
      const side = this.game.rng() < 0.5 ? 1 : -1;
      const p = lanePoint(near.edge, near.t, side);
      return { x: p.x, z: p.z, edge: near.edge, t: near.t, side };
    };
    // Clear of the hero: MIN_HERO_DIST away, and never within
    // AHEAD_CLEAR directly ahead of a moving hero's nose (along-track
    // 0..AHEAD_CLEAR, lateral < 2.5 m) — the wedge that pins the hero.
    const clearOfHero = (x, z) => {
      const dx = x - px;
      const dz = z - pz;
      if (Math.hypot(dx, dz) < MIN_HERO_DIST) return false;
      if (heroSpeed > 1) {
        const fx = Math.sin(heroHeading);
        const fz = Math.cos(heroHeading);
        const along = dx * fx + dz * fz;
        const lat = Math.abs(dx * fz - dz * fx);
        if (along > 0 && along < AHEAD_CLEAR && lat < 2.5) return false;
      }
      return true;
    };
    // Clear of every other unit (police, roadblock cars included).
    const clearOfUnits = (x, z) => {
      for (const u of this.units) {
        if (Math.hypot(u.pos.x - x, u.pos.z - z) < MIN_UNIT_DIST) return false;
      }
      return true;
    };
    const clear = (x, z) => clearOfHero(x, z) && clearOfUnits(x, z);
    // First: retry random candidates.
    let spot = null;
    for (let i = 0; i < 12 && !spot; i++) {
      const c = pick();
      if (clear(c.x, c.z)) spot = c;
    }
    // Then: push out — fixed rays at 12/20/30/45/60 m, re-snapped to
    // the road, first point that clears every rule. Hero safety
    // outranks unit spacing in the pathological case (tracked below).
    let heroClear = null;
    if (!spot) {
      outer: for (const r of [MIN_HERO_DIST, 20, 30, 45, 60]) {
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const near = nearestRoadPoint(px + Math.sin(a) * r, pz + Math.cos(a) * r);
          for (const side of [1, -1]) {
            const p = lanePoint(near.edge, near.t, side);
            if (!heroClear && clearOfHero(p.x, p.z)) heroClear = { x: p.x, z: p.z, edge: near.edge, t: near.t, side };
            if (clear(p.x, p.z)) {
              spot = { x: p.x, z: p.z, edge: near.edge, t: near.t, side };
              break outer;
            }
          }
        }
      }
    }
    if (!spot) spot = heroClear;
    const cls = kind === 'swat' ? 'van' : 'sedan';
    const car = new Car(this.game, cls, 0xf2f2f2, spot.x, spot.z, edgeHeading(spot.edge, spot.side), true);
    car.unit = {
      name: kind === 'swat' ? 'SWAT-' + (++this._unitSeq) : choice(this.game.rng, UNIT_NAMES),
      state: 'pursue',
      kind,
      blockTarget: null,
      flankTarget: null,
      ramCooldown: 0,
    };
    this.units.push(car);
    return car;
  }

  spawnHeli() {
    const mesh = makeHeliMesh();
    this.game.scene.add(mesh);
    // Light pool: a flat disc on the ground under the player, kept at
    // scene level so it stays flat while the heli group pitches to look.
    // FIX ROUND: radius 6.5 -> 8, opacity 0.25 -> 0.4 — the pool is the
    // proof the beam touches the world, and it was too faint to read.
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(8, 20),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    pool.rotation.x = -Math.PI / 2;
    this.game.scene.add(pool);
    this.heli = { mesh, pool, angle: 0 };
    this.game.audio?.blip('heli');
  }

  despawnHeli() {
    if (!this.heli) return;
    this.game.scene.remove(this.heli.mesh);
    this.game.scene.remove(this.heli.pool);
    this.heli = null;
  }

  update(dt) {
    const player = this.game.player;
    const pPos = player.inCar ? player.inCar.pos : player.pos;
    const pSpeed = player.inCar ? Math.abs(player.inCar.speed) : 0;

    // Star states: grey (reported) -> white (units dispatched, 4 s) ->
    // red (a unit has eyes on you). Heat at zero clears everything.
    if (this.heat <= 0) {
      if (this._prevStars > 0) this.game.progression?.recordEscape();
      this.known = false;
      this.starState = 'none';
      this._greyT = 0;
    } else if (this.known && this.starState === 'grey') {
      this._greyT += dt;
      if (this._greyT > 4) this.starState = 'white';
    }
    if (this.known) {
      for (const u of this.units) {
        const d = Math.hypot(u.pos.x - pPos.x, u.pos.z - pPos.z);
        if (d < 45 && this.hasLOS(u.pos.x, u.pos.z, pPos.x, pPos.z)) {
          this.starState = 'red';
          break;
        }
      }
    }
    this._prevStars = this.stars;

    // Desired force by stars — but only once the police KNOW. An unseen
    // crime (heat, no report) dispatches nobody.
    const wantCruisers = !this.known ? 0 : this.stars === 0 ? 0 : Math.min(MAX_UNITS, this.stars + 1);
    const wantSwat = !this.known ? 0 : this.stars >= 4 ? Math.min(2, this.stars - 3) : 0;
    const wantHeli = this.known && this.stars >= 4;
    while (this.units.filter((u) => u.unit.kind === 'cruiser').length < wantCruisers) this.spawnUnit('cruiser');
    while (this.units.filter((u) => u.unit.kind === 'swat').length < wantSwat) this.spawnUnit('swat');
    if (wantHeli && !this.heli) this.spawnHeli();
    if (!wantHeli && this.heli) this.despawnHeli();
    // Trim extra units when the heat falls.
    while (this.units.filter((u) => u.unit.kind === 'cruiser').length > wantCruisers) {
      const extra = this.units.find((u) => u.unit.kind === 'cruiser');
      this.removeUnit(extra);
    }
    while (this.units.filter((u) => u.unit.kind === 'swat').length > wantSwat) {
      const extra = this.units.find((u) => u.unit.kind === 'swat');
      this.removeUnit(extra);
    }

    // Heat decay: only when nobody can see the player for 12 s.
    let anyoneNear = false;
    for (const u of this.units) {
      if (Math.hypot(u.pos.x - pPos.x, u.pos.z - pPos.z) < 110) anyoneNear = true;
    }
    if (this.heli) anyoneNear = true; // the searchlight never loses you
    if (anyoneNear) {
      this.unseenTimer = 0;
    } else {
      this.unseenTimer += dt;
      if (this.unseenTimer > 12 && this.heat > 0) {
        this.heat = Math.max(0, this.heat - 10 * dt);
        this.stars = this.heat <= 0 ? 0 : Math.min(5, Math.ceil(this.heat / 20));
      }
    }

    // Roadblocks at 3+ stars: two cruisers across the road ahead.
    if (this.stars >= 3 && this.known && !this.roadblock && pSpeed > 12) {
      this.makeRoadblock();
    }
    if (this.roadblock) {
      const rb = this.roadblock;
      rb.timer -= dt;
      if (rb.timer <= 0 || Math.hypot(rb.x - pPos.x, rb.z - pPos.z) > 220) {
        this.clearRoadblock();
      }
    }

    // Spike strip: drive over it and the tires go down.
    this._stripCooldown = Math.max(0, this._stripCooldown - dt);
    if (this.roadblock && player.inCar && this._stripCooldown <= 0) {
      const sp = this.roadblock.strip.position;
      if (Math.hypot(player.inCar.pos.x - sp.x, player.inCar.pos.z - sp.z) < 5 && pSpeed > 5) {
        player.inCar.tireDamage = 8;
        this._stripCooldown = 5;
        this.pushScanner('Unit 12: spike strip hit — suspect tires down.');
        this.game.audio?.blip('crash');
      }
    }

    // Unit AI.
    for (const u of [...this.units]) {
      if (u.dead) {
        this.removeUnit(u);
        continue;
      }
      const d = Math.hypot(u.pos.x - pPos.x, u.pos.z - pPos.z);
      const unit = u.unit;
      unit.ramCooldown = Math.max(0, unit.ramCooldown - dt);
      let throttle = 0;
      let steer = 0;
      if (unit.state === 'roadblock') {
        // Parked across the road: hold position.
        throttle = 0;
        steer = 0;
        u.speed *= Math.max(0, 1 - 4 * dt);
      } else {
        // Pursue: steer toward the player, ram when close.
        const wantHeading = Math.atan2(pPos.x - u.pos.x, pPos.z - u.pos.z);
        let dh = (wantHeading - u.heading) % (Math.PI * 2);
        if (dh > Math.PI) dh -= Math.PI * 2;
        if (dh < -Math.PI) dh += Math.PI * 2;
        steer = clamp(dh * 1.8, -1, 1);
        throttle = d > 6 ? 1 : 0.7;
        // Flanker: cut to where the player WILL be (P + V x 2.5, snapped
        // to the road graph), not where they are. gta7-style intercept.
        if (this.stars >= 3 && unit.state !== 'flank' && d > 40 && this.game.rng() < dt * 0.1) {
          const pvx = player.inCar ? Math.sin(player.inCar.heading) * player.inCar.speed : 0;
          const pvz = player.inCar ? Math.cos(player.inCar.heading) * player.inCar.speed : 0;
          const pred = nearestRoadPoint(pPos.x + pvx * 2.5, pPos.z + pvz * 2.5);
          unit.state = 'flank';
          unit.flankTarget = { x: pred.x, z: pred.z };
        }
        if (unit.state === 'flank') {
          // Drive to the predicted point, then turn across the road.
          const bt = unit.flankTarget;
          const bd = Math.hypot(u.pos.x - bt.x, u.pos.z - bt.z);
          if (bd < 10) {
            unit.state = 'roadblock';
            u.heading += Math.PI / 2;
          } else {
            const bh = Math.atan2(bt.x - u.pos.x, bt.z - u.pos.z);
            let bh2 = (bh - u.heading) % (Math.PI * 2);
            if (bh2 > Math.PI) bh2 -= Math.PI * 2;
            if (bh2 < -Math.PI) bh2 += Math.PI * 2;
            steer = clamp(bh2 * 1.8, -1, 1);
            throttle = 1;
          }
        }
        // Ram: on contact, damage the player's car and shake the camera.
        if (d < 3.4 && unit.ramCooldown <= 0) {
          unit.ramCooldown = 1.2;
          if (player.inCar) {
            player.inCar.damage(6, 'ram');
            this.game.cameraCtl.addShake(0.5);
            this.game.audio?.blip('crash');
          } else {
            player.damage(12);
          }
        }
      }
      // Flash the light bar.
      const lb = u.mesh.userData.lightBar;
      if (lb) {
        const on = Math.floor(this.game.time * 6) % 2 === 0;
        lb.userData.r.material.color.setHex(on ? 0xff2222 : 0x551111);
        lb.userData.b.material.color.setHex(on ? 0x111155 : 0x2244ff);
      }
      u.update(dt, { throttle, steer, handbrake: false });
      // Unit-to-unit separation so cruisers do not pile up.
      for (const o of this.units) {
        if (o === u) continue;
        const ox = u.pos.x - o.pos.x;
        const oz = u.pos.z - o.pos.z;
        const od = Math.hypot(ox, oz);
        if (od > 0.01 && od < 4) {
          u.pos.x += (ox / od) * (4 - od) * 0.5;
          u.pos.z += (oz / od) * (4 - od) * 0.5;
        }
      }
    }

    // Helicopter: orbit the player, searchlight cone on them.
    if (this.heli) {
      const h = this.heli;
      h.angle += dt * 0.45;
      const hx = pPos.x + Math.cos(h.angle) * 26;
      const hz = pPos.z + Math.sin(h.angle) * 26;
      h.mesh.position.set(hx, 44, hz);
      h.mesh.lookAt(pPos.x, 0, pPos.z);
      h.mesh.userData.rotor.rotation.y += dt * 22;
      if (h.mesh.userData.tailRotor) h.mesh.userData.tailRotor.rotation.x += dt * 30;
      h.pool.position.set(pPos.x, 0.15, pPos.z);
    }

    // Busted: caught on foot, or boxed in while stopped in a car.
    let busted = false;
    if (!player.inCar && !player.dead) {
      for (const u of this.units) {
        if (Math.hypot(u.pos.x - pPos.x, u.pos.z - pPos.z) < 3.2) busted = true;
      }
    }
    if (player.inCar && pSpeed < 1.5 && this.stars >= 2) {
      let near = 0;
      for (const u of this.units) {
        if (Math.hypot(u.pos.x - pPos.x, u.pos.z - pPos.z) < 6) near++;
      }
      if (near >= 2) busted = true;
    }
    if (busted) {
      this.bustedTimer += dt;
      if (this.bustedTimer > 2.2) this.game.busted();
    } else {
      this.bustedTimer = 0;
    }
  }

  makeRoadblock() {
    const player = this.game.player;
    const pPos = player.inCar ? player.inCar.pos : player.pos;
    const heading = player.inCar ? player.inCar.heading : player.heading;
    const ahead = 55;
    const bx = pPos.x + Math.sin(heading) * ahead;
    const bz = pPos.z + Math.cos(heading) * ahead;
    const near = nearestRoadPoint(bx, bz);
    // Park the two cruisers across the road: offset along the road's
    // perpendicular (-cos h, sin h) on either side of the centreline.
    const px = -Math.cos(heading);
    const pz = Math.sin(heading);
    const cars = [];
    for (const s of [-1, 1]) {
      const car = new Car(this.game, 'sedan', 0xf2f2f2, near.x + px * 3.4 * s, near.z + pz * 3.4 * s, heading + Math.PI / 2, true);
      car.unit = { name: 'ROADBLOCK', state: 'roadblock', kind: 'cruiser', blockTarget: null, flankTarget: null, ramCooldown: 0 };
      this.units.push(car);
      cars.push(car);
    }
    // Spike strip across the road just before the block.
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.25, 1.2),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
    );
    strip.position.set(near.x - Math.sin(heading) * 12, 0.15, near.z - Math.cos(heading) * 12);
    strip.rotation.y = heading;
    this.game.scene.add(strip);
    this.roadblock = { x: near.x, z: near.z, strip, cars, timer: 25, heading };
    this.pushScanner('Unit 12: suspect heading east — set the strip.');
  }

  clearRoadblock() {
    if (!this.roadblock) return;
    this.game.scene.remove(this.roadblock.strip);
    for (const car of this.roadblock.cars) {
      const i = this.units.indexOf(car);
      if (i >= 0) this.units.splice(i, 1);
      car.remove();
    }
    this.roadblock = null;
  }

  removeUnit(car) {
    const i = this.units.indexOf(car);
    if (i >= 0) this.units.splice(i, 1);
    car.remove();
  }

  // Roster for the HUD: name, distance, state.
  roster() {
    const player = this.game.player;
    const pPos = player.inCar ? player.inCar.pos : player.pos;
    return this.units.map((u) => ({
      name: u.unit.name,
      dist: Math.round(Math.hypot(u.pos.x - pPos.x, u.pos.z - pPos.z)),
      state: u.unit.state === 'roadblock' ? 'ROADBLOCK' : u.unit.state === 'flank' ? 'FLANKING' : u.unit.kind === 'swat' ? 'SWAT' : 'RAMMING',
      // FIX ROUND 7 — the roster panel shows the NEAREST units first
      // (it takes the first four): unsorted, the first four were spawn
      // order, so a roadblock 18 m away could sit behind a SWAT unit
      // 153 m out. Sorting by distance makes the panel honest.
    })).sort((a, b) => a.dist - b.dist);
  }
}
