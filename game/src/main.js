// main.js — Orkestrator game: state title/play/win/lose, deteksi, interaksi, skor.
// Semua aturan dimainkan sama untuk manusia maupun autopilot.

import { RULES, POTIONS, EXIT, TEXTS, GAME_TITLE } from './config.js';
import { RenderEngine, Minimap } from './render.js';
import { World, inSmoke } from './level.js';
import { createGuards, GUARD_STATES } from './guards.js';
import { Player, DistractionBottle } from './player.js';
import { Autopilot } from './autopilot.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { Hud } from './hud.js';

export const STATES = { TITLE: 'title', PLAY: 'play', WIN: 'win', LOSE: 'lose' };

export class Game {
  constructor(canvas) {
    this.render = new RenderEngine(canvas);
    this.world = new World(this.render.scene);
    const { guards, cat } = createGuards(this.render.scene);
    this.guards = guards;
    this.cat = cat;
    this.player = new Player(this.render.scene);
    this.bottle = new DistractionBottle(this.render.scene);
    this.autopilot = new Autopilot();
    this.input = new Input();
    this.audio = new AudioEngine();
    this.hud = new Hud();
    this.minimap = new Minimap(document.getElementById('minimap'));
    this.state = STATES.TITLE;
    this.collected = new Set();
    this.time = 0;
    this.alerts = 0;
    this.bottlesUsed = 0;
    this.t = 0; // waktu dunia (animasi ambient)
    this.winGrade = null;
    this.loseReason = '';
    this.lastTime = 0;
    this.shotMode = null;
    window.__pageErrors = [];
    window.addEventListener('error', (e) => window.__pageErrors.push(String(e.message || e.error)));
    window.addEventListener('unhandledrejection', (e) => window.__pageErrors.push('rejection: ' + String(e.reason)));
  }

  reset() {
    this.collected.clear();
    this.time = 0;
    this.alerts = 0;
    this.bottlesUsed = 0;
    this.winGrade = null;
    this.loseReason = '';
    this.player.reset();
    for (const g of this.guards) g.reset();
    this.cat.reset();
    this.world.resetPotions();
    this.bottle.active = false;
    this.bottle.mesh.visible = false;
    this.autopilot.start();
    this.hud.hideEnd();
  }

  startPlay() {
    this.reset();
    this.state = STATES.PLAY;
    this.hud.showPlay();
    this.hud.showToast('Curi 3 ramuan lalu kabur lewat EXIT — jangan sampai terlihat!', 4);
    this.audio.ensure();
  }

  toTitle() {
    this.state = STATES.TITLE;
    this.autopilot.stop();
    this.hud.showTitle();
  }

  grade() {
    if (this.time <= RULES.gradeS && this.alerts === 0) return 'S';
    if (this.time <= RULES.gradeA && this.alerts <= 1) return 'A';
    if (this.time <= RULES.gradeB) return 'B';
    return 'C';
  }

  win() {
    this.state = STATES.WIN;
    this.winGrade = this.grade();
    this.autopilot.stop();
    this.audio.win();
    this.hud.showEnd(true, this.winGrade, {
      time: this.time, alerts: this.alerts, bottlesUsed: this.bottlesUsed, collected: 3,
    });
  }

  lose(reason) {
    this.state = STATES.LOSE;
    this.loseReason = reason;
    this.autopilot.stop();
    this.audio.lose();
    this.hud.showEnd(false, null, {
      time: this.time, alerts: this.alerts, bottlesUsed: this.bottlesUsed,
      collected: this.collected.size, reason,
    });
  }

  // Dipanggil autopilot & tombol E.
  interact() {
    if (this.state !== STATES.PLAY) return;
    // Ramuan terdekat?
    for (const p of POTIONS) {
      if (this.collected.has(p.id)) continue;
      if (Math.hypot(p.x - this.player.x, p.z - this.player.z) < RULES.interactRadius) {
        this.collected.add(p.id);
        this.world.hidePotion(p.id);
        this.audio.pickup();
        this.hud.showToast(`✓ ${p.name} berhasil dicuri! (${this.collected.size}/3)`, 3);
        return;
      }
    }
    // Pintu EXIT?
    if (Math.hypot(EXIT.x - this.player.x, EXIT.z - this.player.z) < RULES.interactRadius) {
      if (this.collected.size >= 3) {
        this.audio.exit();
        this.win();
      } else {
        this.hud.showToast(`Pintu EXIT terkunci — curi dulu ${3 - this.collected.size} ramuan lagi!`, 2.5);
      }
    }
  }

  drinkInvisibility() {
    if (this.state !== STATES.PLAY) return;
    if (this.player.drinkInvisibility()) {
      this.audio.potion();
      this.hud.showToast('👻 Kamu tembus pandang 3 detik!', 2);
    } else if (this.player.invisDoses <= 0) {
      this.hud.showToast('Dosis tembus pandang habis!', 2);
    }
  }

  throwBottle() {
    if (this.state !== STATES.PLAY) return;
    if (this.player.distractions <= 0) {
      this.hud.showToast('Botol cahaya habis!', 2);
      return;
    }
    this.player.distractions -= 1;
    this.bottlesUsed += 1;
    const target = this.player.throwTarget();
    this.bottle.throwTo(target.x, target.z);
    this.audio.throwBottle();
    for (const g of this.guards) {
      const d = Math.hypot(g.x - target.x, g.z - target.z);
      if (d < RULES.distractionRange) g.investigate(target.x, target.z);
    }
    this.hud.showToast('🍼 Botol cahaya dilempar — penjaga menyelidiki bunyinya!', 2.5);
  }

  // Satu langkah simulasi murni (tanpa render). Dipakai loop rAF & burst shot.
  update(dt) {
    this.t += dt;
    this.world.update(this.t, dt);
    const dummy = { x: 9999, z: 9999, invisible: 1, inSmoke: false, sneaking: false };
    if (this.state === STATES.TITLE) {
      // Latar hidup di balik layar judul: penjaga patroli, kucing menyapu.
      for (const g of this.guards) g.update(dt, dummy, this.t, () => {});
      this.cat.update(dt, this.t, dummy, () => {});
      return;
    }
    if (this.state === STATES.WIN || this.state === STATES.LOSE) {
      for (const g of this.guards) g.update(dt, dummy, this.t, () => {});
      this.cat.update(dt, this.t, dummy, () => {});
      this.bottle.update(dt);
      return;
    }
    // ---- PLAY ----
    this.time += dt;
    // Gerak: autopilot atau keyboard.
    let mv;
    if (this.autopilot.enabled) {
      mv = this.autopilot.update(dt, this);
    } else {
      const ax = this.input.axis();
      mv = { x: ax.x, z: ax.z, sneak: this.input.sneak() };
    }
    this.player.move(mv.x, mv.z, dt, mv.sneak, this.t, (sneak) => { if (!sneak) this.audio.step(); });
    this.player.update(dt, this.t);
    // Penjaga + kucing.
    const onSpotted = (guard, kind) => {
      if (kind === 'alert') {
        this.alerts += 1;
        this.audio.alert();
        this.hud.showToast(`🚨 ${guard.name} melihatmu! LARI atau sembunyi di asap!`, 2.5);
      } else {
        this.audio.suspicious();
      }
    };
    for (const g of this.guards) g.update(dt, this.player, this.t, onSpotted);
    this.cat.update(dt, this.t, this.player, (pos) => {
      this.alerts += 1;
      this.audio.alert();
      this.hud.showToast('🐱 Mimi si Kucing melihatmu dan mengeong keras!', 2.5);
      // Golem terdekat menyelidiki posisi pemain.
      let best = null, bd = Infinity;
      for (const g of this.guards) {
        const d = Math.hypot(g.x - this.player.x, g.z - this.player.z);
        if (d < bd) { bd = d; best = g; }
      }
      if (best) best.investigate(pos.x, pos.z);
    });
    this.bottle.update(dt);
    // Tertangkap? Penjaga alert yang sampai di samping pemain.
    if (this.player.invisible <= 0 && !this.player.inSmoke) {
      for (const g of this.guards) {
        if (g.state === GUARD_STATES.ALERT
          && Math.hypot(g.x - this.player.x, g.z - this.player.z) < RULES.catchRadius) {
          this.lose(`${g.name} menangkapmu di tengah apotek.`);
          break;
        }
      }
    }
    // Tombol sekali-tekan (hanya untuk pemain manusia).
    if (!this.autopilot.enabled) {
      if (this.input.wasPressed('e') || this.input.wasPressed('E')) this.interact();
      if (this.input.wasPressed('q') || this.input.wasPressed('Q')) this.throwBottle();
      if (this.input.wasPressed('f') || this.input.wasPressed('F')) this.drinkInvisibility();
    }
    if (this.input.wasPressed('m') || this.input.wasPressed('M')) {
      this.audio.ensure();
      const muted = this.audio.toggleMute();
      this.hud.showToast(muted ? '🔇 Suara dimatikan' : '🔊 Suara dihidupkan', 1.5);
    }
    if (this.input.wasPressed('r') || this.input.wasPressed('R')) this.startPlay();
    this.input.endFrame();
    // Prompt interaksi kontekstual — hanya saat bermain (bukan di layar akhir).
    if (this.state !== STATES.PLAY) {
      this.hud.setPrompt('');
      this.input.endFrame();
      this.hud.update(this, dt);
      this.minimap.draw(this);
      return;
    }
    let prompt = '';
    for (const p of POTIONS) {
      if (!this.collected.has(p.id)
        && Math.hypot(p.x - this.player.x, p.z - this.player.z) < RULES.interactRadius) {
        prompt = `Tekan E — ambil ${p.name}`;
        break;
      }
    }
    if (!prompt && Math.hypot(EXIT.x - this.player.x, EXIT.z - this.player.z) < RULES.interactRadius) {
      prompt = this.collected.size >= 3 ? 'Tekan E — KABUR LEWAT EXIT!' : `EXIT terkunci — ${3 - this.collected.size} ramuan lagi`;
    }
    this.hud.setPrompt(prompt);
    this.hud.update(this, dt);
    this.minimap.draw(this);
  }

  frame(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000 || 0.016));
    this.lastTime = now;
    // Tombol global di semua state.
    if (this.state === STATES.TITLE && (this.input.wasPressed('Enter') || this.input.wasPressed(' '))) {
      this.audio.ensure();
      this.startPlay();
    } else if ((this.state === STATES.WIN || this.state === STATES.LOSE)
      && (this.input.wasPressed('Enter') || this.input.wasPressed('r') || this.input.wasPressed('R'))) {
      this.audio.ensure();
      this.startPlay();
    }
    this.update(dt);
    this.render.render();
    this.input.endFrame();
  }

  start() {
    this.lastTime = performance.now();
    const loop = (now) => { this.frame(now); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
}

export { GAME_TITLE, TEXTS };
