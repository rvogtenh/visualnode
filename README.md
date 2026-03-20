# visual-node-mvp

Audio-reactive WebGL shaders — 2 layers, real-time blend.
Runs on Raspberry Pi (PiSound) or Mac (line-in / mic).

---

## Quick Start

```bash
npm install
node server.js
# → http://localhost:3000
```

Opens automatically when server is reachable. No click needed.

---

## Scenes

### Layer 1 (Keys 1–8 / CC 64–71)

| Key | CC | Scene |
|-----|----|-------|
| `1` | 48 | Interference Collapse |
| `2` | 49 | Stochastic Jump |
| `3` | 50 | Threshold Flip |
| `4` | 51 | Chromatic Storm |
| `5` | 52 | Sine Tangle |
| `6` | 53 | Plasma Bloom |
| `7` | 54 | Crystal Lattice |
| `8` | 55 | Orbital Rings |

### Layer 2 (Keys q–i / CC 56–63)

| Key | CC | Scene |
|-----|----|-------|
| `q` | 56 | Color Tide |
| `w` | 57 | Smoke Drift |
| `e` | 58 | Neon Grid |
| `r` | 59 | Aurora Wave |
| `t` | 60 | Liquid Mirror |
| `z` | 61 | Vortex Field |
| `u` | 62 | Petal Bloom |
| `i` | 63 | Deep Field |

---

## Controls

### Keyboard

| Key | Action |
|-----|--------|
| `1`–`8` | Layer 1 scene |
| `q w e r t z u i` | Layer 2 scene |
| `↑` / `↓` | Blend amount +/− |
| `b` | Cycle blend mode |
| `Tab` | Toggle UI bar |
| `⌫` | Reset (clear feedback buffers) |

### MIDI (Faderfox UC4, Channel 1)

| CC / Message | Value | Action |
|---|---|---|
| CC 48–55 | >64 (on) | Layer 1 scene 1–8 |
| CC 56–63 | >64 (on) | Layer 2 scene 1–8 |
| CC 112 | 0–127 | Master blend amount |
| CC 37–40 | 0–127 | Global params (reserved) |
| CC 88–95 | 0–127 | Layer 1 encoder params (reserved) |
| CC 96–103 | 0–127 | Layer 2 encoder params (reserved) |
| PC 0 (CH 15) | — | Blend mode: hardcut |
| PC 1 (CH 15) | — | Blend mode: crossfade |
| PC 2 (CH 15) | — | Blend mode: additive |
| PC 3 (CH 15) | — | Blend mode: multiply |

### Blend Modes

| Mode | Description |
|------|-------------|
| hardcut | Hard switch at blend 0.5 |
| crossfade | Linear mix L1 ↔ L2 |
| additive | L1 + L2×blend |
| multiply | L1 × L2×blend |
