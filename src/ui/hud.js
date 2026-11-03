import { CONFIG } from '../config.js';
import { TOUCH } from '../core/input.js';

// On-screen display: health, arrows, hit markers and messages.
export class Hud {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.healthFill = $('health-fill');
    this.arrowCount = $('arrow-count');
    this.stats = $('stats');
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

  update(game, dt) {
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
    const mph = Math.round(game.train.speed * 2.237);
    const miles = (game.train.distance / 1609.34).toFixed(2);
    this.stats.innerHTML = `${mph} mph &nbsp;·&nbsp; ${miles} mi &nbsp;·&nbsp; bandits downed: ${game.bandits.downed}`;
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
