// One player's controls: keyboard + mouse on a desktop, the on-screen stick
// and buttons on a phone (§C, §M; numbers from reference 0.7). Mouse look
// only counts while the pointer is locked (the game has captured the mouse).

const DOUBLE_TAP = 320; // ms: tap forward twice this quickly and hold to sprint
const TAP_TIME = 320; // ms and px: a touch this short and still is a tap, not a look
const TAP_MOVE = 14;
const DRAW_AIM = 0.8; // dragging the Draw button aims a little slower than the view

// Phones and tablets: no fine mouse pointer. The on-screen controls show.
export const TOUCH = !matchMedia('(hover: hover) and (pointer: fine)').matches;

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouse = [false, false, false];
    this.dx = 0;
    this.dy = 0;
    this.locked = false;
    this.active = false; // set by the game while a run is being played
    this.onLockChange = null;
    this.stick = { x: 0, y: 0 }; // the on-screen stick, -1..1, y up = forward
    this.touchDraw = false;
    this.sprint = false;
    this.lastW = 0;
    this.jumpReq = false;
    this.grabReq = false;
    this.cancelReq = false;
    this.taps = []; // screen points tapped this frame (to grab a stuck arrow)

    addEventListener('keydown', (e) => {
      if (e.code === 'KeyW' && !this.keys.has('KeyW')) {
        const now = performance.now();
        if (now - this.lastW < DOUBLE_TAP) this.sprint = true;
        this.lastW = now;
      }
      this.keys.add(e.code);
      if (e.code === 'Space') {
        e.preventDefault();
        this.jumpReq = true;
      }
      if (e.code === 'KeyE') this.grabReq = true;
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyW') this.sprint = false;
    });
    addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      this.mouse[e.button] = true;
      if (e.button === 2) this.grabReq = true;
    });
    addEventListener('mouseup', (e) => (this.mouse[e.button] = false));
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.cancelReq = true;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.reset();
      if (this.onLockChange) this.onLockChange(this.locked);
    });
    // Stop the page scrolling or zooming under your thumbs mid-run.
    document.addEventListener(
      'touchmove',
      (e) => {
        if (this.active) e.preventDefault();
      },
      { passive: false },
    );
    this.bindTouch();
  }

  bindTouch() {
    const $ = (id) => document.getElementById(id);
    const capture = (el, e) => {
      try {
        el.setPointerCapture(e.pointerId);
      } catch (err) {}
    };

    // Drag anywhere on the view to look; a quick still tap grabs the stuck
    // arrow under your finger.
    let lookId = null;
    let last = null;
    let tapStart = null;
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || lookId !== null) return;
      lookId = e.pointerId;
      last = { x: e.clientX, y: e.clientY };
      tapStart = { x: e.clientX, y: e.clientY, t: performance.now() };
      capture(this.canvas, e);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookId) return;
      this.dx += e.clientX - last.x;
      this.dy += e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
    });
    const endLook = (e) => {
      if (e.pointerId !== lookId) return;
      lookId = null;
      const t = tapStart;
      if (e.type === 'pointerup' && t && performance.now() - t.t < TAP_TIME && Math.hypot(e.clientX - t.x, e.clientY - t.y) < TAP_MOVE) {
        this.taps.push({ x: e.clientX, y: e.clientY });
      }
      tapStart = null;
    };
    this.canvas.addEventListener('pointerup', endLook);
    this.canvas.addEventListener('pointercancel', endLook);

    // The stick: tap it twice quickly and hold forward to sprint.
    const stick = $('stick');
    const knob = $('knob');
    let stickId = null;
    let lastStickTap = 0;
    const moveStick = (e) => {
      const r = stick.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const R = r.width / 2 - 16;
      const L = Math.hypot(dx, dy);
      if (L > R) {
        dx *= R / L;
        dy *= R / L;
      }
      this.stick.x = dx / R;
      this.stick.y = -dy / R;
      knob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    };
    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (stickId !== null) return;
      stickId = e.pointerId;
      const now = performance.now();
      if (now - lastStickTap < DOUBLE_TAP) this.sprint = true;
      lastStickTap = now;
      capture(stick, e);
      moveStick(e);
    });
    stick.addEventListener('pointermove', (e) => {
      if (e.pointerId === stickId) moveStick(e);
    });
    const endStick = (e) => {
      if (e.pointerId !== stickId) return;
      stickId = null;
      this.stick.x = this.stick.y = 0;
      this.sprint = false;
      knob.style.transform = '';
    };
    stick.addEventListener('pointerup', endStick);
    stick.addEventListener('pointercancel', endStick);

    // Draw: hold to draw, drag the same finger to aim, let go to loose.
    const draw = $('draw');
    let drawId = null;
    let drawLast = null;
    draw.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      drawId = e.pointerId;
      drawLast = { x: e.clientX, y: e.clientY };
      capture(draw, e);
      this.touchDraw = true;
    });
    draw.addEventListener('pointermove', (e) => {
      if (e.pointerId !== drawId) return;
      this.dx += (e.clientX - drawLast.x) * DRAW_AIM;
      this.dy += (e.clientY - drawLast.y) * DRAW_AIM;
      drawLast = { x: e.clientX, y: e.clientY };
    });
    draw.addEventListener('pointerup', (e) => {
      e.preventDefault();
      drawId = null;
      this.touchDraw = false;
    });
    draw.addEventListener('pointercancel', () => {
      drawId = null;
      this.touchDraw = false;
      this.cancelReq = true;
    });

    $('jump').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.jumpReq = true;
    });
    $('grab').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.grabReq = true;
    });
  }

  lock() {
    // Some browsers (and embedded previews) refuse; that's fine, just no lock.
    try {
      this.canvas.requestPointerLock()?.catch?.(() => {});
    } catch (err) {}
  }

  reset() {
    this.keys.clear();
    this.mouse = [false, false, false];
    this.dx = this.dy = 0;
    this.sprint = false;
    this.jumpReq = this.grabReq = false;
    this.taps.length = 0;
  }

  // Is the bow's draw button held (left mouse, or the Draw button)?
  drawHeld() {
    return this.mouse[0] || this.touchDraw;
  }

  down(code) {
    return this.keys.has(code);
  }

  // Walking input from the keys and the stick together: x right, y forward,
  // no longer than 1.
  move() {
    const k = (a, b) => (this.down(a) || this.down(b) ? 1 : 0);
    let x = Math.max(-1, Math.min(1, k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft') + this.stick.x));
    let y = Math.max(-1, Math.min(1, k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown') + this.stick.y));
    const L = Math.hypot(x, y);
    if (L > 1) {
      x /= L;
      y /= L;
    }
    return { x, y };
  }

  // One-shot presses: true once, then cleared.
  take(name) {
    const v = this[name];
    this[name] = false;
    return v;
  }

  takeTaps() {
    const t = this.taps.slice();
    this.taps.length = 0;
    return t;
  }

  takeMouseDelta() {
    const d = [this.dx, this.dy];
    this.dx = this.dy = 0;
    return d;
  }
}
