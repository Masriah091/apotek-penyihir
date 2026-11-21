// shots.js — Mode screenshot deterministik via ?shot=.
// start  = layar judul (adegan hidup di belakang)
// play   = autopilot berjalan 8 detik dari state segar
// climax = autopilot diburst sampai 1 ramuan dicuri + ada penjaga curiga (maks 26 dtk)
// end    = autopilot diburst sampai MENANG dengan aturan asli (maks 200 dtk)
// Burst menjalankan update(1/60) sinkron tanpa render — cepat & deterministik.

import { Game, STATES } from './main.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot') || 'start';

const canvas = document.getElementById('game');
const game = new Game(canvas);
window.__game = game;
window.__shot = shot;

function burst(seconds, stopWhen) {
  const steps = Math.ceil(seconds * 60);
  for (let i = 0; i < steps; i++) {
    game.update(1 / 60);
    if (stopWhen && stopWhen()) break;
    if (game.state === STATES.WIN || game.state === STATES.LOSE) break;
  }
}

if (shot === 'play') {
  game.shotMode = 'play';
  game.startPlay();
  burst(8);
} else if (shot === 'climax') {
  game.shotMode = 'climax';
  game.startPlay();
  // Berhenti di tengah permainan: 2 ramuan sudah dicuri, 1 lagi + EXIT menanti.
  burst(26, () => game.collected.size >= 2);
  if (game.collected.size >= 2) {
    game.hud.showToast('◆ 2 ramuan dicuri — 1 lagi, lalu kabur ke EXIT!', 99);
  }
} else if (shot === 'end') {
  game.shotMode = 'end';
  game.startPlay();
  burst(200, () => game.state === STATES.WIN);
  if (game.state !== STATES.WIN) {
    // Autopilot gagal menang dalam batas: laporkan lewat judul halaman (bukan override).
    document.title = 'AUTOPILOT-GAGAL-MENANG state=' + game.state + ' collected=' + game.collected.size;
  }
} else {
  game.shotMode = 'start';
  game.toTitle();
}

window.__shotDone = true;
game.start();
