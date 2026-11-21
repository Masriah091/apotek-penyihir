// config.js — Semua data statis Apotek Penyihir: palet, level, penjaga, ramuan.
// Satu-satunya tempat angka level ditulis; file lain hanya membaca dari sini.

export const GAME_TITLE = 'APOTEK PENYIHIR';
export const GAME_SUBTITLE = 'Ramuan Terlarang';
export const BOUNTY_SLUG = 'best-stealth-game-20261121-1759';

// Ukuran arena (satuan meter game). x: -13..13, z: -9..9.
export const LEVEL = { halfW: 13, halfD: 9, wallH: 3.2, wallT: 1.0 };

export const PALETTE = {
  floorA: 0x3a2b4d, floorB: 0x2e2140, floorLine: 0x241a33,
  wall: 0x4a3560, wallTop: 0x5d4478, wood: 0x6b4a2f, woodDark: 0x4a3018,
  shelf: 0x5a3a6e, shelfTop: 0x7a4a9e, shelfGold: 0xc9a227,
  curtain: 0x6e1e6e, curtainDark: 0x4a1450,
  cauldron: 0x1e1e26, cauldronRim: 0x3a3a4a, smoke: 0x9fe8a8,
  potionTime: 0x7fd4ff, potionShadow: 0xb46bff, potionDragon: 0xff5a3c,
  exit: 0x39d353, exitGlow: 0x7dff9e,
  player: 0xffd34d, playerRobe: 0x2f6fb2, ring: 0x39ff88,
  golem: 0x8a7a5a, golemDark: 0x5d4f38, golemEye: 0xff3b30,
  cat: 0x1a1a22, catEye: 0xffe14d,
  candle: 0xffb347, candleFlame: 0xffd76a,
};

// Rintangan kotak (AABB): x, z pusat; hx, hz setengah ukuran; los = menghalangi
// garis pandang; kind dipakai render.js untuk memilih bentuk mesh.
export const OBSTACLES = [
  // Rak ramuan horizontal, baris atas (di bawah ramuan pojok).
  { x: -9.5, z: -5.5, hx: 2.2, hz: 0.7, los: true, kind: 'shelf' },
  { x: -3.5, z: -5.5, hx: 2.2, hz: 0.7, los: true, kind: 'shelf' },
  { x: 3.5, z: -5.5, hx: 2.2, hz: 0.7, los: true, kind: 'shelf' },
  { x: 9.5, z: -5.5, hx: 2.2, hz: 0.7, los: true, kind: 'shelf' },
  // Rak vertikal sisi.
  { x: -9.5, z: -1.0, hx: 0.7, hz: 2.0, los: true, kind: 'shelf' },
  { x: 9.5, z: -1.0, hx: 0.7, hz: 2.0, los: true, kind: 'shelf' },
  // Rak horizontal tengah.
  { x: -3.5, z: 1.5, hx: 2.2, hz: 0.7, los: true, kind: 'shelf' },
  { x: 3.5, z: 1.5, hx: 2.2, hz: 0.7, los: true, kind: 'shelf' },
  // Rak bawah.
  { x: -6.5, z: 5.5, hx: 2.0, hz: 0.7, los: true, kind: 'shelf' },
  { x: 6.5, z: 5.5, hx: 2.0, hz: 0.7, los: true, kind: 'shelf' },
  // Rak tinggi tempat kucing familiar bertengger (tengah atas).
  { x: 0, z: -7.2, hx: 1.6, hz: 0.6, los: true, kind: 'catshelf' },
  // Meja kayu.
  { x: -6.5, z: -2.5, hx: 1.6, hz: 0.9, los: true, kind: 'table' },
  { x: 6.5, z: -2.5, hx: 1.6, hz: 0.9, los: true, kind: 'table' },
  { x: 0, z: 3.5, hx: 2.0, hz: 1.0, los: true, kind: 'table' },
  // Tirai ungu (tipis, tinggi, menghalangi pandang).
  { x: -2.5, z: -6.5, hx: 0.25, hz: 1.5, los: true, kind: 'curtain' },
  { x: 2.5, z: -6.5, hx: 0.25, hz: 1.5, los: true, kind: 'curtain' },
  { x: -11.5, z: 0.5, hx: 0.25, hz: 1.6, los: true, kind: 'curtain' },
];

// Kuali berasap: lingkaran rintangan gerak (tidak menghalangi pandang, rendah)
// + zona asap tempat pemain sulit terlihat.
export const CAULDRONS = [
  { x: -5.0, z: 2.8, r: 0.95, smokeR: 2.3 },
  { x: 5.0, z: -0.5, r: 0.95, smokeR: 2.3 },
  { x: 0.0, z: 5.8, r: 0.95, smokeR: 2.3 },
];

// Tiga ramuan yang harus dicuri.
export const POTIONS = [
  { id: 'waktu', name: 'Ramuan Waktu', color: PALETTE.potionTime, x: -11.5, z: -7.5 },
  { id: 'bayangan', name: 'Ramuan Bayangan', color: PALETTE.potionShadow, x: 11.5, z: -7.5 },
  { id: 'naga', name: 'Ramuan Naga', color: PALETTE.potionDragon, x: 0, z: -4.2 },
];

export const PLAYER_START = { x: -11.5, z: 7.5 };
export const EXIT = { x: 11.5, z: 7.5, r: 1.3 };

// Empat golem patroli. Waypoint hanya di ruang terbuka (tidak menembus rak).
export const GUARDS = [
  {
    name: 'Golem Batu', color: 0x9a8a6a, speed: 1.55, range: 6.5,
    waypoints: [[-11, -3], [-11, 3], [-6, 3], [-6, -3]],
  },
  {
    name: 'Golem Lumut', color: 0x7a9a5a, speed: 1.5, range: 6.5,
    waypoints: [[11, -3], [11, 3], [6, 3], [6, -3]],
  },
  {
    name: 'Golem Tanah', color: 0x8a6a4a, speed: 1.65, range: 7.0,
    waypoints: [[-8, 7], [8, 7], [8, 4.2], [-8, 4.2]],
  },
  {
    name: 'Golem Akar', color: 0x6a7a5a, speed: 1.45, range: 6.0,
    waypoints: [[-2, -3.2], [2, -3.2], [2, 0.2], [-2, 0.2]],
  },
];

// Kucing familiar: diam di rak tinggi, kerucutnya menyapu perlahan.
export const CAT = {
  name: 'Mimi si Kucing', x: 0, z: -7.2, range: 5.5,
  sweepAmp: 1.25, sweepSpeed: 0.55, baseAngle: Math.PI / 2, // menghadap +z (ke bawah layar)
};

export const CANDLES = [
  { x: -8, z: -7 }, { x: 8, z: -7 }, { x: -11, z: 7 }, { x: 11, z: 0 },
  { x: 0, z: -2 }, { x: -4, z: 6 }, { x: 4, z: 6 }, { x: -11.5, z: -7.5 },
];

// Aturan main (angka penyeimbang — game harus bisa dimenangkan).
export const RULES = {
  playerSpeed: 3.4, sneakSpeed: 1.8, playerRadius: 0.42,
  guardRadius: 0.55, catchRadius: 0.95,
  coneHalfAngle: 0.56, // ~32 derajat
  detectGainClose: 0.55, detectGainFar: 0.28, detectDecay: 0.45,
  suspiciousAt: 0.35, alertAt: 0.75,
  chaseSpeedMul: 1.7, searchTime: 4.0, loseSightTime: 2.5,
  smokeGainMul: 0.15, smokeRangeMul: 0.55, sneakGainMul: 0.55,
  invisDuration: 3.0, invisDoses: 2,
  distractionCount: 3, distractionRange: 6.0, distractionTime: 4.0,
  interactRadius: 1.5,
  gradeS: 120, gradeA: 160, gradeB: 220, // detik
};

// Pesan-pesan HUD.
export const TEXTS = {
  goal: 'Curi Ramuan Waktu, Ramuan Bayangan, dan Ramuan Naga, lalu kabur lewat pintu EXIT — tanpa terlihat satu pun penjaga.',
  winHint: 'Ketiga ramuan di tanganmu dan kamu lolos lewat EXIT.',
  loseHint: 'Penjaga menangkapmu, atau asap kuali menelanmu.',
  howto: 'Berdiri diam di zona gelap atau di balik rak membuatmu hampir tak terlihat. Minum ramuan tembus pandang (F) saat terdesak. Lempar botol cahaya (Q) untuk mengalihkan penjaga. Asap kuali menyembunyikanmu — berdiri di dalamnya saat penjaga lewat.',
  controls: 'WASD / Panah — bergerak · Shift — menyelinap pelan & sunyi · E — ambil / interaksi · Q — lempar botol cahaya · F — minum ramuan tembus pandang · M — mute · R — restart',
};
