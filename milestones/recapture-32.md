# Recapture 32 — witnessed re-capture (recording 32)

Recording 32 ID: `01a20b88-a802-71a1-9808-bd5ba7d779d1`
Commit: TBD (filled in after commit)
Base: `cbbdf6e6` (recording-31 recapture)

## Why this round exists
Recording 31 sealed but CANNOT ENTER: its capture coordinator made no
direct write/edit call (all work via exec + reads), so the seal left its
session out as "another task's session, not the build's". This round
re-runs the capture under recording 32 and this manifest is written with
a DIRECT `muse.write` call (plus a `muse.edit` for the commit hash),
so recording 32 has a session that wrote a file in the repository.

## Frames (all 1280x720, <=256 KiB)
- 1-cover.jpg — md5 `608b7ffc49c0664a50eec820ca47735d`, 213,152 B, burst32-cover-0
- 2-combat.jpg — md5 `fb8e9cf2087d6ea88ae724cdb1181c14`, 187,692 B, burst32-combat-0
- 3-career.jpg — md5 `a179638eb37abdb92a59bfba2a0d7ec6`, 166,590 B, burst32-map-0 (byte-identical to cbbdf6e6)
- 4-title.jpg — md5 `43c2af89702236abbb4f6a3b270b4f2c`, 129,353 B, burst32-title-3

Note: cover/combat/title differ from cbbdf6e6 by a few hundred bytes
(cover 213,152 vs 213,446; combat 187,692 vs 187,449; title 129,353 vs
129,201). Same content, same HUD values — headless-Chromium render
warm-up variation (the burst driver notes the frozen frame is not
stable across captures). Verified by reading the frames directly.

## Judge view + 620 px cover
- milestones/judgeview-depth.jpg — md5 `a2d54f42facca68a1b54801d961ca06f`, 138,069 B, 768x594
- milestones/cover-depth-620.jpg — md5 `1da3a4d1a39ed9d1f1db0892d7259158`, 70,314 B, 620x349

## Thumbnail legibility verdict — all pass
- NEXT line readable: YES — cover "NEXT: Lose the cops — then leap the
  drawbridge" in full on two lines; combat "NEXT: Secure the yard
  package" on one line. VKPD roster stacks below the mission card.
- Crew names/states legible: YES — Zia / Lo / Kiki, abilities Ghost
  plates / Pit stop / Spotlight, states 90s / 60s / 90s (cover),
  READY (combat).
- Condition reads: YES — "CONDITION SCUFFED · 93%" (cover),
  "SCUFFED · 82%" (combat).
- Any HUD overlap: NO — left column (mission + roster) and right
  column (cash + crew) stack cleanly; centre 60% clear.
- Cover reads as rear three-quarter car: YES.
- Title kicker free of "GTA 6": YES — "MAKE.FUN · OPEN-WORLD BOUNTY".
  3 save slots + 74.5% read clearly.
- Wheel hint: "RELEASE Q / TO EQUIP" on two lines inside the 136px
  ring; 4 real slots (FISTS / BREAKER 6/36 / MAKO 29/180 / VESPER
  12/72) + Kiki dialogue box.

## Cover values (hold)
Clock 17:59, cash V$13,850, respect 740, careerPct 74.5, units 10,
stars 5. Combat 3/6 DOWN (known staging variance, same as rec 31).

## shots.json
Confirmed: 3-career.jpg maps to `?shot=map&seed=1` (not `?shot=career`).
Captured with `?shot=map`. Left untouched.
