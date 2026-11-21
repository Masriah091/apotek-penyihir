// player.js — Penyihir pencuri: gerak, menyelinap, tembus pandang, asap, botol pengalih.

import * as THREE from 'three';
import { RULES, PLAYER_START, CAULDRONS } from './config.js';
import { collideCircle, inSmoke } from './level.js';

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.x = PLAYER_START.x;
    this.z = PLAYER_START.z;
    this.angle = -Math.PI / 2; // menghadap atas (ke -z)
    this.speed = 0;
    this.sneaking = false;
    this.invisible = 0; // detik tersisa tembus pandang
    this.invisDoses = RULES.invisDoses;
    this.distractions = RULES.distractionCount;
    this.inSmoke = false;
    this.moving = false;
    this.stepTimer = 0;
    this.buildMesh();
  }

  buildMesh() {
    const g = new THREE.Group();
    // Jubah biru + topi penyihir kuning terang — pemain harus mudah dikenali.
    const robeMat = new THREE.MeshStandardMaterial({ color: 0x2f6fb2, roughness: 0.8 });
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 12), robeMat);
    robe.position.y = 0.55; robe.castShadow = true;
    g.add(robe);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xf5c9a0, roughness: 0.7 }));
    head.position.y = 1.25; head.castShadow = true;
    g.add(head);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.7, 12),
      new THREE.MeshStandardMaterial({ color: 0x1a2a6e, roughness: 0.8 }));
    hat.position.y = 1.65; hat.castShadow = true;
    g.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 12),
      new THREE.MeshStandardMaterial({ color: 0x1a2a6e, roughness: 0.8 }));
    brim.position.y = 1.38; brim.castShadow = true;
    g.add(brim);
    // Lampion kecil di tangan (cahaya kuning = pemain terlihat).
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffd34d, emissive: 0xffb347, emissiveIntensity: 2.0 }));
    lamp.position.set(0.35, 0.9, 0.15);
    g.add(lamp);
    this.lampLight = new THREE.PointLight(0xffd34d, 5, 4, 1.8);
    this.lampLight.position.set(0.35, 1.0, 0.15);
    g.add(this.lampLight);
    // Cincin hijau terang di bawah pemain (penanda posisi).
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.66, 28),
      new THREE.MeshBasicMaterial({ color: 0x39ff88, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    g.add(ring);
    this.ring = ring;
    // Panah kecil di atas kepala.
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.35, 4),
      new THREE.MeshBasicMaterial({ color: 0x39ff88 }));
    arrow.position.y = 2.25;
    arrow.rotation.x = Math.PI; // ujung ke bawah
    g.add(arrow);
    this.arrow = arrow;
    g.position.set(this.x, 0, this.z);
    this.mesh = g;
    this.scene.add(g);
  }

  reset() {
    this.x = PLAYER_START.x;
    this.z = PLAYER_START.z;
    this.angle = -Math.PI / 2;
    this.invisible = 0;
    this.invisDoses = RULES.invisDoses;
    this.distractions = RULES.distractionCount;
    this.inSmoke = false;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.visible = true;
    this.mesh.traverse((o) => { if (o.material) o.material.transparent = false; });
    this.ring.material.opacity = 0.9;
  }

  // ax, az: arah gerak ternormalisasi (atau 0,0). Kembalikan apakah melangkah.
  move(ax, az, dt, sneak, t, onStep) {
    this.sneaking = sneak;
    this.moving = (ax !== 0 || az !== 0);
    if (!this.moving) { this.speed = 0; return; }
    const speed = sneak ? RULES.sneakSpeed : RULES.playerSpeed;
    this.speed = speed;
    const nx = this.x + ax * speed * dt;
    const nz = this.z + az * speed * dt;
    const fixed = collideCircle(nx, nz, RULES.playerRadius);
    this.x = fixed.x; this.z = fixed.z;
    this.angle = Math.atan2(az, ax);
    this.mesh.position.x = this.x;
    this.mesh.position.z = this.z;
    this.mesh.rotation.y = Math.PI / 2 - this.angle;
    // Goyang jubah saat berjalan.
    this.mesh.position.y = Math.abs(Math.sin(t * (sneak ? 6 : 10))) * (sneak ? 0.02 : 0.05);
    // Bunyi langkah (jarang saat menyelinap).
    this.stepTimer -= dt;
    if (this.stepTimer <= 0) {
      this.stepTimer = sneak ? 0.55 : 0.34;
      if (onStep) onStep(sneak);
    }
  }

  update(dt, t) {
    this.inSmoke = inSmoke(this.x, this.z, t);
    if (this.invisible > 0) {
      this.invisible = Math.max(0, this.invisible - dt);
      // Tembus pandang: badan nyaris tak terlihat, cincin tetap samar.
      this.mesh.traverse((o) => {
        if (o.material && o !== this.ring) {
          o.material.transparent = true;
          o.material.opacity = 0.25;
        }
      });
      this.ring.material.opacity = 0.3;
      this.lampLight.intensity = 1;
    } else {
      this.mesh.traverse((o) => {
        if (o.material && o !== this.ring) {
          o.material.transparent = false;
          o.material.opacity = 1;
        }
      });
      this.ring.material.opacity = 0.9;
      this.lampLight.intensity = 5;
    }
    // Panah di atas kepala berdenyut pelan.
    this.arrow.position.y = 2.25 + Math.sin(t * 3) * 0.08;
    this.arrow.rotation.y += dt * 2;
  }

  drinkInvisibility() {
    if (this.invisDoses <= 0 || this.invisible > 0) return false;
    this.invisDoses -= 1;
    this.invisible = RULES.invisDuration;
    return true;
  }

  // Arah lempar botol: ke arah hadap, mendarat ~4 meter di depan.
  throwTarget() {
    return {
      x: this.x + Math.cos(this.angle) * 4,
      z: this.z + Math.sin(this.angle) * 4,
    };
  }
}

// Botol cahaya yang dilempar: mendarat, berpendar, menarik penjaga.
export class DistractionBottle {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.x = 0; this.z = 0;
    this.timer = 0;
    this.mesh = new THREE.Group();
    const bottle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffe14d, emissive: 0xffe14d, emissiveIntensity: 1.8 }));
    bottle.position.y = 0.2;
    this.mesh.add(bottle);
    this.light = new THREE.PointLight(0xffe14d, 8, 5, 1.8);
    this.light.position.y = 0.5;
    this.mesh.add(this.light);
    this.mesh.visible = false;
    this.scene.add(this.mesh);
  }

  throwTo(x, z) {
    const fixed = collideCircle(x, z, 0.3);
    this.x = fixed.x; this.z = fixed.z;
    this.timer = RULES.distractionTime;
    this.active = true;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.visible = true;
  }

  update(dt) {
    if (!this.active) return;
    this.timer -= dt;
    this.light.intensity = 6 + Math.sin(this.timer * 10) * 3;
    if (this.timer <= 0) {
      this.active = false;
      this.mesh.visible = false;
    }
  }
}
