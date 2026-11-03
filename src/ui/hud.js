import { CONFIG } from '../config.js';
import { TOUCH } from '../core/input.js';
import { biomeOf } from '../world/line.js';
import { SURGES } from '../train/train.js';

// Saved settings. Private windows can refuse these, and that's fine.
function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch (e) {}
  return null;
}

// On-screen display (§I): the speed, the stats panel behind Tab or the Stats
// button, health when you're hurt, hit markers and messages.
export class Hud {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.health = $('health');
    this.healthFill = $('health-fill');
    this.lastHealth = Infinity;
    this.hpShow = 0;
    // Speed: big in your chosen unit, small in the other, remembered (§I).
    this.spd = { big: $('spd-big'), unit: $('spd-unit'), small: $('spd-small') };
    this.mph = store('tgp_units') !== 'kmh';
    this.best = parseFloat(store('tgp_best')) || 0;
    this.stats = $('stats');
    this.st = {};
    for (const k of ['dist', 'country', 'arrows', 'surge', 'down', 'heads', 'hats', 'hatshots', 'wear', 'best', 'tod', 'seed']) this.st[k] = $(`st-${k}`);
    this.crossLines = document.querySelector('#cross .xh');
    this.crossScale = '';
    this.surgeBtn = $('surge');
    this.surgeLbl = $('surgelbl');
    this.onTimeTap = null;
    $('st-todrow').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.onTimeTap?.();
    });
    this.banner_ = $('banner');
    this.bannerT = 0;
    this.cross = $('cross');
    this.hitT = 0;
    this.callout = $('callout');
    this.feed = $('feed');
    this.vignette = $('vignette');
    this.prompt = $('prompt');
    this.hintText = '';
    this.hintT = 0;
    // phone buttons
    this.grab = $('grab');
    this.draw = $('draw');
    this.crouch = $('crouch');
    this.drawn = $('drawn');
  }

  update(game, dt, day) {
    if (this.hitT > 0) {
      this.hitT -= dt;
      if (this.hitT <= 0) this.cross.classList.remove('hit', 'big');
    }
    const p = game.player, t = game.train;
    const set = (el, v) => {
      if (el.textContent !== v) el.textContent = v;
    };
    const mph = Math.round(t.speed * 2.237), kmh = Math.round(t.speed * 3.6);
    set(this.spd.big, String(this.mph ? mph : kmh));
    set(this.spd.unit, this.mph ? 'mph' : 'km/h');
    set(this.spd.small, this.mph ? `${kmh} km/h` : `${mph} mph`);

    // Health shows for a moment when you're hit, and while you hold Stats.
    if (p.health < this.lastHealth && this.lastHealth !== Infinity) this.hpShow = 2.5;
    this.lastHealth = p.health;
    if (this.hpShow > 0) this.hpShow -= dt;
    this.healthFill.style.width = `${(p.health / CONFIG.player.maxHealth) * 100}%`;
    this.healthFill.classList.toggle('low', p.health < 30);
    this.health.classList.toggle('on', this.hpShow > 0 || day.stats);

    const dots = '●'.repeat(t.surges) + '○'.repeat(Math.max(0, SURGES - t.surges));
    this.stats.classList.toggle('on', day.stats);
    if (day.stats) {
      const st = this.st, h = ((day.dayT / day.dayLen) % 1) * 24, R = game.riders;
      set(st.dist, `${(Math.max(0, t.distance) / 1609.34).toFixed(2)} mi`);
      set(st.country, biomeOf(t.region).name);
      set(st.arrows, `${p.arrows} / ${CONFIG.player.maxArrows}`);
      set(st.surge, dots);
      set(st.down, String(R.kills));
      set(st.heads, String(R.headshots));
      set(st.hats, `${game.hats.racked.length} / ${R.gangs.length}`);
      set(st.hatshots, String(R.hatShots));
      set(st.wear, p.hat ? `${p.hat.userData.gang} hat` : 'nothing');
      set(st.best, `${this.best.toFixed(2)} mi`);
      set(st.tod, `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`);
      set(st.seed, String(day.seed));
    }
    set(this.drawn, String(p.arrows));
    set(this.surgeLbl, dots);
    this.surgeBtn.classList.toggle('empty', t.surges <= 0);
    this.surgeBtn.classList.toggle('on', p.car.name === 'tender' && t.surges > 0);
    // The crosshair opens as the bow comes to full draw (reference 0.7).
    const xs = (1 + 0.6 * (p.bow?.drawing ? p.bow.power() : 0)).toFixed(3);
    if (xs !== this.crossScale) {
      this.crossScale = xs;
      this.crossLines.style.transform = `scale(${xs})`;
    }
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) this.banner_.classList.remove('on');
    }
    this.draw.classList.toggle('on', !!p.bow?.drawing);
    this.grab.classList.toggle('ok', game.arrows.reachableCount(p) > 0 || !!game.hats.looked(p, game.camera) || game.conductorNear() || p.canClimb());
    this.crouch.classList.toggle('on', p.crouch);
    let prompt = '';
    if (this.hintT > 0) {
      this.hintT -= dt;
      prompt = this.hintText;
    } else if (p.onFoot) prompt = game.footNote();
    else if (p.onLadder) prompt = TOUCH ? 'Climbing: stick up or down' : 'Climbing: W up, S down';
    else if (p.arrows === 0) prompt = 'Out of arrows! Grab the ones stuck in the train.';
    if (prompt !== this.prompt.textContent) this.prompt.textContent = prompt;
  }

  // Tap the speed, or press U: swap mph and km/h, and remember it.
  toggleUnits() {
    this.mph = !this.mph;
    store('tgp_units', this.mph ? 'mph' : 'kmh');
  }

  // The longest run on this device. Returns the best so far.
  saveBest(miles) {
    if (miles > this.best) {
      this.best = miles;
      store('tgp_best', String(miles));
    }
    return this.best;
  }

  hitFeedback(kind, text) {
    // Flash the X through the crosshair; brass and a little longer for a headshot.
    const big = kind === 'headshot';
    this.hitT = big ? 0.32 : 0.2;
    this.cross.classList.add('hit');
    this.cross.classList.toggle('big', big);
    if (kind === 'headshot' || kind === 'kill') {
      const c = this.callout;
      c.textContent = text;
      c.className = '';
      void c.offsetWidth;
      c.className = `show ${kind}`;
    }
    if (kind !== 'hit') this.message(text);
  }

  // A big title in the upper middle: a town's name, a tunnel ahead.
  banner(title, sub) {
    const b = this.banner_;
    b.textContent = title;
    if (sub) {
      const small = document.createElement('small');
      small.textContent = sub;
      b.appendChild(small);
    }
    b.classList.add('on');
    this.bannerT = 4;
  }

  // A short line of help at the bottom of the screen.
  hint(text) {
    this.hintText = text;
    this.hintT = 2.8;
  }

  message(text) {
    const el = document.createElement('div');
    el.textContent = text;
    this.feed.prepend(el);
    setTimeout(() => el.classList.add('fade'), 2500);
    setTimeout(() => el.remove(), 3300);
    while (this.feed.children.length > 5) this.feed.lastChild.remove();
  }

  hurt(head) {
    const v = this.vignette;
    v.className = '';
    void v.offsetWidth;
    v.className = head ? 'show heavy' : 'show';
  }

  pickup() {
    this.message('+1 arrow');
  }
}
