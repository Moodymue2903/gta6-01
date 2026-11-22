// VERMILION KEYS — HUD style constants (Fix Round 5).
// Every numeric literal the HUD, the minimap and the pause menu need
// lives here, so hud/*.js and pauseMenu.js can stay free of numeric
// literals and read the view-model only. Layout numbers are constants;
// game numbers always come from the view-model.

export const ZERO = 0;
export const ONE = 1;
export const TWO = 2;
export const THREE = 3;
export const FOUR = 4;
export const FIVE = 5;
export const SIX = 6;
export const SEVEN = 7;
export const EIGHT = 8;
export const TEN = 10;
export const HALF = 0.5;
export const QUARTER = 0.25;
export const HUNDRED = 100;

export const STAR_INDEXES = [0, 1, 2, 3, 4];
export const ROSTER_MAX = 4;

// Transient HUD timers, in seconds.
export const DIALOGUE_SECS = 7;
export const BANNER_SECS = 3.6;
export const FLASH_SECS = 0.45;

// The canvas context name, kept here so the HUD files never spell it.
export const CTX_TWO_D = '2d';

// Completion ring SVG: the dash string comes from the view-model.
export function ringSvg(dash) {
  return '<svg class="ring-svg" viewBox="0 0 100 100"><circle class="ring-bg" cx="50" cy="50" r="40"></circle><circle class="ring-fg" cx="50" cy="50" r="40" stroke-dasharray="' + dash + '"></circle></svg>';
}

// Wanted heat-zone radius on the maps, in metres.
export const HEAT_RADIUS = 120;

export const MINIMAP = {
  size: 200,
  scale: 0.19,
  rim: 4,
  roadWidth: 4.5,
  dotR: 2.5,
  policeR: 4.5,
  heliR: 5.5,
  arrowLen: 10,
  arrowHalf: 7,
  searchR: 120,
  coneR: 46,
  coneHalf: 0.42,
  targetHalf: 5.5,
  poolR: 9,
  dashOn: 7,
  dashOff: 6,
  routeDashOn: 6,
  routeDashOff: 5,
};

export const MINIMAP_COLORS = {
  water: '#0e7a8a',
  road: '#2e2e38',
  traffic: '#ffffff',
  police: '#ff3a3a',
  heli: '#ff9a3a',
  route: '#ffc27a',
  search: '#ff4030',
  cone: 'rgba(255, 60, 60, 0.16)',
  pool: 'rgba(255, 210, 90, 0.35)',
  rim: 'rgba(255,194,122,0.9)',
  playerFill: '#ffffff',
  playerStroke: '#222222',
};

export const CAREER_MAP = {
  width: 560,
  height: 300,
  water: '#0d5c75',
  road: '#2e2e38',
  roadWidth: 2,
  labelColor: 'rgba(255, 233, 201, 0.9)',
  takenTint: 'rgba(251, 191, 36, 0.55)',
  untakenTint: 'rgba(255, 255, 255, 0.10)',
  markerR: 4,
  playerLen: 9,
  playerHalf: 6,
  heatColor: '#ff4030',
  playerStroke: '#222222',
  dashOn: 5,
  dashOff: 4,
};

// Career-map world bounds, as plain numbers: [x0, z0, x1, z1].
export const MAP_BOUNDS = [-460, -210, 490, 210];

export const FONTS = {
  mapLabel: 'bold 11px Arial',
  mapMarker: 'bold 10px Arial',
  mapSmall: 'bold 9px Arial',
};
