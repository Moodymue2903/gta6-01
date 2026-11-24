// Spotlight acceptance test — loads the REAL progression.js bytes
// via vm.SourceTextModule (see tests/ghost-plates.test.mjs for why).
// Run: node --experimental-vm-modules tests/spotlight.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = readFileSync(join(root, 'game/src/systems/progression.js'), 'utf8');
const mod = new vm.SourceTextModule(code, { identifier: 'progression.js' });
await mod.link(() => { throw new Error('progression.js must have no imports'); });
await mod.evaluate();
const { Progression, SPOTLIGHT_SECONDS } = mod.namespace;

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.log('FAIL: ' + msg); }
}

function makeGame() {
  return {
    time: 100,
    police: { heat: 0, stars: 0 },
    hud: { banner: () => {}, showDialogue: () => {} },
    audio: { blip: () => {} },
    activities: { recordCrewUse: () => {} },
    player: { inCar: null, heal: () => {} },
  };
}

// Brief acceptance test, adapted to the real identifiers:
// useCrew('kiki') activates; isPoliceMarked() is a global timestamp,
// so every current AND newly spawned unit is marked.
function testSpotlightMarksEveryPoliceUnit() {
  const game = makeGame();
  const prog = new Progression(game);
  assert(SPOTLIGHT_SECONDS === 20, 'SPOTLIGHT_SECONDS should be 20, got ' + SPOTLIGHT_SECONDS);

  game.time = 100;
  prog.spotlightUntil = 0;
  const police = [{ id: 1 }, { id: 2 }, { id: 3 }]; // 3 units

  const ok = prog.useCrew('kiki');
  assert(ok === true, 'useCrew(kiki) should succeed when ready');
  assert(prog.spotlightUntil === 120, 'Spotlight window wrong: ' + prog.spotlightUntil);
  assert(prog.revealUntil === 120, 'revealUntil not kept in sync: ' + prog.revealUntil);
  for (const p of police) assert(prog.isPoliceMarked(p), 'Police unit not marked at activation');
  assert(prog.spotlightSecondsLeft() === 20, 'secondsLeft should be 20 at activation');

  // A unit spawned mid-window is marked too (global timestamp).
  police.push({ id: 4 });
  assert(prog.isPoliceMarked(police[3]), 'Newly spawned unit not marked');

  game.time = 119.9;
  for (const p of police) assert(prog.isPoliceMarked(p), 'Mark expired early at 19.9s');
  assert(prog.spotlightSecondsLeft() === 1, 'secondsLeft should be 1 at 19.9s, got ' + prog.spotlightSecondsLeft());

  game.time = 120.1;
  for (const p of police) assert(!prog.isPoliceMarked(p), 'Mark did not expire at 20.1s');
  assert(prog.spotlightSecondsLeft() === 0, 'secondsLeft should be 0 after expiry');

  // Cooldown: the crew cooldown (90 s) blocks an immediate re-use.
  game.time = 120.1;
  assert(prog.useCrew('kiki') === false, 'Spotlight re-use inside crew cooldown should fail');
}

testSpotlightMarksEveryPoliceUnit();

// Static wiring check (not a render test): the live HUD path must
// actually consume the marking state — viewModel exposes it, the
// baked minimap draws ring+chevron from it, hudV3 shows the timer
// and projects world diamonds from it.
{
  const vmSrc = readFileSync(join(root, 'game/src/ui/viewModel.js'), 'utf8');
  const bakedSrc = readFileSync(join(root, 'game/src/ui/minimapBaked.js'), 'utf8');
  const hudSrc = readFileSync(join(root, 'game/src/ui/hudV3.js'), 'utf8');
  assert(vmSrc.includes('spotlight: prog.isPoliceMarked()'), 'viewModel: minimap.spotlight missing');
  assert(vmSrc.includes('secondsLeft: prog.spotlightSecondsLeft()'), 'viewModel: spotlight.secondsLeft missing');
  assert(bakedSrc.includes('mm.spotlight'), 'minimapBaked: mm.spotlight not read');
  assert(bakedSrc.includes("#ffd23f"), 'minimapBaked: gold ring colour missing');
  assert(hudSrc.includes("SPOTLIGHT ' + vm.spotlight.secondsLeft + 's'"), 'hudV3: SPOTLIGHT timer text missing');
  assert(hudSrc.includes('renderSpotlightMarkers'), 'hudV3: world markers not wired');
  // Base blips stay visible: the police fillRect must NOT be gated
  // on spotlight in either minimap.
  assert(bakedSrc.includes("ctx.fillRect(x - 4, y - 4, 8, 8)"), 'minimapBaked: base police blip missing');
  assert(!/if \(mm\.spotlight\) \{\s*ctx\.fillStyle = '#ff3a3a'/.test(bakedSrc), 'base blip must not be gated on spotlight');
}

console.log(failures === 0
  ? 'testSpotlightMarksEveryPoliceUnit: PASS (3 units marked at activation; still marked at 19.9s; none at 20.1s; HUD wiring present; base blips ungated)'
  : `testSpotlightMarksEveryPoliceUnit: ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
