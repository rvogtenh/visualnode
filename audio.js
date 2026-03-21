'use strict';

// audio.js — server-side audio analysis via sox/rec
// Captures mic/line-in, runs FFT, emits { bands, onset, delta } at ~30fps
// Mirrors the getBands() logic from public/engine.js

const { spawn } = require('child_process');

const SAMPLE_RATE = 44100;
const FFT_SIZE    = 2048;

// ---- Radix-2 Cooley-Tukey FFT (in-place, power-of-two size) ----

function fft(re, im) {
  const n = re.length;
  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  // Butterfly stages
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + len / 2] * curRe - im[i + j + len / 2] * curIm;
        const vIm = re[i + j + len / 2] * curIm + im[i + j + len / 2] * curRe;
        re[i + j]           = uRe + vRe;
        im[i + j]           = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe;
        im[i + j + len / 2] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm        = curRe * wIm + curIm * wRe;
        curRe        = nextRe;
      }
    }
  }
}

// ---- Band analysis (mirrors engine.js getBands) ----------------

const NYQ    = SAMPLE_RATE / 2;
const HALF_N = FFT_SIZE / 2;

function toIdx(hz) {
  return Math.min(Math.round(hz / NYQ * HALF_N), HALF_N - 1);
}

// magnitudes: Float64Array of length FFT_SIZE/2 (linear scale)
function bandRMS(magnitudes, lo, hi) {
  const a = toIdx(lo), b = toIdx(hi);
  let sum = 0, n = 0;
  for (let i = a; i <= b; i++) {
    sum += magnitudes[i] * magnitudes[i];
    n++;
  }
  return Math.sqrt(sum / Math.max(n, 1));
}

// ---- Main export -----------------------------------------------

function startAudio(callback) {
  // On Linux/Pi (PatchboxOS): use pw-cat (PipeWire native) to avoid ALSA device conflicts.
  // On Mac: use rec (sox). Override via AUDIO_CMD env var if needed.
  let cmd, args;
  if (process.platform === 'linux') {
    cmd  = 'pw-cat';
    args = ['--record', '--rate', '44100', '--format', 's16', '--channels', '1', '-'];
  } else {
    cmd  = 'rec';
    args = ['-t', 'raw', '-r', '44100', '-e', 'signed-integer', '-b', '16', '-c', '1', '-'];
  }
  const proc = spawn(cmd, args);

  console.log('[audio] started');

  // Rolling sample buffer (Int16 values as JS numbers)
  let sampleBuf = [];

  // State for onset/delta
  const prevBands = [0, 0, 0, 0];
  const onset     = [0, 0, 0, 0];
  const delta     = [0, 0, 0, 0];

  // Reusable FFT arrays
  const re  = new Float64Array(FFT_SIZE);
  const im  = new Float64Array(FFT_SIZE);
  const mag = new Float64Array(HALF_N);

  // Hann window coefficients
  const hann = new Float64Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) {
    hann[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (FFT_SIZE - 1)));
  }

  proc.stdout.on('data', (chunk) => {
    // chunk is a Buffer of raw 16-bit signed PCM (little-endian)
    const samples = chunk.length >> 1; // 2 bytes per sample
    for (let i = 0; i < samples; i++) {
      sampleBuf.push(chunk.readInt16LE(i * 2));
    }

    // Process each complete FFT_SIZE window
    while (sampleBuf.length >= FFT_SIZE) {
      const frame = sampleBuf.splice(0, FFT_SIZE);

      // Apply Hann window and normalise to -1..1
      for (let i = 0; i < FFT_SIZE; i++) {
        re[i] = (frame[i] / 32768) * hann[i];
        im[i] = 0;
      }

      fft(re, im);

      // Compute magnitudes for positive frequencies
      for (let i = 0; i < HALF_N; i++) {
        mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / HALF_N;
      }

      const bands = [
        Math.min(bandRMS(mag, 20,   120)  * 6.0, 1.0),
        Math.min(bandRMS(mag, 120,  500)  * 4.5, 1.0),
        Math.min(bandRMS(mag, 500,  4000) * 3.5, 1.0),
        Math.min(bandRMS(mag, 4000, 20000)* 5.5, 1.0),
      ];

      for (let i = 0; i < 4; i++) {
        const d  = bands[i] - prevBands[i];
        delta[i] = Math.max(-1, Math.min(1, d * 8.0));
        const atk = Math.max(0, d) * 7.0;
        onset[i]  = Math.min(1.0, Math.max(atk, onset[i] * 0.65));
        prevBands[i] = bands[i];
      }

      callback({
        bands: bands.slice(),
        onset: onset.slice(),
        delta: delta.slice(),
      });
    }
  });

  proc.stderr.on('data', (data) => {
    // rec/sox writes status info to stderr — only log real errors
    const msg = data.toString().trim();
    if (msg && /error|fail|warn/i.test(msg)) console.error('[audio]', msg);
  });

  proc.on('error', (err) => {
    console.error('[audio] error: failed to spawn rec —', err.message);
  });

  proc.on('close', (code) => {
    console.log(`[audio] rec process closed (code ${code})`);
    if (code !== 0) {
      // PipeWire node may not be ready yet — retry after 3s
      console.log('[audio] retrying in 3s…');
      setTimeout(() => startAudio(callback), 3000);
    }
  });
}

module.exports = { startAudio };
