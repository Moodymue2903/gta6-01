// VERMILION KEYS — identity layer (cityLayout): the settled Fix Round 5
// identity. Mediterranean-Caribbean limestone and terracotta archipelago.
// Currency: Verms (V$). Eight named districts. Vehicle display names.
// Every string the HUD, the career map and the street ribbon show comes
// from this data — never typed into a DOM template.

export const CURRENCY = 'V$';

export const DISTRICTS = [
  { id: 'ochre', name: 'Ochre Causeway', x0: 200, z0: -30, x1: 260, z1: 30, tint: '#d96b43', map: '#d96b43', lx: 230, lz: 18 },
  { id: 'bazaar', name: 'Bazaar Quay', x0: -70, z0: 100, x1: 230, z1: 160, tint: '#e89f65', map: '#e89f65', lx: 170, lz: 148 },
  { id: 'coral', name: 'Coral Marina', x0: -70, z0: -160, x1: 230, z1: -100, tint: '#1995ad', map: '#1995ad', lx: 80, lz: -130 },
  { id: 'caldera', name: 'Caldera Docks', x0: 250, z0: -210, x1: 490, z1: -100, tint: '#0d5c75', map: '#0d5c75', lx: 370, lz: -155 },
  { id: 'miramar', name: 'Miramar Strip', x0: -70, z0: -100, x1: 230, z1: 100, tint: '#f2e6d8', map: '#c8b898', lx: 80, lz: -18 }, // label staggered above the line: ochre sits at lz +18, so the two never share a baseline (they touched at lz 0)
  { id: 'limestone', name: 'Limestone Heights', x0: -460, z0: -190, x1: -90, z1: 0, tint: '#e8dcc8', map: '#b8a888', lx: -275, lz: -95 },
  { id: 'saffron', name: 'Saffron Pier', x0: -460, z0: 0, x1: -90, z1: 190, tint: '#ffb703', map: '#c89858', lx: -275, lz: 95 },
  { id: 'westyard', name: 'Key Westyard', x0: 250, z0: -100, x1: 490, z1: 210, tint: '#ff3366', map: '#a85878', lx: 370, lz: 55 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  }
  // Open water / causeway mouths: nearest district centre wins.
  let best = DISTRICTS[4];
  let bestD = Infinity;
  for (const d of DISTRICTS) {
    const cx = (d.x0 + d.x1) / 2;
    const cz = (d.z0 + d.z1) / 2;
    const dd = (x - cx) * (x - cx) + (z - cz) * (z - cz);
    if (dd < bestD) {
      bestD = dd;
      best = d;
    }
  }
  return best;
}

export function districtNameAt(x, z) {
  return districtAt(x, z).name;
}

// Display names for the vehicle classes — the names the speed box and
// the garage show. The internal class names stay as they were.
export const VEHICLE_DISPLAY_NAMES = {
  sports: 'Vermilion GT',
  muscle: 'Ochre Runner',
  van: 'Bazaar Van',
  bike: 'Key Hopper',
  sedan: 'Sedan',
  compact: 'Pinto',
};

export function vehicleDisplayName(cls) {
  return VEHICLE_DISPLAY_NAMES[cls] || cls;
}

// Police display names.
export const POLICE_NAME = 'VKPD';
export const HELI_NAME = 'Valkyrie Air-1';

// Map islands for the minimap / career map, in world coordinates.
export const MAP_ISLANDS = [
  { x0: -460, z0: -190, x1: -90, z1: 190, color: '#b8a888' },
  { x0: -70, z0: -160, x1: 230, z1: 160, color: '#d8c090' },
  { x0: 250, z0: -210, x1: 490, z1: 210, color: '#a89880' },
];

// Island rects as plain arrays, for files that must stay free of
// numeric property names: [x0, z0, x1, z1, color].
export function islandRects() {
  return MAP_ISLANDS.map((i) => [i.x0, i.z0, i.x1, i.z1, i.color]);
}

// District rects as plain arrays: [id, name, x0, z0, x1, z1, tint].
export function districtRects() {
  // [id, name, x0, z0, x1, z1, tint, labelX, labelZ] — the label sits
  // at (lx, lz), not the rect centre: Bazaar Quay's centre (80,130)
  // sits on the SAFEHOUSE/GARAGE markers, so its label moves east.
  return DISTRICTS.map((d) => [d.id, d.name, d.x0, d.z0, d.x1, d.z1, d.tint, d.lx, d.lz]);
}

// Map markers for the career map: safehouse and garage.
export const MAP_MARKERS = [
  { x: 60, z: 138, label: 'SAFEHOUSE', color: '#ffc27a', dy: -9 },
  { x: 52, z: 128, label: 'GARAGE', color: '#38bdf8', dy: 17 },
];
