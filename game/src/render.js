// render.js — Renderer Three.js, kamera oblique top-down, pencahayaan, minimap 2D.

import * as THREE from 'three';
import { LEVEL, OBSTACLES, CAULDRONS, POTIONS, EXIT, GUARDS, CAT } from './config.js';

export class RenderEngine {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(1280, 800, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x140d1e);
    this.scene.fog = new THREE.Fog(0x140d1e, 34, 60);

    // Kamera oblique top-down: memenuhi frame 1280x800 dengan arena 26x18.
    this.camera = new THREE.PerspectiveCamera(46, 1280 / 800, 0.1, 120);
    this.camera.position.set(0, 21.5, 11.5);
    this.camera.lookAt(0, 0, 0.4);
    this.buildLights();
  }

  buildLights() {
    // 1) Cahaya ambient ungu redup.
    this.scene.add(new THREE.AmbientLight(0x6a5a8a, 0.85));
    // 2) Cahaya bulan biru dari jendela utara (dengan bayangan).
    const moon = new THREE.DirectionalLight(0x9ab4ff, 1.4);
    moon.position.set(-8, 18, -12);
    moon.target.position.set(2, 0, 2);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = -18; moon.shadow.camera.right = 18;
    moon.shadow.camera.top = 14; moon.shadow.camera.bottom = -14;
    moon.shadow.camera.far = 50;
    moon.shadow.bias = -0.0004;
    this.scene.add(moon);
    this.scene.add(moon.target);
    // 3) Lampu gantung hangat di tengah arena.
    const chandelier = new THREE.PointLight(0xffc46a, 55, 26, 1.7);
    chandelier.position.set(0, 7.5, 0.5);
    chandelier.castShadow = true;
    chandelier.shadow.mapSize.set(1024, 1024);
    chandelier.shadow.bias = -0.0004;
    this.scene.add(chandelier);
    // 4) Cahaya lilin hijau racun di sudut kanan atas.
    const poison = new THREE.PointLight(0x7dff5a, 22, 14, 1.7);
    poison.position.set(11, 3.5, -7);
    this.scene.add(poison);
    // 5) Cahaya ungu di sudut kiri atas.
    const violet = new THREE.PointLight(0xb46bff, 20, 14, 1.7);
    violet.position.set(-11, 3.5, -7);
    this.scene.add(violet);
  }

  resize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

// ---- Minimap 2D (canvas DOM, sudut kanan bawah) ----
export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  draw(game) {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(20,12,28,0.9)';
    ctx.fillRect(0, 0, W, H);
    const sx = W / (LEVEL.halfW * 2 + 4);
    const sz = H / (LEVEL.halfD * 2 + 4);
    const toX = (x) => (x + LEVEL.halfW + 2) * sx;
    const toZ = (z) => (z + LEVEL.halfD + 2) * sz;
    // Lantai.
    ctx.fillStyle = '#3a2b4d';
    ctx.fillRect(toX(-LEVEL.halfW), toZ(-LEVEL.halfD), LEVEL.halfW * 2 * sx, LEVEL.halfD * 2 * sz);
    // Rak/meja/tirai.
    ctx.fillStyle = '#8a6aae';
    for (const o of OBSTACLES) {
      ctx.fillRect(toX(o.x - o.hx), toZ(o.z - o.hz), o.hx * 2 * sx, o.hz * 2 * sz);
    }
    // Kuali (asap).
    ctx.fillStyle = '#39d353';
    for (const c of CAULDRONS) {
      ctx.beginPath();
      ctx.arc(toX(c.x), toZ(c.z), c.smokeR * sx, 0, Math.PI * 2);
      ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1;
    }
    // EXIT.
    ctx.fillStyle = '#39d353';
    ctx.fillRect(toX(EXIT.x - 0.8), toZ(EXIT.z - 0.8), 1.6 * sx, 1.6 * sz);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', toX(EXIT.x), toZ(EXIT.z) + 3);
    ctx.textAlign = 'left';
    // Ramuan tersisa.
    for (const p of POTIONS) {
      if (game.collected.has(p.id)) continue;
      ctx.fillStyle = '#' + p.color.toString(16).padStart(6, '0');
      ctx.beginPath();
      ctx.arc(toX(p.x), toZ(p.z), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Kerucut visi penjaga (segitiga samar).
    for (const g of game.guards) {
      const col = g.state === 'alert' ? '#ff3b30' : g.state === 'suspicious' ? '#ff9500' : '#ffe14d';
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(toX(g.x), toZ(g.z));
      const a0 = Math.atan2(Math.sin(g.angle + 0.56), Math.cos(g.angle + 0.56));
      const a1 = Math.atan2(Math.sin(g.angle - 0.56), Math.cos(g.angle - 0.56));
      // Gambar kipas dengan sudut dunia (x kanan, z bawah = sudut atan2(dz,dx)).
      ctx.lineTo(toX(g.x + Math.cos(g.angle + 0.56) * g.range), toZ(g.z + Math.sin(g.angle + 0.56) * g.range));
      ctx.lineTo(toX(g.x + Math.cos(g.angle - 0.56) * g.range), toZ(g.z + Math.sin(g.angle - 0.56) * g.range));
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(toX(g.x), toZ(g.z), 4, 0, Math.PI * 2);
      ctx.fill();
      void a0; void a1;
    }
    // Kucing.
    ctx.fillStyle = '#b46bff';
    ctx.beginPath();
    ctx.arc(toX(game.cat.x), toZ(game.cat.z), 4, 0, Math.PI * 2);
    ctx.fill();
    // Pemain: titik putih + cincin hijau.
    ctx.strokeStyle = '#39ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(toX(game.player.x), toZ(game.player.z), 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(toX(game.player.x), toZ(game.player.z), 3, 0, Math.PI * 2);
    ctx.fill();
    void GUARDS; void CAT;
  }
}
