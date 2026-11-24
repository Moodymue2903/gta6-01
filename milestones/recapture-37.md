# Recapture 37 — Tidal Gate candidate (recording 37)

Recording 37 ID: `01a20c51-a869-751b-b384-cc5709c3afef`
Commit: `f440c0f4` (remote main matches)
Base: `653eafa8` (recapture 34)

## What this is
The Tidal Gate candidate. Codex's harbor upgrade patch (timber walkway, waterside
railing, balconies + shutters, three civilians moved onto the timber landing).
The cover passed Codex's gate under recording 36 (three civilians recognizable
at 620 px, feet on timber boards, cruiser clear, waterline behind the fence).
This recording captures the full four-frame sheet for a blind comparison vs #1
Karimbu. The fixed blind-test sheet (653eafa8 / judge view cde73f65, for re-test
14 at 14:30 IST) is NOT touched — this candidate gets its own judge view.

## Code
- `game/src/shots.js` + `game/src/world/city.js`: 70 insertions / 41 deletions,
  content-identical to Codex's tidal-gate.patch (verified by git diff).
  `node --check` passes on both.

## Frames (all 1280x720, <=256 KiB)
| Frame | md5 | Size | Note |
|---|---|---|---|
| 1-cover.jpg | `6e9999bf23763b4c3e43e9d57a04ccae` | 217,950 B | CHANGED (Tidal Gate). 7/7 burst identical. Differs from rec-36 cover (d1731c6f, 218,343 B) by 393 B render shimmer; content verified identical by reading. |
| 2-combat.jpg | `488c9754a7a5eaaca775602fed9ba5eb` | 187,672 B | 7/7 identical. Shimmer vs 653eafa8 (74958c39, 187,979 B); content verified. 3/6 DOWN. |
| 3-career.jpg | `a179638eb37abdb92a59bfba2a0d7ec6` | 166,590 B | BYTE-IDENTICAL to 653eafa8. |
| 4-title.jpg | `7fb67369a6b7ec84f467792a9b0d5bf6` | 131,384 B | Burst index 3 (same as recaptures 32/34). Shimmer vs 653eafa8 (173419ba, 130,368 B); content verified. |

Cover values hold: 17:59, V$13,850, respect 740, 74.5%, 10 units, 5 stars.
Combat: 3/6 DOWN (known staging variance). No page errors in any burst log.

## Judge view (NEW files — fixed sheet untouched)
- `milestones/judgeview-tidal-gate.jpg`: md5 `0a10c085c6cb64c20c8b12e6b4b29aab`, 138,777 B, 768x594.
- `milestones/cover-tidal-gate-620.jpg`: md5 `6c3380245e0bfe8f1580c4fd429ea36b`, 70,654 B, 620x349.
  (Overwrites the recording-36 620 px cover 03092352 with the burst cover.)
- Fixed sheet intact: `milestones/judgeview-depth.jpg` still `cde73f65`,
  `milestones/cover-depth-620.jpg` still `c52ac857`.

## Thumbnail verdict — ALL PASS
- NEXT readable (cover two lines, combat one); crew Zia/Lo/Kiki + Ghost plates /
  Pit stop / Spotlight legible; condition reads (SCUFFED 93% cover / 82% combat);
  no HUD overlap; cover rear three-quarter; title kicker
  "MAKE.FUN · OPEN-WORLD BOUNTY" (no "GTA 6"); wheel hint on two lines in the
  136px ring; 4 real slots + Kiki dialogue.
- Three civilians recognizable at 620 px on the timber landing (green shirt +
  red cap, dark clothing, blue shirt + red cap, ~30-35 px tall), white shoes on
  the brown timber planks, feet on the boards, NOT on water/floating/cut off.
- Cruiser recognizable (white/black, light bar; second cruiser + yellow taxi
  also visible). Waterline recognizable (green/teal water behind the black
  two-rail fence, timber deck between fence and road, nobody on the water).
- Timber landing reads as a harbour boardwalk (planks + railing + brass curb +
  water); facade relief visible (cream bands, iron shutters).
- Heli clears the roofline (partially at the top edge, same as recording 36).
  Pre-existing observations (NOT new defects): heli silhouette overlaps the
  wanted stars; crew panel still obscures part of the Tidal Gate sign.
- No new defect: no civilian overlaps the car/HUD/Tidal Gate sign; landing
  clips through nothing; no figure floats.

## Blind comparison vs #1 Karimbu
Four fresh chats (Gemini + Claude ours-first, DeepSeek + ChatGPT #1-first),
gate 3/4, watch C1. Verdicts recorded in
~/workspace/makefun/judge-decisions/gta6-01.jsonl and
~/workspace/makefun/gta6-01/retest-tally.md. See Issue #1 for the result.
