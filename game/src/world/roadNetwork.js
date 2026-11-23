// VERMILION KEYS — road network: island layout, causeways, road graph.
// The layout is authored data (hand-placed spine), not random: downtown
// tower island, beach boardwalk island, port + old-town island, linked by
// two causeways. The B–C causeway carries the drawbridge — the leap.
// All coordinates are metres, x east, z south, y up, ground y = 0.

export const ISLANDS = [
  { name: 'downtown', x0: -460, z0: -190, x1: -90, z1: 190 },
  { name: 'boardwalk', x0: -70, z0: -160, x1: 230, z1: 160 },
  { name: 'port', x0: 250, z0: -210, x1: 490, z1: 210 },
];

export const CAUSEWAYS = [
  { name: 'west-causeway', x0: -90, z0: -14, x1: -70, z1: 14 },
  { name: 'east-causeway', x0: 230, z0: -14, x1: 250, z1: 14 },
];

// The drawbridge span on the east causeway: two leaves that rise to a
// jump. East leaf climbs 232->240, west leaf climbs 252->244, and the
// 4 m gap between their tips (240..244) is open water when the bridge is UP.
// Cars at speed launch off a leaf tip and fly the gap.
export const DRAWBRIDGE = { x0: 232, x1: 252, gap0: 240, gap1: 244, height: 4.5, z0: -7, z1: 7 };

export function isLand(x, z) {
  for (const r of ISLANDS) {
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return true;
  }
  for (const r of CAUSEWAYS) {
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return true;
  }
  return false;
}

export function isWater(x, z) {
  return !isLand(x, z);
}

// Ground height: 0 everywhere except the drawbridge ramps when raised.
export function groundHeightAt(x, z, bridgeUp) {
  if (!bridgeUp) return 0;
  if (z < DRAWBRIDGE.z0 || z > DRAWBRIDGE.z1) return 0;
  if (x >= DRAWBRIDGE.x0 && x < DRAWBRIDGE.gap0) {
    return ((x - DRAWBRIDGE.x0) / (DRAWBRIDGE.gap0 - DRAWBRIDGE.x0)) * DRAWBRIDGE.height;
  }
  if (x >= DRAWBRIDGE.gap0 && x < DRAWBRIDGE.gap1) return -999; // the gap: no ground
  if (x >= DRAWBRIDGE.gap1 && x < DRAWBRIDGE.x1) {
    return ((DRAWBRIDGE.x1 - x) / (DRAWBRIDGE.x1 - DRAWBRIDGE.gap1)) * DRAWBRIDGE.height;
  }
  return 0;
}

// --- Road graph: nodes at intersections, edges between neighbours. ---
// Right-hand traffic: a car travelling a->b drives on the lane offset to the
// right of its direction, (-dz, +dx) * LANE.

export const LANE = 2.2;
export const ROAD_HALF = 5;

function buildGraph() {
  const nodes = [];
  const nodeByKey = new Map();
  function node(x, z) {
    const k = x + ',' + z;
    if (!nodeByKey.has(k)) {
      nodeByKey.set(k, nodes.length);
      nodes.push({ id: nodes.length, x, z, edges: [] });
    }
    return nodeByKey.get(k);
  }
  const edges = [];
  function edge(ax, az, bx, bz) {
    const a = node(ax, az);
    const b = node(bx, bz);
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    const e = { id: edges.length, a, b, ax, az, bx, bz, dx: dx / len, dz: dz / len, len };
    edges.push(e);
    nodes[a].edges.push(e.id);
    nodes[b].edges.push(e.id);
    return e;
  }
  // Downtown grid: avenues x -420..-140, streets z -140..140.
  const av = [-420, -350, -280, -210, -140];
  const st = [-140, -70, 0, 70, 140];
  for (let i = 0; i < av.length - 1; i++) {
    for (const z of st) edge(av[i], z, av[i + 1], z);
  }
  for (let i = 0; i < st.length - 1; i++) {
    for (const x of av) edge(x, st[i], x, st[i + 1]);
  }
  // Downtown -> west causeway -> boardwalk.
  edge(-140, 0, -90, 0);
  edge(-90, 0, -70, 0);
  edge(-70, 0, -20, 0);
  // Boardwalk: Marina Blvd z=0, Ocean Drive z=110, Marina Rd z=-140.
  const bx = [-20, 60, 140, 200];
  for (let i = 0; i < bx.length - 1; i++) {
    edge(bx[i], 0, bx[i + 1], 0);
    edge(bx[i], 110, bx[i + 1], 110);
    edge(bx[i], -140, bx[i + 1], -140);
  }
  edge(200, 0, 230, 0);
  for (const x of bx) {
    edge(x, -140, x, 0);
    edge(x, 0, x, 110);
    edge(x, 110, x, 150);
  }
  // Boardwalk -> east causeway (drawbridge) -> port.
  edge(230, 0, 250, 0);
  edge(250, 0, 300, 0);
  // Port + old town: port road z=-160, old-town grid.
  const px = [300, 380, 460];
  const pz = [-80, 0, 80, 160];
  edge(250, -160, 300, -160);
  edge(300, -160, 380, -160);
  edge(380, -160, 460, -160);
  edge(460, -160, 490, -160);
  for (let i = 0; i < px.length - 1; i++) {
    for (const z of pz) edge(px[i], z, px[i + 1], z);
  }
  for (let i = 0; i < pz.length - 1; i++) {
    for (const x of px) edge(x, pz[i], x, pz[i + 1]);
  }
  edge(250, 0, 250, -160);
  edge(250, 0, 250, 80);
  edge(250, 80, 300, 80);
  return { nodes, edges };
}

export const GRAPH = buildGraph();

// --- PURSUIT_ROUTE: ferry terminal -> Bazaar Quay market (both forks). ---
// Verified 2026-11-23 by tracing GRAPH + the deterministic city colliders:
//   * every on-road leg is a real graph edge (Branch A: #56, #57, #47;
//     Branch B: #56, #46, #60, #47). Ground is 0 along the whole route
//     with the drawbridge down AND up (bridge span x 232..252 never
//     overlaps the route, x <= 140). All legs are on land.
//   * the last leg (120,110) -> (120,125) has NO graph edge: it is a
//     15 m crossing of open plaza ground, not a road. Its straight line
//     is BLOCKED for a car: the fruit stand at (120,112) sits dead on
//     the x=120 line (collider 118.6..121.4 x 111.2..112.8) and market
//     stall #6 sits on the destination itself (120,125 is inside its
//     collider 118.5..121.5 x 124.1..125.9). Both branches therefore
//     finish through the verified-clear gap at x=115 (stalls at x=110
//     and x=120 leave a 7 m gap; (115,125) is clear for r=2.5).
//   * (120,110) itself is within car radius (2.5 m) of the fruit stand,
//     so it is a pass-through turn point, never a reset target for a
//     car; nearestRouteWaypoint() skips it for cars (clear on foot).
//   * the shared first leg is NOT clean lane-following: the building at
//     (72.1,-18.7) puts its collider (x0 61.4) across the northbound
//     lane x=62.2 for z -29.8..-7.6 (centre-inside trap), and the
//     building at (47,-41.7) scrapes the southbound lane x=57.8 (edge
//     56.4, 1.4 m away) for z -53..-30.4. The road stays passable by
//     steering (one side is always open, >= 6 m clear); the wall-trap
//     guard + stuck-reset below are what keep a lane-following car
//     from being trapped there. (Root cause: the city plot guard keeps
//     plot centres >= 12 m from a road, but a 22 m wide plot reaches
//     11.5 m from its centre, so its collider can sit 0.5 m from the
//     centreline. Fixing the guard is city.js generation, out of scope
//     here; this route documents the intrusions instead.)
// NOTE on compass: the task calls +z "north"; per the convention in
// this file (x east, z south) travelling (60,-140) -> (60,110) heads
// SOUTH (+z, toward the beach). Coordinates below are authoritative.
export const PURSUIT_ROUTE = {
  start: [60, -140], // Marina Rd, Coral Marina quay
  fork: [60, 0], // Marina Blvd junction
  plaza: [120, 125], // Bazaar Quay market centre (named destination; occupied by stall #6 — see note above)
  plazaArrival: [115, 125], // verified-clear plaza arrival for cars and on foot
  branchA: [[60, -140], [60, 0], [60, 110], [120, 110], [115, 110], [115, 125]],
  branchB: [[60, -140], [60, 0], [140, 0], [140, 110], [120, 110], [115, 110], [115, 125]],
};

// Point on an edge at parameter t (0..1), on the lane for travel a->b
// (side +1) or b->a (side -1).
export function lanePoint(e, t, side) {
  const x = e.ax + (e.bx - e.ax) * t;
  const z = e.az + (e.bz - e.az) * t;
  const rx = -e.dz * LANE * side;
  const rz = e.dx * LANE * side;
  return { x: x + rx, z: z + rz };
}

export function edgeHeading(e, side) {
  const dx = side > 0 ? e.dx : -e.dx;
  const dz = side > 0 ? e.dz : -e.dz;
  return Math.atan2(dx, dz);
}

// Nearest point on the road graph to (x, z): the edge, parameter and point.
export function nearestRoadPoint(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const e of GRAPH.edges) {
    const vx = e.bx - e.ax;
    const vz = e.bz - e.az;
    const len2 = vx * vx + vz * vz;
    let t = ((x - e.ax) * vx + (z - e.az) * vz) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = e.ax + vx * t;
    const pz = e.az + vz * t;
    const d = (x - px) * (x - px) + (z - pz) * (z - pz);
    if (d < bestD) {
      bestD = d;
      best = { edge: e, t, x: px, z: pz, dist: Math.sqrt(d) };
    }
  }
  return best;
}

export function randomEdge(rng) {
  return GRAPH.edges[Math.floor(rng() * GRAPH.edges.length)];
}

// --- Collision: circle vs AABB push-out (wall-trap guard). ---
// The old code in player.js / vehicle.js pushed a circle out only when
// its centre was OUTSIDE the box (d2 > 0.0001). When the centre ended
// up INSIDE a building AABB — driving into it on the lane line, or a
// spawn/exit landing inside — the closest point was the centre itself,
// d2 was 0, nothing pushed, and the body stayed trapped inside the
// wall forever: the Tidebreak wall-trap. These helpers close it:
// a body walking/driving into a wall slides along it and is never left
// inside a building. Pure functions (no THREE), so they are unit
// testable in node; player.js and vehicle.js both call them.

// Resolve a circle (x, z, radius r) against every collider AABB.
// Returns { x, z, hit }: the corrected centre (fully outside every box)
// and whether any push-out happened. Centre-inside is pushed out along
// the smallest penetration axis to the nearest face, plus the radius.
// Two passes: a push-out from one box can land inside another.
// EPS (0.1 mm) keeps the resolved circle strictly clear of the box
// instead of exactly tangent, so a strict overlap test cannot flicker
// true on floating-point rounding.
export function resolveCircleVsColliders(x, z, r, colliders) {
  const EPS = 1e-4;
  let px = x;
  let pz = z;
  let hit = false;
  for (let pass = 0; pass < 2; pass++) {
    let moved = false;
    for (const c of colliders) {
      const cx = px < c.x0 ? c.x0 : px > c.x1 ? c.x1 : px;
      const cz = pz < c.z0 ? c.z0 : pz > c.z1 ? c.z1 : pz;
      const dx = px - cx;
      const dz = pz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        if (d < r) {
          // Push to r + EPS out, not exactly r: strictly clear, so a
          // strict overlap test cannot flicker true on rounding.
          const push = (r - d + EPS) / d;
          px += dx * push;
          pz += dz * push;
          hit = true;
          moved = true;
        }
      } else {
        // Centre inside (or exactly on) the box: no push direction from
        // the closest point, so push along the smallest penetration axis.
        const pl = px - c.x0;
        const pr = c.x1 - px;
        const pt = pz - c.z0;
        const pb = c.z1 - pz;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) px = c.x0 - r - EPS;
        else if (m === pr) px = c.x1 + r + EPS;
        else if (m === pt) pz = c.z0 - r - EPS;
        else pz = c.z1 + r + EPS;
        hit = true;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return { x: px, z: pz, hit };
}

// True when the point is inside (or exactly on) any collider AABB.
export function pointInAnyCollider(x, z, colliders) {
  for (const c of colliders) {
    if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1) return true;
  }
  return false;
}

// True when a circle of radius r around (x, z) overlaps any collider.
export function circleHitsAnyCollider(x, z, r, colliders) {
  for (const c of colliders) {
    const cx = x < c.x0 ? c.x0 : x > c.x1 ? c.x1 : x;
    const cz = z < c.z0 ? c.z0 : z > c.z1 ? c.z1 : z;
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

// Nearest PURSUIT_ROUTE waypoint to (x, z) that a circle of radius r can
// actually sit on (no collider overlap). Returns { x, z } or null when
// every waypoint is blocked for that radius. Used as the stuck-reset
// fallback when the last good on-road position is lost.
export function nearestRouteWaypoint(x, z, r, colliders) {
  const seen = new Set();
  let best = null;
  let bestD = Infinity;
  for (const branch of [PURSUIT_ROUTE.branchA, PURSUIT_ROUTE.branchB]) {
    for (const [wx, wz] of branch) {
      const k = wx + ',' + wz;
      if (seen.has(k)) continue;
      seen.add(k);
      if (circleHitsAnyCollider(wx, wz, r, colliders)) continue;
      const d = (wx - x) * (wx - x) + (wz - z) * (wz - z);
      if (d < bestD) {
        bestD = d;
        best = { x: wx, z: wz };
      }
    }
  }
  return best;
}

// Pick the next edge at a node, avoiding an immediate U-turn when possible.
export function pickNextEdge(rng, nodeId, fromEdgeId) {
  const n = GRAPH.nodes[nodeId];
  const opts = n.edges.filter((id) => id !== fromEdgeId);
  const pool = opts.length ? opts : n.edges;
  return GRAPH.edges[pool[Math.floor(rng() * pool.length)]];
}

// A random sidewalk point near (x, z): beside a road, offset 6.5 m.
export function randomSidewalkPoint(rng, nearX, nearZ, radius) {
  for (let tries = 0; tries < 12; tries++) {
    const e = randomEdge(rng);
    const t = rng();
    const side = rng() < 0.5 ? 1 : -1;
    const p = lanePoint(e, t, side);
    const ox = -e.dz * 6.5 * side;
    const oz = e.dx * 6.5 * side;
    const x = p.x + ox;
    const z = p.z + oz;
    if (!isLand(x, z)) continue;
    if (Math.hypot(x - nearX, z - nearZ) > radius) continue;
    return { x, z };
  }
  return { x: nearX + 10, z: nearZ };
}
