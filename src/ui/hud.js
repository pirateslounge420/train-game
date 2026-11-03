import { CONFIG } from '../config.js';

// On-screen display: health, arrows, hit markers and messages.
export class Hud {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.healthFill = $('health-fill');
    this.arrowCount = $('arrow-count');
    this.stats = $('stats');
    this.hitmarker = $('hitmarker');
    this.callout = $('callout');
    this.feed = $('feed');
    this.vignette = $('vignette');
    this.prompt = $('prompt');
    this.lastArrows = -1;
  }

  update(game) {
    const p = game.player;
    this.healthFill.style.width = `${(p.health / CONFIG.player.maxHealth) * 100}%`;
    this.healthFill.classList.toggle('low', p.health < 30);
    if (p.arrows !== this.lastArrows) {
      this.arrowCount.textContent = `${p.arrows} / ${CONFIG.player.maxArrows}`;
      this.arrowCount.classList.toggle('empty', p.arrows === 0);
      this.lastArrows = p.arrows;
    }
    const mph = Math.round(game.train.speed * 2.237);
    const miles = (game.train.distance / 1609.34).toFixed(2);
    this.stats.innerHTML = `${mph} mph &nbsp;·&nbsp; ${miles} mi &nbsp;·&nbsp; bandits downed: ${game.bandits.downed}`;
    let prompt = '';
    if (p.onLadder) prompt = 'Climbing — W up, S down';
    else if (p.arrows === 0) prompt = 'Out of arrows! Pick up arrows stuck in the train.';
    this.prompt.textContent = prompt;
  }

  hitFeedback(kind, text) {
    const hm = this.hitmarker;
    hm.className = '';
    void hm.offsetWidth; // restart the animation
    hm.className = `show ${kind}`;
    if (kind === 'headshot' || kind === 'kill') {
      const c = this.callout;
      c.textContent = text;
      c.className = '';
      void c.offsetWidth;
      c.className = `show ${kind}`;
    }
    if (kind !== 'hit') this.message(text);
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
