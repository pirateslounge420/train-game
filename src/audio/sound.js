// All sounds are made on the fly with the Web Audio API – no audio files.

export class Sound {
  constructor() {
    this.ctx = null;
  }

  // Browsers only allow audio after a click, so this is called on the first click.
  init() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  noise(dur, freq, q, gain, type = 'bandpass', delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5, dur + 0.05);
  }

  tone(freq, dur, gain, type = 'sine', slideTo = null, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // Volume falls off with distance from the player.
  near(pos, player, base) {
    const d = pos.distanceTo(player.eyeWorld());
    return base / (1 + d * 0.12);
  }

  creak() {
    this.noise(0.35, 600, 8, 0.05);
  }
  twang(power) {
    this.tone(110 + power * 60, 0.25, 0.35 * (0.4 + power), 'triangle', 60);
    this.noise(0.12, 1800, 1.5, 0.25 * (0.4 + power));
  }
  enemyTwang(pos, player) {
    const v = this.near(pos, player, 0.5);
    this.tone(130, 0.2, v * 0.4, 'triangle', 70);
    this.noise(0.1, 1500, 1.5, v * 0.3);
  }
  thunk(pos, player) {
    const v = this.near(pos, player, 0.9);
    this.noise(0.09, 420, 2, v);
    this.tone(160, 0.08, v * 0.4, 'square', 80);
  }
  hurt() {
    this.tone(90, 0.35, 0.5, 'sawtooth', 40);
    this.noise(0.2, 300, 1, 0.5, 'lowpass');
  }
  pickup() {
    this.tone(660, 0.07, 0.15, 'triangle');
    this.tone(990, 0.09, 0.12, 'triangle', null, 0.05);
  }
  hitFeedback(kind) {
    this.noise(0.1, 500, 1.2, 0.5, 'lowpass');
    if (kind === 'headshot') {
      this.tone(1320, 0.5, 0.35, 'sine');
      this.tone(1980, 0.45, 0.18, 'sine', null, 0.04);
    } else if (kind === 'kill') {
      this.tone(880, 0.25, 0.22, 'sine');
    } else {
      this.tone(520, 0.08, 0.12, 'square');
    }
  }
  chuff(strength = 1) {
    this.noise(0.16, 260, 0.7, 0.13 * strength, 'lowpass');
  }
  // Thrown off the train.
  whoosh() {
    this.noise(0.6, 900, 0.8, 0.45);
    this.tone(320, 0.5, 0.12, 'sine', 120);
  }
  // Landing on the ground.
  thud(strength = 1) {
    this.noise(0.25, 160, 0.9, 0.6 * strength, 'lowpass');
    this.tone(70, 0.2, 0.4 * strength, 'sine', 40);
  }
  hookFire() {
    this.noise(0.12, 1200, 1.2, 0.35);
    this.tone(220, 0.15, 0.2, 'triangle', 90);
    this.noise(0.5, 3200, 2, 0.06, 'bandpass', 0.05); // rope paying out
  }
  latch() {
    this.tone(900, 0.06, 0.25, 'square');
    this.tone(1400, 0.12, 0.15, 'triangle', null, 0.03);
    this.noise(0.6, 2400, 1.5, 0.12, 'bandpass', 0.05); // reeling in
  }
  swap() {
    this.noise(0.06, 1400, 2, 0.12);
  }
  shovel() {
    this.noise(0.18, 700, 1, 0.12, 'lowpass');
    this.noise(0.3, 260, 0.8, 0.1, 'lowpass', 0.12);
  }
  whistle() {
    if (!this.ctx) return;
    for (const [f, d] of [[466, 0], [554, 0], [698, 0]]) {
      this.tone(f, 1.1, 0.07, 'sawtooth', f * 0.97, d);
    }
    this.noise(1.1, 1800, 1, 0.08, 'bandpass');
  }
  clack() {
    this.noise(0.04, 2500, 3, 0.07);
    this.tone(240, 0.04, 0.05, 'square');
  }
}
