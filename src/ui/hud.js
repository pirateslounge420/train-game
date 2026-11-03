import { CONFIG } from '../config.js';
import { TOUCH } from '../core/input.js';
import { biomeOf } from '../world/line.js';

// On-screen display: health, arrows, hit markers and messages.
export class Hud {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.healthFill = $('health-fill');
    this.arrowCount = $('arrow-count');
    this.stats = $('stats');
    this.stats.innerHTML = '<span id="st-speed"></span> · <span id="st-dist"></span> · <span id="st-country"></span> · <span id="st-tod" title="tap: +3 hours"></span> · seed <span id="st-seed"></span> · downed <span id="st-down"></span>';
    this.st = { speed: $('st-speed'), dist: $('st-dist'), country: $('st-country'), tod: $('st-tod'), seed: $('st-seed'), down: $('st-down') };
    this.onTimeTap = null;
    this.st.tod.addEventListener('pointerdown', (e) => {
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
    this.lastArrows = -1;
    this.hintText = '';
    this.hintT = 0;
    // phone buttons
    this.grab = $('grab');
    this.draw = $('draw');
    this.drawn = $('drawn');
  }

  update(game, dt, day) {
    if (this.hitT > 0) {
      this.hitT -= dt;
      if (this.hitT <= 0) this.cross.classList.remove('hit', 'big');
    }
    const p = game.player;
    this.healthFill.style.width = `${(p.health / CONFIG.player.maxHealth) * 100}%`;
    this.healthFill.classList.toggle('low', p.health < 30);
    if (p.arrows !== this.lastArrows) {
      this.arrowCount.textContent = `${p.arrows} / ${CONFIG.player.maxArrows}`;
      this.drawn.textContent = p.arrows;
      this.arrowCount.classList.toggle('empty', p.arrows === 0);
      this.lastArrows = p.arrows;
    }
    const t = game.train;
    const h = ((day.dayT / day.dayLen) % 1) * 24;
    const set = (el, v) => {
      if (el.textContent !== v) el.textContent = v;
    };
    set(this.st.speed, `${Math.round(t.speed * 2.237)} mph`);
    set(this.st.dist, `${(Math.max(0, t.distance) / 1609.34).toFixed(2)} mi`);
    set(this.st.country, biomeOf(t.region).name);
    set(this.st.tod, `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`);
    set(this.st.seed, String(day.seed));
    set(this.st.down, String(game.bandits.downed));
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) this.banner_.classList.remove('on');
    }
    this.draw.classList.toggle('on', !!p.bow?.drawing);
    this.grab.classList.toggle('ok', game.arrows.reachableCount(p) > 0);
    let prompt = '';
    if (this.hintT > 0) {
      this.hintT -= dt;
      prompt = this.hintText;
    } else if (p.onLadder) prompt = TOUCH ? 'Climbing: stick up or down' : 'Climbing: W up, S down';
    else if (p.arrows === 0) prompt = 'Out of arrows! Grab the ones stuck in the train.';
    if (prompt !== this.prompt.textContent) this.prompt.textContent = prompt;
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
