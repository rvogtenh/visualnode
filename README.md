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

Seite startet automatisch wenn Server erreichbar. Kein Klick nötig.

---

## Scenes

### Layer 1 (Keys 1–8 / Note 48–55)

| Key | Note | Scene |
|-----|------|-------|
| `1` | 48 | Interference Collapse |
| `2` | 49 | Stochastic Jump |
| `3` | 50 | Threshold Flip |
| `4` | 51 | Chromatic Storm |
| `5` | 52 | Sine Tangle |
| `6` | 53 | Plasma Bloom |
| `7` | 54 | Crystal Lattice |
| `8` | 55 | Orbital Rings |

### Layer 2 (Keys q–i / Note 56–63)

| Key | Note | Scene |
|-----|------|-------|
| `q` | 56 | Color Tide |
| `w` | 57 | Smoke Drift |
| `e` | 58 | Neon Grid |
| `r` | 59 | Aurora Wave |
| `t` | 60 | Liquid Mirror |
| `z` | 61 | Vortex Field |
| `u` | 62 | Petal Bloom |
| `i` | 63 | Deep Field |

---

## Keyboard

| Taste | Aktion |
|-------|--------|
| `1`–`8` | Layer 1 Szene |
| `q w e r t z u i` | Layer 2 Szene |
| `↑` / `↓` | Blend ±0.05 (in Auto: Intensität) |
| `b` | Blend Mode cycle + Manual |
| `n` `m` `,` `.` | Blend Mode 0–3 direkt |
| `a` | Auto Mode cycle |
| `s` `d` `f` `g` | Auto Mode 4–7 direkt |
| `Tab` | UI-Bar toggle |
| `⌫` | Reset (Backbuffer löschen) |

---

## MIDI — Faderfox UC4

| Message | Funktion |
|---------|---------|
| Note 48–55 (CH1) | Layer 1 Szene 1–8 |
| Note 56–63 (CH1) | Layer 2 Szene 1–8 |
| CC 112 (CH1) | Blend / Auto-Intensität |
| CC 37–40 (CH1) | Params global (reserviert) |
| CC 88–95 (CH1) | Encoder L1 (reserviert) |
| CC 96–103 (CH1) | Encoder L2 (reserviert) |
| PC 0 (CH15) | Blend: crossfade + Manual |
| PC 1 (CH15) | Blend: hardcut + Manual |
| PC 2 (CH15) | Blend: additive + Manual |
| PC 3 (CH15) | Blend: multiply + Manual |
| PC 4 (CH15) | Auto: energy |
| PC 5 (CH15) | Auto: rhythmic |
| PC 6 (CH15) | Auto: stochastic |
| PC 7 (CH15) | Auto: algorithmic |

---

## Blend Modes

| Mode | Taste | Beschreibung |
|------|-------|-------------|
| 0 crossfade | `n` | Weiches Überblenden L1 ↔ L2 |
| 1 hardcut | `m` | Harter Schnitt bei Blend 0.5 |
| 2 additive | `,` | L1 + L2×blend |
| 3 multiply | `.` | L1 × L2×blend |

---

## Auto Modes

| Mode | Taste | MIDI | Beschreibung |
|------|-------|------|-------------|
| 4 energy | `s` | PC 4 | Onset-getriggert; Fader = Empfindlichkeit |
| 5 rhythmic | `d` | PC 5 | Timer 5–60s; Fader = Geschwindigkeit |
| 6 stochastic | `f` | PC 6 | Zufällig 3–30s; Fader = Häufigkeit |
| 7 algorithmic | `g` | PC 7 | Audio-Analyse; Fader = Intensität |

In Auto-Modus: Blend wird automatisch animiert, Masterfader steuert Intensität.
Verlassen: `b` oder PC 0–3.
