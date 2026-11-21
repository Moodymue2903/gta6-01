# VERMILION KEYS — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Moodymue2903/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Moodymue2903/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Entered on [make.fun](https://make.fun/bounty/gta6-01) — the "Make GTA 6" bounty, $1,666 in USDC.

**make.fun gta6-01.** An invented chain of causeway-linked islands at long
golden hour — downtown towers, a beach boardwalk, a container port, a hillside
old town. You are a returning local working off a debt to a syndicate, from
bagman to kingpin. Steal cars, outrun the Vermilion Keys Police Department,
run eight story missions, and leap the rising drawbridge with a helicopter
searchlight on your tail.

## The verb: LEAP

- **WASD** drive / walk, **Shift** sprint, **Space** jump / handbrake,
  **E** enter, steal or exit a vehicle, **F** carjack, **Q** weapon wheel,
  **1–4** weapons, **R** reload, **Z/X/C** crew perks, **M** radio, **Esc** pause.
- **On foot:** third-person character — sprint, jump, fight, steal any car.
- **Driving:** six vehicle classes, arcade physics, handbrake drift, damage
  with smoke and fire, carjacking on any traffic car.
- **Wanted:** five stars, driven by crime heat. Patrol cars chase and ram,
  roadblocks and spike strips at 3 stars, SWAT vans at 4, a helicopter with a
  searchlight cone at 5. Break line of sight to cool down.
- **Missions:** eight story jobs — chase, escape, fetch, defend, race,
  heist, assassination, final assault — with staged objectives, dialogue,
  fail states and rewards.
- **Crew:** Mira (driver, swap plates), Lo (mechanic, quick fix), Kiki
  (lookout, reveal police) — each on a cooldown.
- **Progression:** cash, respect ranks 1–8, garage, safehouse, saves.

## Play it

Serve `game/` with any static server and open `index.html` in desktop
Chrome (no network needed — everything is vendored under `game/`):

```sh
node serve.ts
# open http://localhost:8080
```

Screenshot staging: `?shot=cover|foot|police|mission&seed=1` composes a
deterministic frame for each of the four screenshots in `shots.json`.

## Structure

One job per file, named for what it does:

- `game/src/boot.js` — renderer, fixed-60 Hz loop, game wiring
- `game/src/world/` — city layout, road graph, lighting
- `game/src/entities/` — player, vehicles, traffic, pedestrians, police
- `game/src/systems/` — missions, combat, progression, audio
- `game/src/ui/` — HUD, minimap, menus
- `game/src/shots.js` — deterministic screenshot staging

`main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to
`/output` and writes `/output/dossier.json` with the kit's dossier library.
