// VERMILION KEYS — baked minimap (Fix Round 8).
// The whole city is baked ONCE at boot into a 2048 canvas from the
// real world data — water, islands, district tints, causeways and the
// road graph — then at runtime it is drawn with a rotated drawImage
// through a circular clip. No per-frame city redraw, no network
// assets, deterministic and offline.
//
// World bounds come from MAP_BOUNDS in hudStyles.js (x -460..490,
// z -210..210). Colours follow the plan: water teal, roads cream,
// land sand with a lighter shoreline, district tints at low alpha.
// There is no park dataset and no building-footprint registry in the
// world modules, so those two layers are NOT invented here — the
// district tints are the only shading the real data provides.

import { GRAPH } from '../world/roadNetwork.js';
import { islandRects, districtRects } from '../world/cityLayout.js';
import { MAP_BOUNDS } from './hudStyles.js';

const BAKE = 2048;
const ZERO = 0;
const ONE = 1;
const TWO = 2;

let baked = null;

export function bakeMinimap() {
  if (baked) return baked;
  const cv = document.createElement('canvas');
  cv.width = BAKE;
  cv.height = BAKE;
  const ctx = cv.getContext('2d');
  const minX = MAP_BOUNDS[ZERO];
  const minZ = MAP_BOUNDS[ONE];
  const maxX = MAP_BOUNDS[TWO];
  const maxZ = MAP_BOUNDS[3];
  const worldW = maxX - minX;
  const worldH = maxZ - minZ;
  const scale = BAKE / Math.max(worldW, worldH);
  const ox = (BAKE - worldW * scale) / TWO - minX * scale;
  const oy = (BAKE - worldH * scale) / TWO - minZ * scale;
  const X = (x) => ox + x * scale;
  const Z = (z) => oy + z * scale;

  // Water: teal across the whole tile.
  ctx.fillStyle = '#0e7a8a';
  ctx.fillRect(ZERO, ZERO, BAKE, BAKE);

  // Islands: sand land with a lighter shoreline stroke.
  for (const isl of islandRects()) {
    ctx.fillStyle = isl[4];
    ctx.fillRect(X(isl[ZERO]), Z(isl[ONE]), (isl[TWO] - isl[ZERO]) * scale, (isl[3] - isl[ONE]) * scale);
    ctx.strokeStyle = 'rgba(245, 229, 197, 0.9)';
    ctx.lineWidth = Math.max(2, 3 * scale);
    ctx.strokeRect(X(isl[ZERO]), Z(isl[ONE]), (isl[TWO] - isl[ZERO]) * scale, (isl[3] - isl[ONE]) * scale);
  }

  // District tints: the real district rects at low alpha, so the map
  // reads as neighbourhoods, not one flat sand block.
  ctx.globalAlpha = 0.28;
  for (const d of districtRects()) {
    ctx.fillStyle = d[6];
    ctx.fillRect(X(d[TWO]), Z(d[3]), (d[4] - d[TWO]) * scale, (d[5] - d[3]) * scale);
  }
  ctx.globalAlpha = ONE;

  // Causeways: the two land bridges between the islands.
  ctx.fillStyle = '#d8c090';
  for (const c of [[-90, -14, -70, 14], [230, -14, 250, 14]]) {
    ctx.fillRect(X(c[ZERO]), Z(c[ONE]), (c[TWO] - c[ZERO]) * scale, (c[3] - c[ONE]) * scale);
  }

  // Roads: the real road graph, cream, wide enough to read at 160 px.
  ctx.strokeStyle = '#f2e6d8';
  ctx.lineWidth = Math.max(4, 10 * scale);
  ctx.lineCap = 'round';
  for (const e of GRAPH.edges) {
    ctx.beginPath();
    ctx.moveTo(X(e.ax), Z(e.az));
    ctx.lineTo(X(e.bx), Z(e.bz));
    ctx.stroke();
  }

  baked = { canvas: cv, scale, ox, oy };
  return baked;
}

// Draw the baked tile into a circular minimap canvas, player-centred
// and rotated so the heading points up. Police blips, the heli blip,
// the gold route to the mission target, the player arrow, a gold ring
// and an N marker are drawn on top from the live view-model.
export function drawBakedMinimap(canvas, vm) {
  const b = bakeMinimap();
  const ctx = canvas.getContext('2d');
  const S = canvas.width;
  const centre = S / TWO;
  const mm = vm.minimap;
  // Show ~520 m across the 160 px circle: streets read, the whole
  // city does not have to fit.
  const viewM = 520;
  const pxPerM = S / viewM;
  const srcM = viewM;
  const srcPx = srcM * b.scale;

  ctx.clearRect(ZERO, ZERO, S, S);
  ctx.save();
  ctx.beginPath();
  ctx.arc(centre, centre, centre - TWO, ZERO, Math.PI * TWO);
  ctx.clip();
  ctx.translate(centre, centre);
  ctx.rotate(-mm.heading);
  ctx.drawImage(
    b.canvas,
    (b.ox + mm.px * b.scale) - srcPx / TWO,
    (b.oy + mm.pz * b.scale) - srcPx / TWO,
    srcPx, srcPx,
    -S / TWO, -S / TWO, S, S,
  );
  ctx.restore();

  // Everything below is drawn in screen space (heading-up): the
  // rotation above only moved the baked tile, so blips stay upright.
  const toMap = (x, z) => {
    const dx = (x - mm.px) * pxPerM;
    const dz = (z - mm.pz) * pxPerM;
    const c = Math.cos(-mm.heading);
    const s = Math.sin(-mm.heading);
    return [centre + dx * c - dz * s, centre + dx * s + dz * c];
  };
  if (mm.heat) {
    ctx.beginPath();
    ctx.setLineDash([7, 6]);
    ctx.strokeStyle = 'rgba(255, 64, 48, 0.85)';
    ctx.lineWidth = 2;
    ctx.arc(centre, centre, 120 * pxPerM, ZERO, Math.PI * TWO);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (mm.target) {
    const [tx, ty] = toMap(mm.target.x, mm.target.z);
    ctx.beginPath();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = '#ffc27a';
    ctx.lineWidth = 2;
    ctx.moveTo(centre, centre);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffc27a';
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
  }
  for (const d of mm.dots) {
    const [x, y] = toMap(d.x, d.z);
    if (Math.hypot(x - centre, y - centre) > centre) continue;
    if (d.kind === 'police') {
      ctx.fillStyle = '#ff3a3a';
      ctx.fillRect(x - 4, y - 4, 8, 8);
    } else if (d.kind === 'heli') {
      ctx.fillStyle = '#ff9a3a';
      ctx.beginPath();
      ctx.arc(x, y, 6, ZERO, Math.PI * TWO);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(x, y, 2, ZERO, Math.PI * TWO);
      ctx.fill();
    }
  }
  if (mm.heliPool) {
    const [x, y] = toMap(mm.heliPool.x, mm.heliPool.z);
    ctx.fillStyle = 'rgba(255, 210, 90, 0.35)';
    ctx.beginPath();
    ctx.arc(x, y, 9, ZERO, Math.PI * TWO);
    ctx.fill();
  }
  // Player arrow, pointing up (heading-up map).
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centre, centre - 10);
  ctx.lineTo(centre + 7, centre + 8);
  ctx.lineTo(centre - 7, centre + 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Gold ring + N marker (fixed to the top of the circle).
  ctx.strokeStyle = 'rgba(255,194,122,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(centre, centre, centre - TWO, ZERO, Math.PI * TWO);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('N', centre, 16);
}
