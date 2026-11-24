# Recapture 34 — witnessed re-capture (recording 34)

Recording 34 ID: `01a20c13-e32d-7663-93a2-2efa799a9e47`
Commit: `1d9a6b6645be8e063b1d07dba4bb50b3dadcc8c0` (remote main matches)
Base: `32b039ec` (recapture 32)

## Why a new recording
Recording 33 died unsealed in a runtime restart (~11:08–11:11 IST) while
its final re-capture was running. Its sessions are permanently lost, but
the two cover fixes survived in the worktree, uncommitted. This
recording re-authors those fixes fresh (revert to HEAD 32b039ec, re-apply
via DIRECT muse.edit, diff verified IDENTICAL to the recording-33 diff:
3 files, 68 insertions / 19 deletions, node --check passes on all three).

## The two fixes (user, 2026-11-24 10:11 + 10:24 IST)
1. HELI ON THE BUILDING: the 32b039ec cover frame reads the police
   helicopter as STANDING ON the tall building's roofline — at 18 m up
   it sits at about roof height, and from the +30° cover camera it
   projects onto the building with no sky gap. Fix (shots.js cover
   branch): heli `(runCar.pos.x - 26, 18, runCar.pos.z + 20)` →
   `(runCar.pos.x - 28, 23, runCar.pos.z + 22)`. 23 m is final: 32 m
   put it out of frame, 25 m clipped the rotor at the top edge.
2. MEN WALKING ON WATER: the 32b039ec cover frame reads the extra cover
   NPCs as standing on the teal water at the frame's left edge (they
   stood on island 2, x 210–230, with the water channel x 230–250
   between them and the camera). Fix: ALL cover pedestrians moved to
   island 3 tan land, no water between them and the camera —
   shots.js (8 NPCs) x 250–258, z 6–8; populationDirector.js
   stageCoverCrowd (8) x 250–267, south z 7–8, north z −9 to −11;
   density_spawner.js stageCoverDensity (16) south x 250–257, z 6–8,
   north x 250–267.5, z −9 to −13. Cover branch only.

## Frames (all 1280×720, ≤256 KiB)
- 1-cover.jpg: md5 `dc3227e066b98f7cbcd97dae85829bae`, 206,316 B — CHANGED (fixes)
- 2-combat.jpg: md5 `74958c391a45fd448798097bcb5e1e1f`, 187,979 B — differs by render shimmer, same content
- 3-career.jpg: md5 `a179638eb37abdb92a59bfba2a0d7ec6`, 166,590 B — BYTE-IDENTICAL
- 4-title.jpg: md5 `173419bafd01133f530bcc5eb7c3d07b`, 130,368 B — differs by render shimmer, same content

Burst: 7/7 identical per shot for cover, combat, map; title 7 distinct
(shimmer), packaged index 3 (same index as recapture 32). No page errors.
Cover values hold: clock 17:59, cash V$13,850, respect 740, careerPct
74.5, units 10, stars 5. Combat 3/6 DOWN (known staging variance).

## Judge view + 620 px cover
- milestones/judgeview-depth.jpg: md5 `cde73f657d47b51d696f1736a4d6f65a`, 134,970 B, 768×594
- milestones/cover-depth-620.jpg: md5 `c52ac857415e07616c3844d3a8be2f76`, 68,141 B, 620×349

## Thumbnail legibility verdict — all pass
- NEXT line readable: cover "NEXT: Lose the cops — then leap the drawbridge" in full on two lines; combat "NEXT: Secure the yard package" on one line.
- Crew names/states legible: Zia / Lo / Kiki bold and readable, new abilities (Ghost plates, Pit stop, Spotlight), states 90s / 60s / 90s (cover), READY (combat).
- Condition reads: "CONDITION SCUFFED · 93%" (cover), "SCUFFED · 82%" (combat).
- Any HUD overlap: No — left column (mission + roster) and right column (cash + crew) stack cleanly; centre 60% stays clear.
- Cover reads as a rear three-quarter car: Yes — red/orange sports car, rear three-quarter, grounded.
- Title kicker free of "GTA 6": Yes — reads "MAKE.FUN · OPEN-WORLD BOUNTY". 3 save slots + 74.5% read clearly.
- Wheel hint: "RELEASE Q / TO EQUIP" on two lines inside the 136px ring; 4 real slots (FISTS / BREAKER 6/36 / MAKO 29/180 / VESPER 12/72) plus Kiki's dialogue box.
- HELI FIX: Yes — the helicopter is fully visible at the top of the cover frame (body, tail, rotor, skids, searchlight cone), in open sky ABOVE the building's roofline with a clear band of sky between it and the roof. It does NOT read as standing on the building.
- WATER FIX: Yes — the green/teal surface on the left is EMPTY of pedestrians; every visible pedestrian stands on tan ground. Nobody is on the water.
- PEDESTRIAN VISIBILITY (noted, not fixed): 0 pedestrians are clearly visible in the new cover frame. The moved south pedestrians (x 250–258, z 6–8) fall out of frame to the left, too close to the camera's south edge, so the left side reads sparser than the 32b039ec frame (which had ~8 peds on the green/teal surface). The user will judge the frame; no further iteration was spent on this per the brief.
