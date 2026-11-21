// level.js — Arena apotek: tabrakan, garis pandang, zona asap, dan semua mesh 3D.
// Geometri dibangun dari data config.js; tidak ada angka level yang ditulis di sini.

import * as THREE from 'three';
import { LEVEL, PALETTE, OBSTACLES, CAULDRONS, POTIONS, EXIT, CANDLES, CAT } from './config.js';

// ---- Geometri / tabrakan (2D, sumbu x-z) ----

// Uji ruas garis (ax,az)-(bx,bz) terhadap satu AABB. Slab test 2D.
export function segmentHitsBox(ax, az, bx, bz, o) {
  const dx = bx - ax, dz = bz - az;
  let tmin = 0, tmax = 1;
  for (const [p, d, c, h] of [[ax, dx, o.x, o.hx], [az, dz, o.z, o.hz]]) {
    if (Math.abs(d) < 1e-9) { if (Math.abs(p - c) > h) return false; }
    else {
      let t1 = (c - h - p) / d, t2 = (c + h - p) / d;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
  }
  return true;
}

// Apakah garis pandang dari (ax,az) ke (bx,bz) terhalang rak/meja/tirai/dinding?
export function lineOfSightBlocked(ax, az, bx, bz) {
  for (const o of OBSTACLES) {
    if (o.los && segmentHitsBox(ax, az, bx, bz, o)) return true;
  }
  // Dinding luar: ruas yang keluar dari arena pasti menembus dinding.
  const W = LEVEL.halfW, D = LEVEL.halfD;
  if (bx < -W || bx > W || bz < -D || bz > D) return true;
  return false;
}

// Geser lingkaran (x,z,r) keluar dari dinding, kotak, dan kuali. Kembalikan posisi baru.
export function collideCircle(x, z, r) {
  const W = LEVEL.halfW, D = LEVEL.halfD;
  x = Math.max(-W + r, Math.min(W - r, x));
  z = Math.max(-D + r, Math.min(D - r, z));
  for (const o of OBSTACLES) {
    const cx = Math.max(o.x - o.hx, Math.min(o.x + o.hx, x));
    const cz = Math.max(o.z - o.hz, Math.min(o.z + o.hz, z));
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r; z = cz + (dz / d) * r;
      } else {
        // Pusat tepat di dalam kotak: dorong keluar lewat sisi terdekat.
        const pushL = (x - (o.x - o.hx)) + r, pushR = ((o.x + o.hx) - x) + r;
        const pushT = (z - (o.z - o.hz)) + r, pushB = ((o.z + o.hz) - z) + r;
        const m = Math.min(pushL, pushR, pushT, pushB);
        if (m === pushL) x = o.x - o.hx - r;
        else if (m === pushR) x = o.x + o.hx + r;
        else if (m === pushT) z = o.z - o.hz - r;
        else z = o.z + o.hz + r;
      }
    }
  }
  for (const c of CAULDRONS) {
    const dx = x - c.x, dz = z - c.z;
    const rr = r + c.r;
    const d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-9) {
      const d = Math.sqrt(d2);
      x = c.x + (dx / d) * rr; z = c.z + (dz / d) * rr;
    }
  }
  return { x, z };
}

// Posisi pusat asap kuali ke-i pada waktu t (asap bergerak perlahan).
export function smokeCenter(i, t) {
  const c = CAULDRONS[i];
  return {
    x: c.x + Math.sin(t * 0.35 + i * 2.1) * 0.45,
    z: c.z + Math.cos(t * 0.27 + i * 1.3) * 0.45,
    r: c.smokeR,
  };
}

export function inSmoke(x, z, t) {
  for (let i = 0; i < CAULDRONS.length; i++) {
    const s = smokeCenter(i, t);
    const dx = x - s.x, dz = z - s.z;
    if (dx * dx + dz * dz < s.r * s.r) return true;
  }
  return false;
}

// ---- Bangun dunia 3D ----

export class World {
  constructor(scene) {
    this.scene = scene;
    this.smokePuffs = [];
    this.potionMeshes = new Map();
    this.potionLights = new Map();
    this.exitMesh = null;
    this.exitLight = null;
    this.candleFlames = [];
    this.buildFloor();
    this.buildWalls();
    this.buildObstacles();
    this.buildCauldrons();
    this.buildPotions();
    this.buildExit();
    this.buildCandles();
    this.buildDecor();
  }

  mat(color, opts = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...opts });
  }

  box(x, y, z, w, h, d, material, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    (parent || this.scene).add(m);
    return m;
  }

  buildFloor() {
    const W = LEVEL.halfW, D = LEVEL.halfD;
    // Ubin catur ungu gelap.
    const tile = 2;
    const geoA = new THREE.BoxGeometry(tile, 0.2, tile);
    const matA = this.mat(PALETTE.floorA);
    const matB = this.mat(PALETTE.floorB);
    for (let ix = -W; ix < W; ix += tile) {
      for (let iz = -D; iz < D; iz += tile) {
        const m = new THREE.Mesh(geoA, ((ix / tile + iz / tile) % 2 === 0) ? matA : matB);
        m.position.set(ix + tile / 2, -0.1, iz + tile / 2);
        m.receiveShadow = true;
        this.scene.add(m);
      }
    }
    // Karpet ungu tua di tengah arena.
    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 6),
      new THREE.MeshStandardMaterial({ color: 0x4a1e4a, roughness: 1 }),
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.02, 0.5);
    rug.receiveShadow = true;
    this.scene.add(rug);
    const rugEdge = new THREE.Mesh(
      new THREE.PlaneGeometry(10.6, 6.6),
      new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.9 }),
    );
    rugEdge.rotation.x = -Math.PI / 2;
    rugEdge.position.set(0, 0.01, 0.5);
    rugEdge.receiveShadow = true;
    this.scene.add(rugEdge);
  }

  buildWalls() {
    const W = LEVEL.halfW, D = LEVEL.halfD, H = LEVEL.wallH, T = LEVEL.wallT;
    const wallMat = this.mat(PALETTE.wall);
    const topMat = this.mat(PALETTE.wallTop);
    // Utara & selatan.
    this.box(0, H / 2, -D - T / 2, W * 2 + T * 2, H, T, wallMat);
    this.box(0, H / 2, D + T / 2, W * 2 + T * 2, H, T, wallMat);
    // Timur & barat.
    this.box(-W - T / 2, H / 2, 0, T, H, D * 2, wallMat);
    this.box(W + T / 2, H / 2, 0, T, H, D * 2, wallMat);
    // Lis emas di atas dinding.
    this.box(0, H + 0.06, -D - T / 2, W * 2 + T * 2, 0.12, T + 0.1, topMat);
    this.box(0, H + 0.06, D + T / 2, W * 2 + T * 2, 0.12, T + 0.1, topMat);
    this.box(-W - T / 2, H + 0.06, 0, T + 0.1, 0.12, D * 2, topMat);
    this.box(W + T / 2, H + 0.06, 0, T + 0.1, 0.12, D * 2, topMat);
  }

  buildObstacles() {
    const shelfMat = this.mat(PALETTE.shelf);
    const shelfTopMat = this.mat(PALETTE.shelfTop);
    const woodMat = this.mat(PALETTE.wood);
    const woodDarkMat = this.mat(PALETTE.woodDark);
    const curtainMat = this.mat(PALETTE.curtain, { roughness: 1 });
    const goldMat = this.mat(PALETTE.shelfGold, { metalness: 0.6, roughness: 0.35 });
    for (const o of OBSTACLES) {
      const w = o.hx * 2, d = o.hz * 2;
      if (o.kind === 'shelf' || o.kind === 'catshelf') {
        const h = o.kind === 'catshelf' ? 2.6 : 2.0;
        this.box(o.x, h / 2, o.z, w, h, d, shelfMat);
        this.box(o.x, h + 0.06, o.z, w + 0.15, 0.12, d + 0.15, shelfTopMat);
        // Botol-botol kecil warna-warni di rak.
        const n = Math.max(2, Math.floor(w / 0.9));
        for (let i = 0; i < n; i++) {
          const bx = o.x - w / 2 + 0.4 + (i * (w - 0.8)) / Math.max(1, n - 1);
          const col = [0x7fd4ff, 0xb46bff, 0xff5a3c, 0x9fe8a8, 0xffd34d][(i + o.x * 3) % 5 < 0 ? 0 : (i + Math.abs(Math.floor(o.x))) % 5];
          const bottle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.09, 0.11, 0.42, 8),
            new THREE.MeshStandardMaterial({ color: col, roughness: 0.2, metalness: 0.1, emissive: col, emissiveIntensity: 0.25 }),
          );
          bottle.position.set(bx, h + 0.35, o.z + (d > 1 ? 0 : 0));
          bottle.castShadow = true;
          this.scene.add(bottle);
        }
        // Papan nama rak.
        if (o.kind === 'catshelf') {
          const sign = this.box(o.x, 2.2, o.z + o.hz + 0.03, 2.2, 0.5, 0.06, goldMat);
          sign.castShadow = false;
        }
      } else if (o.kind === 'table') {
        this.box(o.x, 0.45, o.z, w, 0.9, d, woodMat);
        this.box(o.x, 0.95, o.z, w + 0.2, 0.12, d + 0.2, woodDarkMat);
        // Peralatan di atas meja: buku & botol.
        const book = this.box(o.x - w / 4, 1.12, o.z, 0.5, 0.14, 0.35, this.mat(0x7a2a3a));
        book.rotation.y = 0.4;
        const flask = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 10, 8),
          new THREE.MeshStandardMaterial({ color: 0x9fe8a8, emissive: 0x9fe8a8, emissiveIntensity: 0.5, roughness: 0.2 }),
        );
        flask.position.set(o.x + w / 4, 1.18, o.z);
        flask.castShadow = true;
        this.scene.add(flask);
      } else if (o.kind === 'curtain') {
        this.box(o.x, 1.5, o.z, w, 3.0, d, curtainMat);
        this.box(o.x, 3.05, o.z, w + 0.1, 0.12, d + 0.1, goldMat);
      }
    }
  }

  buildCauldrons() {
    for (let i = 0; i < CAULDRONS.length; i++) {
      const c = CAULDRONS[i];
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(c.r, 16, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
        this.mat(PALETTE.cauldron, { roughness: 0.4, metalness: 0.5 }),
      );
      body.position.set(c.x, 0.55, c.z);
      body.castShadow = true; body.receiveShadow = true;
      this.scene.add(body);
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(c.r * 0.98, 0.09, 8, 20),
        this.mat(PALETTE.cauldronRim, { roughness: 0.35, metalness: 0.6 }),
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.set(c.x, 0.62, c.z);
      rim.castShadow = true;
      this.scene.add(rim);
      // Permukaan cairan hijau berpendar.
      const brew = new THREE.Mesh(
        new THREE.CircleGeometry(c.r * 0.85, 20),
        new THREE.MeshStandardMaterial({ color: 0x39d353, emissive: 0x2fae4a, emissiveIntensity: 0.9, roughness: 0.2 }),
      );
      brew.rotation.x = -Math.PI / 2;
      brew.position.set(c.x, 0.58, c.z);
      this.scene.add(brew);
      // Api hijau di bawah kuali.
      const fire = new THREE.PointLight(0x39d353, 12, 7, 1.8);
      fire.position.set(c.x, 1.0, c.z);
      this.scene.add(fire);
      // Gumpalan asap: bola-bola tembus pandang yang berdenyut.
      for (let j = 0; j < 7; j++) {
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry(0.55 + (j % 3) * 0.18, 10, 8),
          new THREE.MeshStandardMaterial({
            color: PALETTE.smoke, transparent: true, opacity: 0.16,
            roughness: 1, depthWrite: false,
          }),
        );
        const ang = (j / 7) * Math.PI * 2;
        puff.position.set(c.x + Math.cos(ang) * 0.8, 1.1 + (j % 3) * 0.45, c.z + Math.sin(ang) * 0.8);
        puff.userData = { baseY: puff.position.y, phase: j * 0.9, cauldron: i };
        this.scene.add(puff);
        this.smokePuffs.push(puff);
      }
      // Cakram lantai penanda zona asap (samar).
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(c.smokeR, 28),
        new THREE.MeshBasicMaterial({ color: 0x9fe8a8, transparent: true, opacity: 0.07, depthWrite: false }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(c.x, 0.04, c.z);
      this.scene.add(disc);
    }
  }

  buildPotions() {
    for (const p of POTIONS) {
      const group = new THREE.Group();
      // Pedestal batu.
      const ped = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.55, 0.9, 10),
        this.mat(0x6a5a7a, { roughness: 0.7 }),
      );
      ped.position.y = 0.45; ped.castShadow = true; ped.receiveShadow = true;
      group.add(ped);
      // Botol ramuan berpendar.
      const bottle = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 14, 12),
        new THREE.MeshStandardMaterial({
          color: p.color, emissive: p.color, emissiveIntensity: 0.9,
          roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.95,
        }),
      );
      bottle.position.y = 1.35;
      bottle.castShadow = true;
      group.add(bottle);
      const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.12, 0.3, 8),
        this.mat(0xc9a227, { metalness: 0.7, roughness: 0.3 }),
      );
      neck.position.y = 1.68;
      group.add(neck);
      // Cincin cahaya di lantai sekitar ramuan.
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.7, 0.85, 28),
        new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      group.add(ring);
      const light = new THREE.PointLight(p.color, 10, 6, 1.8);
      light.position.y = 1.6;
      group.add(light);
      group.position.set(p.x, 0, p.z);
      this.scene.add(group);
      this.potionMeshes.set(p.id, group);
      this.potionLights.set(p.id, light);
    }
  }

  buildExit() {
    const g = new THREE.Group();
    // Gapura pintu hijau di dinding selatan (dekat pojok kanan bawah).
    const frameMat = this.mat(0x2a7a3a, { roughness: 0.5 });
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.6, 0.5), frameMat);
    left.position.set(-0.85, 1.3, 0); left.castShadow = true;
    const right = left.clone(); right.position.x = 0.85;
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.35, 0.5), frameMat);
    top.position.set(0, 2.6, 0); top.castShadow = true;
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 2.4),
      new THREE.MeshStandardMaterial({ color: PALETTE.exit, emissive: PALETTE.exit, emissiveIntensity: 0.75, roughness: 0.3 }),
    );
    door.position.set(0, 1.25, -0.1);
    g.add(left, right, top, door);
    // Cincin EXIT di lantai.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.0, 1.3, 28),
      new THREE.MeshBasicMaterial({ color: PALETTE.exit, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.05, 0.9);
    g.add(ring);
    const light = new THREE.PointLight(PALETTE.exitGlow, 16, 9, 1.6);
    light.position.set(0, 2.0, 0.8);
    g.add(light);
    g.position.set(EXIT.x, 0, LEVEL.halfD - 0.15);
    this.scene.add(g);
    this.exitMesh = g;
    this.exitLight = light;
  }

  buildCandles() {
    for (const c of CANDLES) {
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.09, 0.5, 8),
        this.mat(0xf5e6c8, { roughness: 0.6 }),
      );
      stick.position.set(c.x, 0.25, c.z);
      stick.castShadow = true;
      this.scene.add(stick);
      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 8, 8),
        new THREE.MeshStandardMaterial({ color: PALETTE.candleFlame, emissive: 0xff9a1e, emissiveIntensity: 2.2 }),
      );
      flame.position.set(c.x, 0.62, c.z);
      flame.scale.y = 1.6;
      flame.userData = { phase: c.x * 1.7 + c.z };
      this.scene.add(flame);
      this.candleFlames.push(flame);
      const light = new THREE.PointLight(PALETTE.candle, 6, 6, 1.8);
      light.position.set(c.x, 0.9, c.z);
      this.scene.add(light);
    }
  }

  buildDecor() {
    // Jendela bulan di dinding utara + berkas cahaya.
    const moon = new THREE.Mesh(
      new THREE.CircleGeometry(0.9, 24),
      new THREE.MeshBasicMaterial({ color: 0xdfe8ff }),
    );
    moon.position.set(-6, 5.2, -LEVEL.halfD - 0.45);
    this.scene.add(moon);
    const beam = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 8),
      new THREE.MeshBasicMaterial({ color: 0x8fa8ff, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.set(-6, 2.2, -6);
    beam.rotation.x = 0.5;
    this.scene.add(beam);
    // Buku-buku melayang (hiasan apotek penyihir) di sudut.
    const bookMat = this.mat(0x7a2a3a);
    for (let i = 0; i < 5; i++) {
      const b = this.box(-12 + i * 0.7, 2.2 + (i % 2) * 0.3, -8.2, 0.5, 0.12, 0.35, bookMat);
      b.rotation.y = 0.3 * i;
      b.userData = { floatPhase: i * 1.2, floatY: b.position.y };
    }
  }

  // Animasi ambient: asap naik-turun, api lilin berkedip, ramuan berdenyut.
  update(t, dt) {
    for (const p of this.smokePuffs) {
      p.position.y = p.userData.baseY + Math.sin(t * 0.8 + p.userData.phase) * 0.25;
      p.material.opacity = 0.13 + Math.sin(t * 0.6 + p.userData.phase) * 0.05;
    }
    for (const f of this.candleFlames) {
      const s = 1.5 + Math.sin(t * 9 + f.userData.phase) * 0.18;
      f.scale.y = s;
    }
    for (const [id, g] of this.potionMeshes) {
      const bottle = g.children[1];
      if (bottle) {
        bottle.position.y = 1.35 + Math.sin(t * 2 + id.length) * 0.08;
        bottle.rotation.y += dt * 0.8;
      }
    }
    if (this.exitLight) this.exitLight.intensity = 15 + Math.sin(t * 2.4) * 3;
  }

  hidePotion(id) {
    const g = this.potionMeshes.get(id);
    if (g) g.visible = false;
  }

  resetPotions() {
    for (const g of this.potionMeshes.values()) g.visible = true;
  }
}
