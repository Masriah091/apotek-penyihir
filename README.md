[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/Masriah091/apotek-penyihir/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/Masriah091/apotek-penyihir/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

# APOTEK PENYIHIR — Curi 3 Ramuan Terlarang di Balik Asap

Game stealth 3D (Three.js) untuk kompetisi MakeFun **best-stealth-game-20261121-1759**.
Tengah malam di apotek penyihir: ungu, hijau racun, dan cahaya lilin. Curi **Ramuan Waktu**,
**Ramuan Bayangan**, dan **Ramuan Naga** dari rak dan kuali, lalu kabur lewat pintu **EXIT**
tanpa terlihat satu pun penjaga.

## Yang menjaga apotek

- **4 golem tanah** patroli dengan kerucut visi bervolume (kuning = patroli, oranye = curiga `?`, merah = mengejar `!`): Golem Batu, Golem Lumut, Golem Tanah, dan Golem Akar.
- **Mimi si Kucing** — familiar yang bertengger di rak tinggi; tatapannya menyapu perlahan dan ia mengeong bila melihatmu, memanggil golem terdekat.

## Mekanik khas

- **Ramuan tembus pandang (F)** — minum untuk 3 detik tak terlihat, 2 dosis per permainan.
- **Asap kuali sebagai cover** — berdiri di asap kuali yang bergerak perlahan = sulit terlihat; meter deteksi hampir tidak naik.
- **Botol cahaya (Q)** — lempar untuk mengalihkan golem ke titik bunyi (3 botol).
- **Menyelinap (Shift)** — gerak pelan & sunyi, meter deteksi naik lebih lambat.
- Sistem stealth lengkap: patroli → curiga → kejar → cari → patroli, meter deteksi, dan kesempatan pulih dengan bersembunyi.

## Kontrol

| Tombol | Aksi |
|---|---|
| WASD / Panah | Bergerak |
| Shift | Menyelinap pelan & sunyi |
| E | Ambil ramuan / kabur lewat EXIT |
| Q | Lempar botol cahaya (pengalih) |
| F | Minum ramuan tembus pandang (3 detik, 2 dosis) |
| M | Mute / unmute suara |
| R | Restart |
| Enter | Mulai / main lagi |

## Cara jalan

Game statis tanpa build step — cukup layani folder `game/` dengan server HTTP apa pun,
lalu buka `game/index.html` di Chrome desktop:

```sh
cd game && python3 -m http.server 8080
# buka http://localhost:8080/
```

Semua bunyi disintesis WebAudio sendiri; tanpa file audio, gambar, atau font eksternal.
Three.js di-vendor di `game/vendor/three.min.js`.

## Struktur source

```
game/
  index.html            # Layar judul / HUD / layar akhir + import map Three.js
  vendor/three.min.js   # Three.js 0.160.0 (vendored)
  src/
    config.js           # Semua data level: palet, rak, kuali, ramuan, penjaga
    random.js           # RNG deterministik (mulberry32)
    input.js            # Status tombol keyboard
    audio.js            # Synth WebAudio: langkah, ambil, sting alert, ambient
    level.js            # Tabrakan, garis pandang, asap, dan semua mesh 3D arena
    guards.js           # Golem patroli + kucing familiar, kerucut visi
    player.js           # Penyihir pencuri + botol cahaya
    autopilot.js        # Pemain otomatis (A* + menunggu ancaman) untuk screenshot
    render.js           # Renderer, kamera oblique, pencahayaan, minimap
    hud.js              # Panel HUD, strip status penjaga, layar TITLE/WIN/LOSE
    shots.js            # Mode screenshot deterministik ?shot=start|play|climax|end
    main.js             # Orkestrator: state, deteksi, interaksi, skor
```

## Lisensi

MIT — lihat [LICENSE](LICENSE).
