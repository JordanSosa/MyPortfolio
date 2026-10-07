// Keyboard + touch input, normalised into an axis and named actions.

const KEYMAP = {
  KeyE: "grab", KeyJ: "grab", Enter: "grab",
  Space: "flap", KeyK: "flap",
  ShiftLeft: "run", ShiftRight: "run",
  KeyQ: "honk", KeyH: "honk",
  Escape: "pause", KeyP: "pause",
  KeyM: "mute",
};
const DIRS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export class Input {
  constructor() {
    this.down = new Set();
    this.held_ = new Set();
    this.pressed = new Set();
    this.stick = { x: 0, z: 0, active: false };
    this.axis = { x: 0, z: 0, boost: false };

    addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (DIRS[e.code] || KEYMAP[e.code]) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      const a = KEYMAP[e.code];
      if (a) this.press(a);
    });
    addEventListener("keyup", (e) => {
      this.down.delete(e.code);
      const a = KEYMAP[e.code];
      if (a) this.release(a);
    });
    addEventListener("blur", () => this.clear());
  }

  press(a) {
    this.pressed.add(a);
    this.held_.add(a);
  }
  release(a) {
    // only release if no other key/button still holds this action
    for (const code of this.down) if (KEYMAP[code] === a) return;
    this.held_.delete(a);
  }
  clear() {
    this.down.clear();
    this.held_.clear();
    this.pressed.clear();
    this.stick.x = this.stick.z = 0;
  }

  held(a) { return this.held_.has(a); }
  consume(a) {
    const had = this.pressed.has(a);
    this.pressed.delete(a);
    return had;
  }

  update() {
    let x = 0, z = 0;
    for (const code of this.down) {
      const d = DIRS[code];
      if (d) { x += d[0]; z += d[1]; }
    }
    const len = Math.hypot(x, z);
    if (len > 0) { x /= len; z /= len; }
    if (this.stick.active) { x = this.stick.x; z = this.stick.z; }
    this.axis.x = x;
    this.axis.z = z;
    this.axis.boost = this.stick.active && Math.hypot(x, z) > 0.92;
  }

  endFrame() { this.pressed.clear(); }

  // --- touch -------------------------------------------------------------
  bindTouch({ zone, knob, buttons }) {
    let id = null, ox = 0, oy = 0;
    const R = 56;
    zone.addEventListener("pointerdown", (e) => {
      if (id !== null) return;
      id = e.pointerId;
      zone.setPointerCapture(id);
      ox = e.clientX; oy = e.clientY;
      knob.parentElement.style.left = `${ox}px`;
      knob.parentElement.style.top = `${oy}px`;
      knob.parentElement.classList.add("on");
      this.stick.active = true;
    });
    zone.addEventListener("pointermove", (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - ox, dy = e.clientY - oy;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.stick.x = dx / R;
      this.stick.z = dy / R;
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      this.stick.active = false;
      this.stick.x = this.stick.z = 0;
      knob.style.transform = "";
      knob.parentElement.classList.remove("on");
    };
    zone.addEventListener("pointerup", end);
    zone.addEventListener("pointercancel", end);

    for (const [el, action] of buttons) {
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        el.classList.add("on");
        this.press(action);
      });
      const up = () => {
        el.classList.remove("on");
        this.held_.delete(action);
      };
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    }
  }
}
