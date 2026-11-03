import { CONFIG, MPH } from '../config.js';
import { stopName } from '../world/stops.js';

// On-screen display: health, items, hit markers, prompts and messages.
export class Hud {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.healthFill = $('health-fill');
    this.arrowCount = $('arrow-count');
    this.stats = $('stats');
    this.hitmarker = $('hitmarker');
    this.crosshair = $('crosshair');
    this.callout = $('callout');
    this.alert = $('alert');
    this.feed = $('feed');
    this.vignette = $('vignette');
    this.prompt = $('prompt');
    this.slots = [...document.querySelectorAll('#items .slot')];
    this.lastArrows = -1;
  }

  update(game, interactText) {
    const { player: p, train, conductor, inventory } = game;
    this.healthFill.style.width = `${(p.health / CONFIG.player.maxHealth) * 100}%`;
    this.healthFill.classList.toggle('low', p.health < 30);
    if (p.arrows !== this.lastArrows) {
      this.arrowCount.textContent = `${p.arrows} / ${CONFIG.player.maxArrows}`;
      this.arrowCount.classList.toggle('empty', p.arrows === 0);
      this.lastArrows = p.arrows;
    }

    const mph = Math.round(train.speed / MPH);
    const miles = (train.distance / 1609.34).toFixed(2);
    this.stats.innerHTML = `${mph} mph &nbsp;·&nbsp; ${miles} mi &nbsp;·&nbsp; bandits downed: ${game.bandits.downed}`;

    // Item bar.
    const offTrain = p.offTrain && !p.dead;
    const grapple = inventory.grapple;
    // The train is getting away and the hook could still save you.
    const trainInRange = offTrain && train.speed > 4 && p.distanceToTrain() < CONFIG.grapple.range;
    this.slots.forEach((el, i) => {
      el.classList.toggle('active', i === inventory.index);
      el.classList.toggle('urgent', i === 1 && trainInRange && inventory.index !== 1);
    });
    // Crosshair turns into a ring that lights up when the hook would bite.
    const hookOut = inventory.index === 1;
    this.crosshair.className = hookOut ? (grapple.aimHit ? 'hook ok' : 'hook') : '';

    // The big centre alert while you're off the train.
    let alert = '';
    let urgent = false;
    if (offTrain && !p.dead) {
      if (trainInRange) {
        alert = inventory.index === 1 ? 'FIRE THE HOOK AT THE TRAIN!' : 'SCROLL TO THE HOOK!';
        urgent = true;
      } else if (conductor.state === 'waiting' && p.distanceToTrain() < CONFIG.player.reach * 3) {
        alert = 'The conductor is waiting — right click next to the train to climb aboard';
      } else if (conductor.waitingZ !== null) {
        const dist = Math.max(0, Math.round(p.feetWorld().z - conductor.waitingZ - 24));
        const verb = conductor.state === 'waiting' ? 'is waiting' : 'will wait';
        alert = `Left behind — the train ${verb} at ${stopName(conductor.stop)}, ${dist} m up the line`;
      } else if (p.distanceToTrain() >= CONFIG.grapple.range) {
        alert = 'Left behind — follow the tracks';
      }
    }
    if (this.alert.textContent !== alert) this.alert.textContent = alert;
    this.alert.classList.toggle('urgent', urgent);

    let prompt = interactText || '';
    if (!prompt) {
      if (p.onLadder) prompt = 'Climbing — W up, S down';
      else if (p.reel) prompt = '';
      else if (p.arrows === 0 && inventory.index === 0) prompt = 'Out of arrows! Right click arrows stuck in the train to pull them out.';
    }
    if (this.prompt.textContent !== prompt) this.prompt.textContent = prompt;
  }

  hitFeedback(kind, text) {
    const hm = this.hitmarker;
    hm.className = '';
    void hm.offsetWidth; // restart the animation
    hm.className = `show ${kind}`;
    if (kind === 'headshot' || kind === 'kill') this.showCallout(kind, text);
    if (kind !== 'hit') this.message(text);
  }

  showCallout(kind, text) {
    const c = this.callout;
    c.textContent = text;
    c.className = '';
    void c.offsetWidth;
    c.className = `show ${kind}`;
  }

  knockedOff() {
    this.showCallout('knocked', 'KNOCKED OFF!');
  }

  message(text) {
    const el = document.createElement('div');
    el.textContent = text;
    this.feed.prepend(el);
    setTimeout(() => el.classList.add('fade'), 3500);
    setTimeout(() => el.remove(), 4300);
    while (this.feed.children.length > 5) this.feed.lastChild.remove();
  }

  hurt(head) {
    const v = this.vignette;
    v.className = '';
    void v.offsetWidth;
    v.className = head ? 'show heavy' : 'show';
  }

  pickup(n = 1) {
    this.message(`+${n} arrow${n > 1 ? 's' : ''}`);
  }
}
