// Keyboard + mouse state. Mouse movement only counts while the pointer is
// locked (i.e. the game has captured the mouse).

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouse = [false, false, false];
    this.dx = 0;
    this.dy = 0;
    this.locked = false;
    this.onLockChange = null;

    addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('mousedown', (e) => {
      if (this.locked) this.mouse[e.button] = true;
    });
    addEventListener('mouseup', (e) => (this.mouse[e.button] = false));
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });
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
    this.dx = this.dy = 0;
  }

  // Is the bow's draw button held? (Touch controls will add to this.)
  drawHeld() {
    return this.mouse[0];
  }

  down(code) {
    return this.keys.has(code);
  }

  takeMouseDelta() {
    const d = [this.dx, this.dy];
    this.dx = this.dy = 0;
    return d;
  }
}
