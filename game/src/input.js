// input.js — Status tombol keyboard; sekali-tekan untuk aksi (E/Q/F/M/R/Enter).

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.onKey = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!e.repeat) this.pressed.add(k);
      this.down.add(k);
    };
    this.onKeyUp = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.down.delete(k);
    };
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
  }

  axis() {
    let x = 0, z = 0;
    if (this.down.has('a') || this.down.has('ArrowLeft')) x -= 1;
    if (this.down.has('d') || this.down.has('ArrowRight')) x += 1;
    if (this.down.has('w') || this.down.has('ArrowUp')) z -= 1;
    if (this.down.has('s') || this.down.has('ArrowDown')) z += 1;
    if (x !== 0 && z !== 0) { x *= Math.SQRT1_2; z *= Math.SQRT1_2; }
    return { x, z };
  }

  sneak() { return this.down.has('Shift'); }

  wasPressed(key) { return this.pressed.has(key); }

  // Dipanggil tiap frame sesudah logika membaca tombol sekali-tekan.
  endFrame() { this.pressed.clear(); }
}
