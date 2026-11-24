// VERMILION KEYS — minimap: the colour-coded circular map, drawn from
// the view-model only. Player-centred, with tinted islands, roads, a
// dashed wanted search ring, police vision cones, the heli pool, the
// gold mission route and colour-coded dots. No game numbers live here:
// every value comes from the view-model or the style constants.

import { GRAPH } from '../../world/roadNetwork.js';
import { islandRects } from '../../world/cityLayout.js';
import { CTX_TWO_D, FOUR, HALF, MINIMAP, MINIMAP_COLORS, ONE, THREE, TWO, ZERO } from '../hudStyles.js';

export function drawMinimap(canvas, vm) {
  const ctx = canvas.getContext(CTX_TWO_D);
  const S = MINIMAP.size;
  const scale = MINIMAP.scale;
  const mm = vm.minimap;
  const cx = mm.px;
  const cz = mm.pz;
  const centre = S * HALF;
  ctx.clearRect(ZERO, ZERO, S, S);
  ctx.save();
  ctx.beginPath();
  ctx.arc(centre, centre, centre - TWO, ZERO, Math.PI * TWO);
  ctx.clip();
  ctx.fillStyle = MINIMAP_COLORS.water;
  ctx.fillRect(ZERO, ZERO, S, S);
  for (const isl of islandRects()) {
    ctx.fillStyle = isl[FOUR];
    ctx.fillRect(
      centre + (isl[ZERO] - cx) * scale,
      centre + (isl[ONE] - cz) * scale,
      (isl[TWO] - isl[ZERO]) * scale,
      (isl[THREE] - isl[ONE]) * scale,
    );
  }
  const toMap = (x, z) => [centre + (x - cx) * scale, centre + (z - cz) * scale];
  ctx.strokeStyle = MINIMAP_COLORS.road;
  ctx.lineWidth = MINIMAP.roadWidth;
  for (const e of GRAPH.edges) {
    const [ax, ay] = toMap(e.ax, e.az);
    const [bx, by] = toMap(e.bx, e.bz);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
  if (mm.heat) {
    ctx.beginPath();
    ctx.setLineDash([MINIMAP.dashOn, MINIMAP.dashOff]);
    ctx.strokeStyle = MINIMAP_COLORS.search;
    ctx.lineWidth = MINIMAP.rim - ONE;
    ctx.arc(centre, centre, MINIMAP.searchR * scale, ZERO, Math.PI * TWO);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = MINIMAP_COLORS.cone;
    for (const d of mm.dots) {
      if (d.kind !== 'police' || d.heading === undefined) continue;
      const [x, y] = toMap(d.x, d.z);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(d.heading);
      ctx.beginPath();
      ctx.moveTo(ZERO, ZERO);
      ctx.arc(ZERO, ZERO, MINIMAP.coneR * scale, -Math.PI / TWO - MINIMAP.coneHalf, -Math.PI / TWO + MINIMAP.coneHalf);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (mm.heliPool) {
      const [x, y] = toMap(mm.heliPool.x, mm.heliPool.z);
      ctx.fillStyle = MINIMAP_COLORS.pool;
      ctx.beginPath();
      ctx.arc(x, y, MINIMAP.poolR, ZERO, Math.PI * TWO);
      ctx.fill();
    }
  }
  for (const d of mm.dots) {
    const [x, y] = toMap(d.x, d.z);
    ctx.fillStyle = d.kind === 'police'
      ? MINIMAP_COLORS.police
      : d.kind === 'heli' ? MINIMAP_COLORS.heli : MINIMAP_COLORS.traffic;
    const r = d.kind === 'police'
      ? MINIMAP.policeR
      : d.kind === 'heli' ? MINIMAP.heliR : MINIMAP.dotR;
    ctx.beginPath();
    ctx.arc(x, y, r, ZERO, Math.PI * TWO);
    ctx.fill();
    // Spotlight (legacy minimap path): base blip always drawn above;
    // the gold ring + chevron are added on top while marked.
    if (d.kind === 'police' && mm.spotlight) {
      const pulse = r + 4 + Math.sin((mm.time || 0) * 8) * 2;
      ctx.beginPath();
      ctx.arc(x, y, pulse, ZERO, Math.PI * TWO);
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(x, y - r - 10);
      ctx.lineTo(x - 5, y - r - 3);
      ctx.lineTo(x + 5, y - r - 3);
      ctx.closePath();
      ctx.fill();
    }
  }
  if (mm.target) {
    const [x, y] = toMap(mm.target.x, mm.target.z);
    ctx.beginPath();
    ctx.setLineDash([MINIMAP.routeDashOn, MINIMAP.routeDashOff]);
    ctx.strokeStyle = MINIMAP_COLORS.route;
    ctx.lineWidth = MINIMAP.rim - ONE;
    ctx.moveTo(centre, centre);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = MINIMAP_COLORS.route;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / TWO / TWO);
    ctx.fillRect(-MINIMAP.targetHalf, -MINIMAP.targetHalf, MINIMAP.targetHalf * TWO, MINIMAP.targetHalf * TWO);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(centre, centre);
  ctx.rotate(mm.heading);
  ctx.fillStyle = MINIMAP_COLORS.playerFill;
  ctx.strokeStyle = MINIMAP_COLORS.playerStroke;
  ctx.lineWidth = MINIMAP.dotR - ONE;
  ctx.beginPath();
  ctx.moveTo(ZERO, -MINIMAP.arrowLen);
  ctx.lineTo(MINIMAP.arrowHalf, MINIMAP.arrowLen - TWO);
  ctx.lineTo(-MINIMAP.arrowHalf, MINIMAP.arrowLen - TWO);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = MINIMAP_COLORS.rim;
  ctx.lineWidth = MINIMAP.rim;
  ctx.beginPath();
  ctx.arc(centre, centre, centre - TWO, ZERO, Math.PI * TWO);
  ctx.stroke();
}
