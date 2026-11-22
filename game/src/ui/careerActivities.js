// VERMILION KEYS — career activity groups (Fix Round 7).
// The nine real activity tracks from the registry, grouped into four
// bold groups for the career screen. Every row is the live registry
// row (name, label, frac) — no counters are typed here. The act title
// is derived from the live missions-done count, so it always matches
// the story position the save is actually in.
//
// Mapping (from activityRegistry.js track ids):
//   Story       — jobs (mission completion), medals (gold job medals)
//   Street      — races, stunts
//   Exploration — contraband (smuggler collectibles), exports (cargo)
//   Empire      — takeovers (district reputation), respect (syndicate
//                 standing), loyalty (crew uses)
// There is no ninth-track garage counter in the registry: garage
// progression is the upgrades themselves, shown on the garage screen.

const GROUPS = [
  { id: 'story', title: 'STORY', ids: ['jobs', 'medals'] },
  { id: 'street', title: 'STREET', ids: ['races', 'stunts'] },
  { id: 'exploration', title: 'EXPLORATION', ids: ['contraband', 'exports'] },
  { id: 'empire', title: 'EMPIRE', ids: ['takeovers', 'respect', 'loyalty'] },
];

// Act boundaries follow the eight jobs: jobs 1-2 open the story,
// 3-5 build the crew, 6-7 raise the stakes, 8 closes it.
export function actTitleFor(missionsDone) {
  if (missionsDone >= 8) return 'EPILOGUE · KINGPIN OF THE KEYS';
  if (missionsDone >= 6) return 'ACT III · KINGPIN RISING';
  if (missionsDone >= 3) return 'ACT II · THE CREW';
  return 'ACT I · THE RUNNER';
}

export function careerGroups(game, vm) {
  const rows = vm?.career?.activities ?? game?.activities?.rows?.() ?? [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const groups = GROUPS.map((g) => ({
    id: g.id,
    title: g.title,
    rows: g.ids
      .filter((id) => byId.has(id))
      .map((id) => {
        const r = byId.get(id);
        return { name: r.name, label: r.label, frac: r.frac };
      }),
  }));
  const done = game?.progression?.missionsDone?.size
    ?? byId.get('jobs')?.value
    ?? 0;
  return { groups, actTitle: actTitleFor(done) };
}
