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

// The drawbridge span on the east causeway: a ramp cars can launch off.
// x 232..240 climbs 0 -> 5 m, x 240..244 is open water (the gap), x >= 244
// is flat road again. When the bridge is DOWN the whole span is flat.
export const DRAWBRIDGE = { x0: 232, x1: 244, lipX: 240, height: 5, z0: -7, z1: 7 };

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

// Ground height: 0 everywhere except the drawbridge ramp when raised.
export function groundHeightAt(x, z, bridgeUp) {
  if (!bridgeUp) return 0;
  if (z < DRAWBRIDGE.z0 || z > DRAWBRIDGE.z1) return 0;
  if (x >= DRAWBRIDGE.x0 && x < DRAWBRIDGE.lipX) {
    return ((x - DRAWBRIDGE.x0) / (DRAWBRIDGE.lipX - DRAWBRIDGE.x0)) * DRAWBRIDGE.height;
  }
  if (x >= DRAWBRIDGE.lipX && x < DRAWBRIDGE.x1) return -999; // the gap: no ground
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
