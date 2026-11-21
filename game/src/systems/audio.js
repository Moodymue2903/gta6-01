// VERMILION KEYS — audio: everything synthesized with WebAudio.
// Engine hum, sirens, gunfire and three procedural radio stations —
// no audio files, no network. Audio starts on the first user gesture.

const STATIONS = [
  { name: 'VERMILION 98.1', show: 'Sunset FM', bpm: 96, root: 220, scale: [0, 3, 5, 7, 10], wave: 'triangle' },
  { name: 'KEYS 101.5', show: 'Bassline', bpm: 112, root: 164.8, scale: [0, 3, 5, 6, 10], wave: 'sawtooth' },
  { name: 'ISLA 104.3', show: 'Cumbia Keys', bpm: 128, root: 196, scale: [0, 2, 4, 7, 9], wave: 'square' },
];

export class AudioSys {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.station = 0;
    this.radioOn = false;
    this.muted = false;
    this._step = 0;
    this._nextStepTime = 0;
    this._noiseBuf = null;
  }

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // Engine: detuned saws through a lowpass.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 700;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Siren: two-tone square, gain kept at 0 until police are near.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenOsc.frequency.value = 750;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      // Noise buffer for gunfire / crashes.
      const len = this.ctx.sampleRate * 0.5;
      this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch (e) {
      this.ctx = null;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  setRadio(i) {
    this.station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
    this._step = 0;
  }

  toggleRadio() {
    this.radioOn = !this.radioOn;
    return this.radioOn;
  }

  get stationName() {
    return STATIONS[this.station].name + ' — ' + STATIONS[this.station].show;
  }

  blip(kind) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const freqs = { mission: [660, 880], pass: [523, 659, 784], fail: [220, 160], gate: [880], crew: [740, 990], rank: [523, 659, 784, 1046], heli: [440, 440], crash: [90], thud: [70], switch: [500], reload: [300], fire: [120] };
    const seq = freqs[kind] || [440];
    o.type = 'sine';
    o.frequency.setValueAtTime(seq[0], t);
    for (let i = 1; i < seq.length; i++) o.frequency.setValueAtTime(seq[i], t + i * 0.09);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + seq.length * 0.09 + 0.12);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + seq.length * 0.09 + 0.15);
  }

  shot(id) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = id === 'shotgun' ? 900 : 2400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(id === 'shotgun' ? 0.5 : 0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (id === 'shotgun' ? 0.28 : 0.12));
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.3);
  }

  boom() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 320;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 1);
  }

  update(dt) {
    if (!this.ctx) return;
    const player = this.game.player;
    const speed = player.inCar ? Math.abs(player.inCar.speed) : 0;
    // Engine pitch follows speed.
    if (this.engineGain) {
      this.engineGain.gain.value = player.inCar ? 0.05 + Math.min(0.1, speed * 0.002) : 0.0;
      this.engineOsc.frequency.value = 55 + speed * 4.5;
    }
    // Siren wails while any unit is close.
    if (this.sirenGain) {
      let near = false;
      for (const u of this.game.police.units) {
        const d = Math.hypot(u.pos.x - player.pos.x, u.pos.z - player.pos.z);
        if (d < 60) near = true;
      }
      const target = near ? 0.045 : 0;
      this.sirenGain.gain.value += (target - this.sirenGain.gain.value) * Math.min(1, dt * 3);
      this.sirenOsc.frequency.value = 700 + Math.sin(this.game.time * 4.5) * 220;
    }
    // Radio sequencer: 16 steps, lookahead scheduling.
    if (this.radioOn && !this.muted) {
      const st = STATIONS[this.station];
      const stepDur = 60 / st.bpm / 4;
      while (this._nextStepTime < this.ctx.currentTime + 0.15) {
        if (this._nextStepTime < this.ctx.currentTime) this._nextStepTime = this.ctx.currentTime + 0.02;
        this.scheduleStep(st, this._step, this._nextStepTime, stepDur);
        this._step = (this._step + 1) % 16;
        this._nextStepTime += stepDur;
      }
    }
  }

  scheduleStep(st, step, t, stepDur) {
    // Kick on 0, 4, 8, 12; hats on off-beats; bass on a pentatonic walk.
    const play = (freq, dur, type, vol) => {
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    };
    if (step % 4 === 0) play(58, 0.16, 'sine', 0.5);
    if (step % 4 === 2) {
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 6000;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(t);
      src.stop(t + 0.06);
    }
    const bassNotes = [0, 0, 3, 0, 5, 0, 7, 5];
    if (step % 2 === 0) {
      const deg = bassNotes[(step / 2) | 0] ?? 0;
      const semi = st.scale[deg % st.scale.length] + 12 * Math.floor(deg / st.scale.length);
      play(st.root * Math.pow(2, semi / 12) / 2, stepDur * 1.8, 'triangle', 0.22);
    }
    if (step === 0 || step === 6 || step === 10) {
      const deg = st.scale[(step * 2 + 1) % st.scale.length];
      play(st.root * Math.pow(2, deg / 12) * 2, 0.22, st.wave, 0.1);
    }
  }
}
