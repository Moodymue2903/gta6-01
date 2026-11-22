// VERMILION KEYS — radio (FIX ROUND 7).
// The track list behind the three EXISTING synthesized stations in
// audio.js. Station names come from audio.js and are never renamed
// here — the plan draft's invented names (Island Pop, CHANNEL ZERO,
// DOCKSIDE FM) do not exist in the game. This module only observes
// game.audio.station / game.audio.radioOn and tracks which original
// track is playing: the current track advances every 40 s of radio-on
// time, or when the station changes. The pill() readout is what the
// HUD renders, so the display always matches the station actually
// selected. No edits to audio.js; the synthesized loop behind each
// station is already real.

const TRACK_SECONDS = 40;

// Three original track titles per station, genre-consistent with the
// station's show (audio.js): Sunset FM = island pop, Bassline =
// underground bass, Cumbia Keys = cumbia. Titles are kept short
// (<= 13 chars) so the radio pill ("VERMILION 98.1 — Sunset FM —
// <track>") fits its 320 px width without truncating the track.
const TRACKS = [
  [
    'Golden Hour',
    'Salt Air',
    'Trade Wind',
  ],
  [
    'Copper Dub',
    'Submerged',
    'Night Ferry',
  ],
  [
    'Del Puerto',
    'Llave de Oro',
    'Baile',
  ],
];

export class Radio {
  constructor(game) {
    this.game = game;
    // Per-station track index, so returning to a station resumes
    // where that station left off instead of restarting its list.
    this._trackIndex = TRACKS.map(() => 0);
    this._elapsed = 0; // seconds of radio-on time on the current track
    this._seenStation = game.audio ? game.audio.station : 0;
    this._seenOn = game.audio ? game.audio.radioOn : false;
  }

  _stationCount() {
    return TRACKS.length;
  }

  // The track title currently playing on the observed station.
  trackTitle() {
    const st = this._seenStation;
    return TRACKS[st][this._trackIndex[st]];
  }

  trackIndex() {
    return this._trackIndex[this._seenStation];
  }

  // The pill the HUD renders: on/off, the real station name from
  // audio.js, and the current track title.
  pill() {
    const audio = this.game.audio;
    return {
      on: !!audio.radioOn,
      station: audio.stationName,
      track: this.trackTitle(),
    };
  }

  update(dt) {
    const audio = this.game.audio;
    if (!audio) return;
    // Station change: the new station moves to its next track and the
    // 40 s clock restarts.
    if (audio.station !== this._seenStation) {
      this._seenStation = audio.station;
      this._trackIndex[this._seenStation] = (this._trackIndex[this._seenStation] + 1) % TRACKS[this._seenStation].length;
      this._elapsed = 0;
    }
    this._seenOn = audio.radioOn;
    if (!audio.radioOn) return;
    // Track advances every 40 s of radio-on time.
    this._elapsed += dt;
    if (this._elapsed >= TRACK_SECONDS) {
      this._elapsed -= TRACK_SECONDS;
      this._trackIndex[this._seenStation] = (this._trackIndex[this._seenStation] + 1) % TRACKS[this._seenStation].length;
    }
  }
}
