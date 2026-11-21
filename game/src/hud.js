// hud.js — Semua teks & panel DOM: HUD, strip status penjaga, toast, layar TITLE/WIN/LOSE.
// Layar overlay dibuat tembus pandang di tepi agar adegan 3D tetap memenuhi frame.

import { GAME_TITLE, GAME_SUBTITLE, TEXTS, POTIONS, RULES } from './config.js';

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export class Hud {
  constructor() {
    this.el = {};
    for (const id of ['hud', 'stats', 'meterBox', 'meterFill', 'meterLabel', 'guardStrip',
      'toast', 'prompt', 'titleScreen', 'endScreen', 'endKicker', 'endTitle', 'endGrade',
      'endStats', 'endNote', 'endButton', 'muteBtn', 'minimap', 'smokeTag', 'invisTag']) {
      this.el[id] = document.getElementById(id);
    }
    this.toastTimer = 0;
  }

  showToast(text, dur = 3) {
    this.el.toast.textContent = text;
    this.el.toast.style.opacity = '1';
    this.toastTimer = dur;
  }

  setPrompt(text) {
    this.el.prompt.textContent = text || '';
    this.el.prompt.style.opacity = text ? '1' : '0';
  }

  update(game, dt) {
    const g = game;
    // Panel statistik kiri atas.
    const names = POTIONS.map((p) => g.collected.has(p.id) ? `✓ ${p.name}` : `○ ${p.name}`).join(' · ');
    this.el.stats.innerHTML =
      `◆ ${g.collected.size}/3 Ramuan &nbsp;·&nbsp; ${fmtTime(g.time)}<br>` +
      `<span style="font-size:12px;color:#cbb8e8">${names}</span><br>` +
      `🧪 Tembus pandang: ${g.player.invisDoses} dosis &nbsp;·&nbsp; 🍼 Botol: ${g.player.distractions}<br>` +
      `<span style="font-size:12px;color:#9fe8a8">${g.player.inSmoke ? '☁️ Di dalam asap kuali — sulit terlihat' : ''}</span>`;
    // Meter deteksi (maksimum semua penjaga + kucing).
    const meter = Math.max(0, ...g.guards.map((x) => x.suspicion), g.cat.suspicion);
    const pct = Math.round(meter * 100);
    this.el.meterFill.style.width = `${pct}%`;
    this.el.meterFill.style.background = meter >= RULES.alertAt ? '#ff3b30'
      : meter >= RULES.suspiciousAt ? '#ff9500' : '#39d353';
    this.el.meterLabel.textContent = meter >= RULES.alertAt ? 'TERLIHAT!'
      : meter >= RULES.suspiciousAt ? 'CURIGA…' : meter > 0.05 ? 'TERSEMBUNYI' : 'TERSEMBUNYI';
    // Strip status penjaga bernama.
    this.el.guardStrip.innerHTML = g.guards.map((x) => {
      const mark = x.state === 'alert' ? '!' : x.state === 'suspicious' || x.state === 'search' ? '?' : '○';
      const cls = x.state === 'alert' ? 'alert' : x.state === 'suspicious' || x.state === 'search' ? 'susp' : '';
      return `<span class="${cls}">${x.name} ${mark}</span>`;
    }).join(' · ') + ` · <span class="${g.cat.state === 'alert' ? 'alert' : g.cat.state === 'suspicious' ? 'susp' : ''}">Mimi si Kucing ${g.cat.state === 'alert' ? '!' : g.cat.state === 'suspicious' ? '?' : '○'}</span>`;
    // Tag tembus pandang.
    this.el.invisTag.style.display = g.player.invisible > 0 ? 'inline-block' : 'none';
    if (g.player.invisible > 0) this.el.invisTag.textContent = `👻 TEMBUS PANDANG ${g.player.invisible.toFixed(1)} dtk`;
    // Toast memudar.
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el.toast.style.opacity = '0';
    }
    // Tombol mute.
    this.el.muteBtn.textContent = g.audio.muted ? '🔇 Suara: MATI (M)' : '🔊 Suara: HIDUP (M)';
  }

  showTitle() {
    this.el.titleScreen.style.display = 'flex';
    this.el.endScreen.style.display = 'none';
    this.el.hud.style.display = 'none';
  }

  showPlay() {
    this.el.titleScreen.style.display = 'none';
    this.el.endScreen.style.display = 'none';
    this.el.hud.style.display = 'block';
  }

  showEnd(win, grade, stats) {
    this.el.titleScreen.style.display = 'none';
    this.el.endScreen.style.display = 'flex';
    this.el.hud.style.display = 'block';
    this.setPrompt('');
    this.el.toast.style.opacity = '0';
    if (win) {
      this.el.endKicker.textContent = 'PENCURIAN BERHASIL';
      this.el.endTitle.textContent = 'Kamu Lolos!';
      this.el.endTitle.style.color = '#ffd34d';
      this.el.endGrade.textContent = grade;
      this.el.endGrade.style.display = 'block';
      this.el.endStats.innerHTML =
        `Waktu: ${fmtTime(stats.time)} &nbsp;·&nbsp; Ketahuan: ${stats.alerts}x<br>` +
        `Ramuan: 3/3 &nbsp;·&nbsp; Botol dipakai: ${stats.bottlesUsed}`;
      this.el.endNote.textContent = 'Ramuan Waktu, Ramuan Bayangan & Ramuan Naga berhasil dicuri.';
      this.el.endButton.textContent = 'Tekan R atau ENTER untuk main lagi';
    } else {
      this.el.endKicker.textContent = 'PENCURIAN GAGAL';
      this.el.endTitle.textContent = 'GAME OVER';
      this.el.endTitle.style.color = '#ff5a5a';
      this.el.endGrade.style.display = 'none';
      this.el.endStats.innerHTML =
        `Waktu: ${fmtTime(stats.time)} &nbsp;·&nbsp; Ketahuan: ${stats.alerts}x<br>` +
        `Ramuan: ${stats.collected}/3`;
      this.el.endNote.textContent = stats.reason || 'Penjaga golem menangkapmu di tengah apotek.';
      this.el.endButton.textContent = 'Tekan R atau ENTER untuk coba lagi';
    }
  }

  hideEnd() {
    this.el.endScreen.style.display = 'none';
  }
}

export { GAME_TITLE, GAME_SUBTITLE, TEXTS, fmtTime };
