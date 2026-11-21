// guards.js — Golem patroli + kucing familiar: mesin status, kerucut visi, tabrakan.
// Status: patrol -> suspicious (?) -> alert (!) -> search -> patrol.
// Penjaga hanya bergerak sepanjang waypoint di ruang terbuka + tabrakan circle-vs-AABB,
// jadi tidak pernah menembus dinding/rak.

import * as THREE from 'three';
import { GUARDS, CAT, RULES, OBSTACLES, CAULDRONS, LEVEL } from './config.js';
import { collideCircle, lineOfSightBlocked, inSmoke, smokeCenter } from './level.js';

export const GUARD_STATES = { PATROL: 'patrol', SUSPICIOUS: 'suspicious', ALERT: 'alert', SEARCH: 'search' };

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function stateColor(state) {
  if (state === GUARD_STATES.ALERT) return 0xff3b30;
  if (state === GUARD_STATES.SUSPICIOUS || state === GUARD_STATES.SEARCH) return 0xff9500;
  return 0xffe14d;
}

export class Guard {
  constructor(cfg, scene, index) {
    this.name = cfg.name;
    this.index = index;
    this.color = cfg.color;
    this.speed = cfg.speed;
    this.range = cfg.range;
    this.waypoints = cfg.waypoints;
    this.wpIndex = 0;
    this.x = cfg.waypoints[0][0];
    this.z = cfg.waypoints[0][1];
    this.angle = 0; // arah hadap (radian, 0 = +x, PI/2 = +z)
    this.state = GUARD_STATES.PATROL;
    this.suspicion = 0; // meter 0..1 (milik penjaga ini)
    this.lastSeen = null;
    this.searchTimer = 0;
    this.loseTimer = 0;
    this.investigateTarget = null;
    this.waitTimer = 0;
    this.scene = scene;
    this.buildMesh();
  }

  buildMesh() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.9 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.9 });
    // Badan golem: balok batu besar + kepala + bahu lumut.
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.5, 0.6), bodyMat);
    body.position.y = 0.95; body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.45), darkMat);
    head.position.y = 1.9; head.castShadow = true;
    g.add(head);
    const moss = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.65),
      new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 1 }));
    moss.position.y = 1.72; moss.castShadow = true;
    g.add(moss);
    // Mata merah berpendar.
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 2.5 });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.05), eyeMat);
      eye.position.set(s * 0.12, 1.92, 0.24);
      g.add(eye);
    }
    // Lengan batu.
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.1, 0.22), bodyMat);
      arm.position.set(s * 0.56, 0.95, 0); arm.castShadow = true;
      g.add(arm);
    }
    // Tanda status mengambang (? / !) — sprite teks dari canvas.
    this.mark = this.makeMarkSprite();
    this.mark.position.y = 2.6;
    g.add(this.mark);
    // Kerucut visi: kipas segitiga datar tembus pandang di lantai.
    const coneGeo = new THREE.BufferGeometry();
    const segs = 18;
    const verts = [0, 0.06, 0];
    for (let i = 0; i <= segs; i++) {
      const a = -0.56 + (i / segs) * 1.12; // RULES.coneHalfAngle
      verts.push(Math.sin(a) * this.range, 0.06, Math.cos(a) * this.range);
    }
    const idx = [];
    for (let i = 1; i <= segs; i++) idx.push(0, i, i + 1);
    coneGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    coneGeo.setIndex(idx);
    coneGeo.computeVertexNormals();
    this.coneMat = new THREE.MeshBasicMaterial({
      color: 0xffe14d, transparent: true, opacity: 0.22,
      side: THREE.DoubleSide, depthWrite: false,
    });
    this.cone = new THREE.Mesh(coneGeo, this.coneMat);
    // Kerucut menghadap +z lokal; putar grup sesuai angle.
    this.coneGroup = new THREE.Group();
    this.coneGroup.add(this.cone);
    this.scene.add(this.coneGroup);
    g.position.set(this.x, 0, this.z);
    this.mesh = g;
    this.scene.add(g);
  }

  makeMarkSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText('?', 32, 34);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.9, 0.9, 1);
    sprite.visible = false;
    sprite.userData = { canvas, ctx, tex };
    return sprite;
  }

  setMark(char, color) {
    if (!char) { this.mark.visible = false; return; }
    const { canvas, ctx, tex } = this.mark.userData;
    ctx.clearRect(0, 0, 64, 64);
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(char, 32, 34);
    ctx.fillStyle = color;
    ctx.fillText(char, 32, 34);
    tex.needsUpdate = true;
    this.mark.visible = true;
  }

  // Apakah penjaga ini bisa melihat pemain sekarang?
  canSee(px, pz, player) {
    if (player.invisible > 0) return { seen: false, gain: 0 };
    const dx = px - this.x, dz = pz - this.z;
    const dist = Math.hypot(dx, dz);
    let range = this.range;
    if (player.inSmoke) range *= RULES.smokeRangeMul;
    if (dist > range) return { seen: false, gain: 0 };
    const targetAngle = Math.atan2(dz, dx);
    // angle penjaga memakai konvensi atan2(dz,dx) juga (lihat update).
    const diff = Math.abs(angleDiff(targetAngle, this.angle));
    if (diff > RULES.coneHalfAngle) return { seen: false, gain: 0 };
    if (lineOfSightBlocked(this.x, this.z, px, pz)) return { seen: false, gain: 0 };
    const closeness = 1 - dist / range; // 0 jauh .. 1 dekat
    let gain = RULES.detectGainFar + (RULES.detectGainClose - RULES.detectGainFar) * closeness;
    if (player.inSmoke) gain *= RULES.smokeGainMul;
    if (player.sneaking) gain *= RULES.sneakGainMul;
    return { seen: true, gain };
  }

  update(dt, player, t, onSpotted) {
    const prevState = this.state;
    const see = this.canSee(player.x, player.z, player);
    if (see.seen) {
      this.suspicion = Math.min(1, this.suspicion + see.gain * dt);
      this.lastSeen = { x: player.x, z: player.z };
      this.loseTimer = 0;
    } else {
      this.suspicion = Math.max(0, this.suspicion - RULES.detectDecay * dt * 0.5);
      if (this.lastSeen) this.loseTimer += dt;
    }
    if (this.suspicion >= RULES.alertAt && this.state !== GUARD_STATES.ALERT) {
      this.state = GUARD_STATES.ALERT;
      this.searchTimer = 0;
      onSpotted(this, 'alert');
    } else if (this.suspicion >= RULES.suspiciousAt && this.state === GUARD_STATES.PATROL) {
      this.state = GUARD_STATES.SUSPICIOUS;
      onSpotted(this, 'suspicious');
    }
    if (this.state === GUARD_STATES.ALERT && this.loseTimer > RULES.loseSightTime) {
      this.state = GUARD_STATES.SEARCH;
      this.searchTimer = RULES.searchTime;
    }
    // Gerakan per status.
    let target = null;
    let speed = 0;
    if (this.state === GUARD_STATES.PATROL) {
      const wp = this.waypoints[this.wpIndex];
      target = { x: wp[0], z: wp[1] };
      speed = this.speed;
      if (Math.hypot(wp[0] - this.x, wp[1] - this.z) < 0.25) {
        this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
      }
    } else if (this.state === GUARD_STATES.SUSPICIOUS) {
      if (this.lastSeen) { target = this.lastSeen; speed = this.speed * 1.25; }
      if (!this.lastSeen || Math.hypot(this.lastSeen.x - this.x, this.lastSeen.z - this.z) < 0.6) {
        if (this.suspicion < RULES.suspiciousAt) { this.state = GUARD_STATES.PATROL; this.lastSeen = null; }
      }
    } else if (this.state === GUARD_STATES.ALERT) {
      if (this.lastSeen) { target = this.lastSeen; speed = this.speed * RULES.chaseSpeedMul; }
      // Kalau pemain terlihat, kejar posisi pemain langsung.
      if (see.seen) { target = { x: player.x, z: player.z }; speed = this.speed * RULES.chaseSpeedMul; }
    } else if (this.state === GUARD_STATES.SEARCH) {
      this.searchTimer -= dt;
      // Berputar di tempat mengawasi sekitar titik terakhir terlihat.
      this.angle += dt * 1.4;
      if (this.searchTimer <= 0) {
        this.state = GUARD_STATES.PATROL;
        this.lastSeen = null;
        this.suspicion = Math.max(0, this.suspicion - 0.3);
      }
    }
    if (this.investigateTarget && this.state === GUARD_STATES.PATROL) {
      target = this.investigateTarget;
      speed = this.speed * 1.2;
      if (Math.hypot(target.x - this.x, target.z - this.z) < 0.5) {
        this.investigateTarget = null;
        this.waitTimer = 1.5;
      }
    }
    if (this.waitTimer > 0) {
      this.waitTimer -= dt;
      target = null;
    }
    if (target) {
      const dx = target.x - this.x, dz = target.z - this.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.05) {
        const want = Math.atan2(dz, dx);
        // Belok halus ke arah target.
        let d = angleDiff(want, this.angle);
        const turn = Math.max(-3.2 * dt, Math.min(3.2 * dt, d));
        this.angle += turn;
        const step = Math.min(speed * dt, dist);
        const nx = this.x + Math.cos(this.angle) * step;
        const nz = this.z + Math.sin(this.angle) * step;
        const fixed = collideCircle(nx, nz, RULES.guardRadius);
        this.x = fixed.x; this.z = fixed.z;
        this.mesh.position.x = this.x;
        this.mesh.position.z = this.z;
        // Animasi jalan: goyang badan.
        this.mesh.position.y = Math.abs(Math.sin(t * 6 + this.index)) * 0.05;
        this.mesh.rotation.y = -this.angle + Math.PI / 2;
      }
    }
    // Kerucut mengikuti posisi + arah hadap. Cone mesh dibuat menghadap +z
    // lokal; arah hadap dunia = angle (atan2 dz,dx) -> rotasi y = PI/2 - angle.
    this.coneGroup.position.set(this.x, 0, this.z);
    this.coneGroup.rotation.y = Math.PI / 2 - this.angle;
    const col = stateColor(this.state);
    this.coneMat.color.setHex(col);
    this.coneMat.opacity = this.state === GUARD_STATES.ALERT ? 0.32 : 0.2;
    // Tanda ? / !
    if (this.state === GUARD_STATES.ALERT) this.setMark('!', '#ff3b30');
    else if (this.state === GUARD_STATES.SUSPICIOUS || this.state === GUARD_STATES.SEARCH) this.setMark('?', '#ff9500');
    else this.setMark(null);
    if (prevState !== this.state && this.state === GUARD_STATES.ALERT) this.alertPulse = 1;
    return { stateChanged: prevState !== this.state, state: this.state };
  }

  // Dipanggil saat botol pengalih dilempar: penjaga menyelidiki titik itu.
  investigate(x, z) {
    if (this.state === GUARD_STATES.ALERT) return;
    this.investigateTarget = { x, z };
    this.state = GUARD_STATES.SUSPICIOUS;
    this.suspicion = Math.max(this.suspicion, RULES.suspiciousAt);
    this.lastSeen = { x, z };
  }

  reset() {
    const wp = this.waypoints[0];
    this.x = wp[0]; this.z = wp[1];
    this.wpIndex = 0;
    this.angle = 0;
    this.state = GUARD_STATES.PATROL;
    this.suspicion = 0;
    this.lastSeen = null;
    this.investigateTarget = null;
    this.searchTimer = 0; this.loseTimer = 0; this.waitTimer = 0;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = 0;
  }
}

// ---- Kucing familiar: diam di rak, kerucut menyapu; bila melihat pemain,
// penjaga golem terdekat jadi curiga ke posisi pemain. ----
export class CatFamiliar {
  constructor(scene) {
    this.name = CAT.name;
    this.x = CAT.x; this.z = CAT.z;
    this.range = CAT.range;
    this.angle = CAT.baseAngle;
    this.suspicion = 0;
    this.state = 'patrol';
    this.scene = scene;
    this.buildMesh();
  }

  buildMesh() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: CAT.cat, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), mat);
    body.scale.set(1, 0.75, 1.3);
    body.position.y = 2.85; body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), mat);
    head.position.set(0, 3.05, 0.32); head.castShadow = true;
    g.add(head);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 4), mat);
      ear.position.set(s * 0.11, 3.24, 0.32);
      g.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8),
        new THREE.MeshStandardMaterial({ color: CAT.catEye, emissive: CAT.catEye, emissiveIntensity: 2.5 }));
      eye.position.set(s * 0.08, 3.07, 0.5);
      g.add(eye);
    }
    // Ekor melengkung.
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 0.5, 8), mat);
    tail.position.set(0, 2.95, -0.4);
    tail.rotation.x = 0.7;
    g.add(tail);
    g.position.set(this.x, 0, this.z);
    this.mesh = g;
    this.scene.add(g);
    // Kerucut visi kucing (lebih sempit, ungu).
    const segs = 14;
    const verts = [0, 0.06, 0];
    for (let i = 0; i <= segs; i++) {
      const a = -0.42 + (i / segs) * 0.84;
      verts.push(Math.sin(a) * this.range, 0.06, Math.cos(a) * this.range);
    }
    const idx = [];
    for (let i = 1; i <= segs; i++) idx.push(0, i, i + 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    this.coneMat = new THREE.MeshBasicMaterial({
      color: 0xb46bff, transparent: true, opacity: 0.18,
      side: THREE.DoubleSide, depthWrite: false,
    });
    this.cone = new THREE.Mesh(geo, this.coneMat);
    this.coneGroup = new THREE.Group();
    this.coneGroup.add(this.cone);
    this.coneGroup.position.set(this.x, 0, this.z);
    this.scene.add(this.coneGroup);
    this.mark = null;
  }

  update(dt, t, player, onCatSpotted) {
    // Menyapu perlahan kiri-kanan.
    this.angle = CAT.baseAngle + Math.sin(t * CAT.sweepSpeed) * CAT.sweepAmp;
    this.mesh.rotation.y = Math.PI / 2 - this.angle; // kucing menghadap arah sapuan
    this.coneGroup.rotation.y = Math.PI / 2 - this.angle;
    // Lihat pemain?
    let seen = false;
    if (player.invisible <= 0) {
      const dx = player.x - this.x, dz = player.z - this.z;
      const dist = Math.hypot(dx, dz);
      if (dist < this.range) {
        const diff = Math.abs(angleDiff(Math.atan2(dz, dx), this.angle));
        if (diff < 0.42 && !lineOfSightBlocked(this.x, this.z, player.x, player.z)) {
          let gain = 0.5;
          if (player.inSmoke) gain *= RULES.smokeGainMul;
          if (player.sneaking) gain *= RULES.sneakGainMul;
          this.suspicion = Math.min(1, this.suspicion + gain * dt);
          seen = true;
        }
      }
    }
    if (!seen) this.suspicion = Math.max(0, this.suspicion - 0.3 * dt);
    const wasAlert = this.state === 'alert';
    this.state = this.suspicion >= RULES.alertAt ? 'alert'
      : this.suspicion >= RULES.suspiciousAt ? 'suspicious' : 'patrol';
    this.coneMat.color.setHex(this.state === 'alert' ? 0xff3b30 : this.state === 'suspicious' ? 0xff9500 : 0xb46bff);
    this.coneMat.opacity = this.state === 'alert' ? 0.3 : 0.18;
    if (this.state === 'alert' && !wasAlert) onCatSpotted({ x: player.x, z: player.z });
  }

  reset() {
    this.suspicion = 0;
    this.state = 'patrol';
  }
}

// Bangun semua penjaga + kucing.
export function createGuards(scene) {
  const guards = GUARDS.map((cfg, i) => new Guard(cfg, scene, i));
  const cat = new CatFamiliar(scene);
  return { guards, cat };
}
