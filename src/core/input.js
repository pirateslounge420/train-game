// Keyboard + mouse state. Mouse movement only counts while the pointer is
// locked (i.e. the game has captured the mouse).

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouse = [false, false, false];
    this.pressed = new Set(); // presses since last frame: 'Mouse0', 'Mouse2', key codes
    this.wheel = 0; // scroll steps since last frame
    this.dx = 0;
    this.dy = 0;
    this.locked = false;
    this.onLockChange = null;

    addEventListener('keydown', (e) => {
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      this.mouse[e.button] = true;
      this.pressed.add(`Mouse${e.button}`);
    });
    addEventListener('mouseup', (e) => (this.mouse[e.button] = false));
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });
    addEventListener(
      'wheel',
      (e) => {
        if (!this.locked) return;
        e.preventDefault();
        if (Math.abs(e.deltaY) > 0.5) this.wheel += Math.sign(e.deltaY);
      },
      { passive: false },
    );
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('blur', () => this.reset());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.reset();
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  lock() {
    this.canvas.requestPointerLock();
  }

  reset() {
    this.keys.clear();
    this.mouse = [false, false, false];
    this.pressed.clear();
    this.wheel = 0;
    this.dx = this.dy = 0;
  }

  down(code) {
    return this.keys.has(code);
  }

  // True once per press.
  took(code) {
    return this.pressed.delete(code);
  }

  takeWheel() {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  // Call at the end of each frame so stale presses don't linger.
  endFrame() {
    this.pressed.clear();
  }

  takeMouseDelta() {
    const d = [this.dx, this.dy];
    this.dx = this.dy = 0;
    return d;
  }
}
