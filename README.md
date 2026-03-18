# visual-node-mvp

Audio-reactive WebGL shader — Phase 1 local MVP.

Part of the **Visual Node** project: Raspberry Pi 5 + PiSound → Chromium Kiosk → HDMI → Beamer.

---

## Phase 1 Status: ✅ Local MVP running

**Ziel:** Web Audio + Shader lokal auf MacBook testen, reaktiv auf Standard-Audio-Eingang.

---

## Quick Start

```bash
node server.js
# → http://localhost:3000
```

No npm install needed — zero dependencies.

Open in Chrome/Chromium, click **START**, allow microphone access.

---

## Features

- **3 Shaders** (keyboard: 1 / 2 / 3 or dropdown):
  - `1` — Interference Collapse (spectral fine structure)
  - `2` — Stochastic Jump (energy-driven random jumps)
  - `3` — Threshold Flip (hard mode switch at energy threshold)

- **Web Audio API** — live microphone/line input → FFT → 4 frequency bands:
  - `bands.x` — Sub/Bass (20–120 Hz)
  - `bands.y` — Low (120–500 Hz)
  - `bands.z` — Mid (500–4 kHz)
  - `bands.w` — High (4–20 kHz)

- **Ping-pong framebuffer** — feedback / backbuffer support per shader

- **Keyboard shortcuts:**
  - `H` — toggle info bar
  - `1` / `2` / `3` — switch shader

---

## GLSL Shader Conventions (The Force compatible)

All shaders use these uniforms:

```glsl
uniform float     time;        // seconds since start
uniform vec2      resolution;  // viewport in pixels
uniform vec4      bands;       // audio: x=bass, y=low, z=mid, w=high
uniform sampler2D backbuffer;  // previous frame (ping-pong)
```

Helper functions available: `uv()`, `uvN()`, `rotate()`, `fbm()`, `snoise()`,
`voronoi()`, `rmf()`, `hsv2rgb()`, color constants (`black`, `white`, `purple`, …)

---

## File Structure

```
visual-node-mvp/
├── server.js          — minimal static HTTP server (no deps)
├── package.json
└── public/
    └── index.html     — WebGL engine + all shaders inline
```

---

## Phase 2 Next

Deploy to Raspberry Pi 5 + PiSound:

```bash
rsync -av projects_visualnode/visual-node-mvp/ patch@patchbox.local:~/visualnode/
ssh patch@patchbox.local "DISPLAY=:0 chromium-browser --kiosk --autoplay-policy=no-user-gesture-required http://localhost:3000"
```

See [Visual-Node-Entwicklungsplan.md](../../docs/visualnode/Visual-Node-Entwicklungsplan.md) for full roadmap.

---

## Phase Log

| Phase | Status | Date |
|-------|--------|------|
| 1 — Local MVP (Mac) | ✅ Done | 2026-03-18 |
| 2 — Raspberry + PiSound Kiosk | ⬜ Open | — |
| 3 — Faderfox UC4 MIDI | ⬜ Open | — |
| 4 — Random System | ⬜ Open | — |
| 5 — Salt Sample Sync | ⬜ Open | — |
| 6 — Soundworks + Smartphones | ⬜ Open | — |
