// VERMILION KEYS — input: keyboard + mouse drag, with edge detection.
// `pressed(code)` is true only on the frame the key went down; the set is
// cleared at the end of each frame by the game loop.

export class Input {
  constructor() {
    this.keys = {};
    this._pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.pressedMouse = false;
    this.enabled = true;
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (!this.keys[e.code]) this._pressed.add(e.code);
      this.keys[e.code] = true;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
    window.addEventListener('blur', () => {
      this.keys = {};
    });
    window.addEventListener('mousedown', (e) => {
      if (!this.mouseDown) this.pressedMouse = true;
      this.mouseDown = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.mouseDown) return;
      this.mouseDX += e.clientX - (this._lastX ?? e.clientX);
      this.mouseDY += e.clientY - (this._lastY ?? e.clientY);
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    });
  }

  pressed(code) {
    return this._pressed.has(code);
  }

  endFrame() {
    this._pressed.clear();
    this.pressedMouse = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
  }

  // Driving input from the current key state.
  driveInput() {
    let throttle = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) throttle += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) throttle -= 1;
    let steer = 0;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) steer -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) steer += 1;
    return {
      throttle,
      steer,
      handbrake: !!(this.keys['Space'] || this.keys['ShiftLeft']),
    };
  }
}
