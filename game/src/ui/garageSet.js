// VERMILION KEYS — garage studio v3 (Fix Round 8).
// A real 3D room around the hero car — polished floor, red neon
// strips, roller door, three spot lights on the car at a low
// three-quarter angle, vignette — plus a spec panel listing the
// five real upgrades with names + prices from UPGRADES and the live
// cash from progression. One upgrade is selected; the button shows
// its real price. No level numbers (the target image's Engine Lvl 4
// etc. are the concept's, not the game's).
//
// The car MUST be the same hero car model as the cover: it is loaded
// from Builder A's look/heroCarMesh.js (dynamic import, so the
// garage still works if that module lands after this one). If a car
// already sits in the bay — the staged run car, which IS the cover
// car — no second car is added. Only when the bay is empty is a
// hero car placed on the turntable, and then only from heroCarMesh
// (falling back to the existing round-7 smooth body builder).

import * as THREE from 'three';
import { UPGRADES } from '../systems/progression.js';
import { CURRENCY, vehicleDisplayName } from '../world/cityLayout.js';
import { buildSmoothBody } from '../world/vehicleBodyBuilder.js';

const ZERO = 0;
const ONE = 1;
const BAY = { x: 52, z: 128 };

let selectedIdx = ZERO;
let setBuilt = false;
let heroSource = 'not-loaded';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// The 3D room: polished floor, red neon strips, roller door, three
// spot lights aimed at the car. Built once per page load; the
// existing interior (walls, lift, turntable) stays as it is.
function buildGarageSet3D(game) {
  if (setBuilt) return;
  setBuilt = true;
  const scene = game.scene;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 10),
    new THREE.MeshPhongMaterial({ color: 0x1c1e26, shininess: 90, specular: 0x666677 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(BAY.x, 0.03, BAY.z);
  floor.receiveShadow = true;
  scene.add(floor);

  // Red neon strips along both side walls, low, facing the bay.
  const neonMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const s of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 9), neonMat);
    strip.position.set(BAY.x + s * 5.9, 1.1, BAY.z);
    scene.add(strip);
    const glow = new THREE.PointLight(0xff2a2a, 3, 6, 1.8);
    glow.position.set(BAY.x + s * 5.2, 1.1, BAY.z);
    scene.add(glow);
  }

  // Roller door at the open front (south side): ribbed shutter.
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
  const door = new THREE.Mesh(new THREE.BoxGeometry(7.5, 3.6, 0.25), doorMat);
  door.position.set(BAY.x, 1.8, BAY.z + 5.2);
  scene.add(door);
  const ribMat = new THREE.MeshBasicMaterial({ color: 0x22242e });
  for (let i = ZERO; i < 8; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.08, 0.06), ribMat);
    rib.position.set(BAY.x, 0.4 + i * 0.42, BAY.z + 5.34);
    scene.add(rib);
  }

  // Three spot lights on the car: key, fill, rim.
  const spots = [
    { pos: [BAY.x + 4, 5.5, BAY.z + 4], color: 0xffe0b0, int: 260 },
    { pos: [BAY.x - 4, 4.5, BAY.z + 3], color: 0xbfd8ff, int: 140 },
    { pos: [BAY.x, 5, BAY.z - 4.5], color: 0xff9a6a, int: 180 },
  ];
  for (const s of spots) {
    const spot = new THREE.SpotLight(s.color, s.int, 18, 0.7, 0.5, 1.4);
    spot.position.set(s.pos[ZERO], s.pos[ONE], s.pos[2]);
    spot.target.position.set(BAY.x, 0.6, BAY.z);
    scene.add(spot);
    scene.add(spot.target);
  }
  window.__garageSet = { built: true, heroSource };
}

// Place the hero car on the turntable only when the bay is empty.
// The staged garage shot already parks the run car (the cover car)
// at the bay, so this normally adds nothing — and never a second car.
async function ensureHeroCar(game) {
  // The staged run car is a standalone Car the player sits in — it is
  // in none of traffic.cars / police.units, so check player.inCar too.
  const cars = [...game.traffic.cars, game.starterCar, game.player?.inCar, ...(game.police?.units ?? [])].filter(Boolean);
  const near = cars.some((c) => Math.hypot(c.pos.x - BAY.x, c.pos.z - BAY.z) < 3.5);
  if (near) {
    heroSource = 'bay-car-present';
    if (window.__garageSet) window.__garageSet.heroSource = heroSource;
    return;
  }
  const car = game.progression.garageCar();
  const color = car ? car.color : 0xff6a4a;
  let group = null;
  try {
    const m = await import('../look/heroCarMesh.js');
    const factory = m.buildHeroCar || m.createHeroCar || m.heroCarMesh || m.default;
    if (typeof factory === 'function') {
      // buildHeroCar(cls, color, police) — positional; other
      // factories take an options object. Arity decides the call.
      group = factory.length >= 2 ? factory('sports', color, false) : factory({ color, police: false });
      heroSource = 'heroCarMesh';
    }
  } catch (e) {
    group = null;
  }
  if (!group) {
    group = buildSmoothBody('sports', color, false);
    heroSource = 'smoothBody-fallback';
  }
  group.position.set(BAY.x, 0.54, BAY.z);
  group.rotation.y = -0.6;
  game.scene.add(group);
  if (window.__garageSet) window.__garageSet.heroSource = heroSource;
}

export function renderGarageSet(game, el, msg = '') {
  const prog = game.progression;
  const car = prog.garageCar();
  if (!car) return;
  buildGarageSet3D(game);
  void ensureHeroCar(game);
  const colorHex = '#' + car.color.toString(16).padStart(6, '0');
  const condition = Math.round((car.hp / car.maxHp()) * 100);
  const rows = UPGRADES.map((u, i) => {
    const afford = prog.cash >= u.price;
    const sel = i === selectedIdx;
    return `<div class="up${sel ? ' maxed' : afford ? '' : ' poor'}" data-up="${i}" style="pointer-events:auto;cursor:pointer;${sel ? 'border-color:#fbbf24;background:rgba(60,40,10,.92);' : ''}"><b>${i + ONE}</b><div class="up-body"><span>${esc(u.name)}</span><i>${esc(u.desc)}</i></div><b class="up-price">${CURRENCY}${u.price.toLocaleString('en-US')}</b></div>`;
  }).join('');
  const sel = UPGRADES[selectedIdx];
  el.innerHTML = `
    <div class="garage-panel">
      <div class="gp-head">VERMILION MOTOR WORKS</div>
      <div class="gp-car"><span class="gp-swatch" style="background:${colorHex}"></span><b>${esc(vehicleDisplayName(car.cls).toUpperCase())}</b><span>CONDITION ${condition}%</span></div>
      ${rows}
      <div class="gp-cash">CASH <b>${CURRENCY}${prog.cash.toLocaleString('en-US')}</b></div>
      <button type="button" id="gs-buy" style="pointer-events:auto;cursor:pointer;width:100%;background:#fbbf24;color:#1a0f1e;border:none;border-radius:6px;padding:12px;font-size:17px;font-weight:800;letter-spacing:1px;">UPGRADE ${CURRENCY}${sel.price.toLocaleString('en-US')}</button>
      ${msg ? `<div class="gp-msg">${esc(msg)}</div>` : ''}
      <div class="gp-keys">1–5 BUY · ESC CLOSE</div>
    </div>
    <div style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%);"></div>`;
  for (const row of el.querySelectorAll('[data-up]')) {
    row.addEventListener('click', () => {
      selectedIdx = Number(row.getAttribute('data-up'));
      renderGarageSet(game, el, msg);
    });
  }
  const buy = el.querySelector('#gs-buy');
  if (buy) {
    buy.addEventListener('click', () => {
      if (game.menus) game.menus.garageBuy(selectedIdx);
    });
  }
}
