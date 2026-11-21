// autopilot.js — Pemain otomatis untuk screenshot: memainkan aturan ASLI dari state
// segar (A* di grid + menunggu ancaman + minum tembus pandang saat terdesak).
// Tidak ada override: ia hanya menekan tombol yang sama seperti pemain manusia.

import { LEVEL, POTIONS, EXIT, CAULDRONS, RULES } from './config.js';
import { collideCircle } from './level.js';

const CELL = 0.5; // Grid halus 0,5 m: celah antar-rak (lebar 1,6 m, berpusat di
// koordinat setengah) hanya bisa dilewati grid 0,5 — grid 1 m membuat
// area atas (z < -5) tak terjangkau dan A* mengembalikan null.
const GX0 = -LEVEL.halfW, GZ0 = -LEVEL.halfD;
const GW = Math.round((LEVEL.halfW * 2) / CELL) + 1, GD = Math.round((LEVEL.halfD * 2) / CELL) + 1;

function cellWalkable(cx, cz) {
  if (cx < 0 || cz < 0 || cx >= GW || cz >= GD) return false;
  const wx = GX0 + cx * CELL, wz = GZ0 + cz * CELL;
  const fixed = collideCircle(wx, wz, 0.55);
  return Math.abs(fixed.x - wx) < 0.01 && Math.abs(fixed.z - wz) < 0.01;
}

function astar(sx, sz, tx, tz, danger) {
  const key = (x, z) => z * GW + x;
  const open = [{ x: sx, z: sz, g: 0, f: 0, parent: null }];
  const best = new Map([[key(sx, sz), 0]]);
  const closed = new Set();
  const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [1, -1, 1.41], [-1, 1, 1.41], [-1, -1, 1.41]];
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.x === tx && cur.z === tz) {
      const path = [];
      let n = cur;
      while (n) { path.unshift({ x: GX0 + n.x * CELL, z: GZ0 + n.z * CELL }); n = n.parent; }
      return path;
    }
    closed.add(key(cur.x, cur.z));
    for (const [dx, dz, cost] of dirs) {
      const nx = cur.x + dx, nz = cur.z + dz;
      if (!cellWalkable(nx, nz)) continue;
      if (dx !== 0 && dz !== 0 && (!cellWalkable(cur.x + dx, cur.z) || !cellWalkable(cur.x, cur.z + dz))) continue;
      const k = key(nx, nz);
      if (closed.has(k)) continue;
      const dPen = danger ? danger(GX0 + nx * CELL, GZ0 + nz * CELL) : 0;
      const g = cur.g + cost + dPen;
      if (best.has(k) && best.get(k) <= g) continue;
      best.set(k, g);
      const h = Math.hypot(tx - nx, tz - nz);
      open.push({ x: nx, z: nz, g, f: g + h, parent: cur });
    }
  }
  return null;
}

export class Autopilot {
  constructor() {
    this.enabled = false;
    this.path = [];
    this.replanTimer = 0;
    this.waitTimer = 0;
    this.stuckTimer = 0;
    this.lastPos = null;
    this.targetId = null;
  }

  start() {
    this.enabled = true;
    this.path = [];
    this.replanTimer = 0;
    this.waitTimer = 0;
    this.targetId = null;
  }

  stop() { this.enabled = false; }

  // Urutan curi: Waktu (kiri atas) -> Naga (tengah) -> Bayangan (kanan atas) -> EXIT.
  currentTarget(game) {
    for (const id of ['waktu', 'naga', 'bayangan']) {
      if (!game.collected.has(id)) return POTIONS.find((p) => p.id === id);
    }
    return { id: 'exit', x: EXIT.x, z: EXIT.z, name: 'EXIT' };
  }

  nearestSmoke(x, z) {
    let best = CAULDRONS[0], bd = Infinity;
    for (const c of CAULDRONS) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  // Ancaman: penjaga yang sedang melihat / hampir melihat pemain.
  threatLevel(game) {
    const p = game.player;
    let level = 0;
    for (const g of game.guards) {
      const d = Math.hypot(g.x - p.x, g.z - p.z);
      if (g.state === 'alert') level = Math.max(level, 3);
      else if (g.state === 'suspicious') level = Math.max(level, 2);
      else if (d < 4.5) {
        const see = g.canSee(p.x, p.z, p);
        if (see.seen) level = Math.max(level, 2);
        else if (d < 3.2) level = Math.max(level, 1);
      }
    }
    if (game.cat.state === 'alert') level = Math.max(level, 3);
    else if (game.cat.state === 'suspicious') level = Math.max(level, 2);
    return level;
  }

  update(dt, game) {
    if (!this.enabled) return { x: 0, z: 0, sneak: false };
    const p = game.player;
    const threat = this.threatLevel(game);
    const maxSuspicion = Math.max(0, ...game.guards.map((g) => g.suspicion), game.cat.suspicion);

    // Terdesak: minum ramuan tembus pandang bila meter tinggi & dosis ada.
    if (maxSuspicion > 0.55 && p.invisDoses > 0 && p.invisible <= 0) {
      game.drinkInvisibility();
    }
    // Bila ada yang mengejar: lari ke asap kuali terdekat dan diam di sana.
    if (threat >= 3) {
      const s = this.nearestSmoke(p.x, p.z);
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (d > 1.2) {
        const dx = s.x - p.x, dz = s.z - p.z;
        const len = Math.hypot(dx, dz);
        return { x: dx / len, z: dz / len, sneak: false };
      }
      return { x: 0, z: 0, sneak: true };
    }
    // Ancaman sedang & pemain terlihat: berhenti, menyelinap, tunggu lewat.
    if (threat >= 2 && !p.inSmoke) {
      this.waitTimer += dt;
      if (this.waitTimer > 2.5 && p.invisDoses > 0 && p.invisible <= 0) game.drinkInvisibility();
      return { x: 0, z: 0, sneak: true };
    }
    this.waitTimer = 0;

    // Tujuan: ramuan berikutnya / EXIT.
    const target = this.currentTarget(game);
    const distT = Math.hypot(target.x - p.x, target.z - p.z);
    if (target.id !== 'exit' && distT < RULES.interactRadius) {
      game.interact();
      return { x: 0, z: 0, sneak: false };
    }
    if (target.id === 'exit' && distT < RULES.interactRadius) {
      game.interact();
      return { x: 0, z: 0, sneak: false };
    }

    // Replan berkala dengan biaya bahaya di sekitar penjaga.
    this.replanTimer -= dt;
    const needReplan = this.replanTimer <= 0 || this.path.length === 0 || this.targetId !== target.id;
    if (needReplan) {
      this.replanTimer = 0.7;
      this.targetId = target.id;
      const danger = (x, z) => {
        let pen = 0;
        for (const g of game.guards) {
          const d = Math.hypot(g.x - x, g.z - z);
          if (d < 3.5) pen += (3.5 - d) * 3;
        }
        const cd = Math.hypot(game.cat.x - x, game.cat.z - z);
        if (cd < 3.5) pen += (3.5 - cd) * 3;
        return pen;
      };
      const sx = Math.round((p.x - GX0) / CELL), sz = Math.round((p.z - GZ0) / CELL);
      const tx = Math.round((target.x - GX0) / CELL), tz = Math.round((target.z - GZ0) / CELL);
      this.path = astar(sx, sz, tx, tz, danger) || [];
    }
    // Ikuti path; buang node yang sudah dilewati.
    while (this.path.length > 1) {
      const n0 = this.path[0];
      if (Math.hypot(n0.x - p.x, n0.z - p.z) < 0.6) this.path.shift();
      else break;
    }
    if (!this.path.length) return { x: 0, z: 0, sneak: false };
    const node = this.path[0];
    const dx = node.x - p.x, dz = node.z - p.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.15) { this.path.shift(); return { x: 0, z: 0, sneak: false }; }
    // Menyelinap bila penjaga dekat (kurang dari 4m) agar meter naik pelan.
    const nearGuard = game.guards.some((g) => Math.hypot(g.x - p.x, g.z - p.z) < 4.0)
      || Math.hypot(game.cat.x - p.x, game.cat.z - p.z) < 4.0;
    return { x: dx / len, z: dz / len, sneak: nearGuard };
  }
}
