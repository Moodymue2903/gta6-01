// Ghost plates test — loads the REAL progression.js bytes via
// vm.SourceTextModule (the repo has no package.json, so a plain
// node import would treat the .js file as CommonJS and fail on
// `export`). Run: node --experimental-vm-modules tests/ghost-plates.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = readFileSync(join(root, 'game/src/systems/progression.js'), 'utf8');
const mod = new vm.SourceTextModule(code, { identifier: 'progression.js' });
await mod.link(() => { throw new Error('progression.js must have no imports'); });
await mod.evaluate();
const { Progression, wantedStars } = mod.namespace;

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.log('FAIL: ' + msg); }
}

// Monotonicity of wantedStars over the whole heat range.
for (let h = 0; h < 100; h++) {
  assert(wantedStars(h) <= wantedStars(h + 1), `wantedStars not monotonic at ${h}`);
}

function makeGame(heat) {
  return {
    time: 100,
    police: { heat, stars: wantedStars(heat) },
    hud: { banner: () => {}, showDialogue: () => {} },
    audio: { blip: () => {} },
    activities: { recordCrewUse: () => {} },
    player: { inCar: null, heal: () => {} },
  };
}

export function testGhostPlatesExactlyOneStar() {
  for (let heat = 0; heat <= 100; heat++) {
    const game = makeGame(heat);
    const prog = new Progression(game);
    const before = wantedStars(game.police.heat);
    prog.shedExactlyOneWantedStar();
    const after = wantedStars(game.police.heat);
    assert(
      after === Math.max(0, before - 1),
      `heat ${heat}: expected ${Math.max(0, before - 1)} stars, got ${after}`,
    );
    assert(game.police.stars === after, `heat ${heat}: police.stars ${game.police.stars} != wantedStars ${after}`);
  }
}

testGhostPlatesExactlyOneStar();

// useGhostPlates toast paths.
{
  const game = makeGame(0);
  const prog = new Progression(game);
  let banner = null;
  game.hud.banner = (t) => { banner = t; };
  assert(prog.useGhostPlates() === false, 'useGhostPlates at 0 heat should return false');
  assert(banner === 'NO WANTED LEVEL TO SHED', '0-heat banner wrong: ' + banner);
  game.police.heat = 41; game.police.stars = wantedStars(41);
  assert(prog.useGhostPlates() === true, 'useGhostPlates at 41 heat should return true');
  assert(banner === 'GHOST PLATES · -1 STAR', 'shed banner wrong: ' + banner);
  assert(wantedStars(game.police.heat) === 2, 'heat 41 should shed to 2 stars, got ' + wantedStars(game.police.heat));
}

console.log(failures === 0
  ? 'testGhostPlatesExactlyOneStar: PASS (heat 0-100, every value sheds exactly one star; monotonicity holds)'
  : `testGhostPlatesExactlyOneStar: ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
