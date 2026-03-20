let easymidi;
try {
  easymidi = require('easymidi');
} catch (e) {
  console.log('[midi] easymidi not available, MIDI disabled');
}

function parseCc(ch, cc, v, callback) {
  const norm = v / 127;
  if (cc === 112) return callback({ type: 'cc', name: 'master', ch, cc, value: norm });
  if (cc === 37)  return callback({ type: 'cc', name: 'param1', ch, cc, value: norm });
  if (cc === 38)  return callback({ type: 'cc', name: 'param2', ch, cc, value: norm });
  if (cc === 39)  return callback({ type: 'cc', name: 'param3', ch, cc, value: norm });
  if (cc === 40)  return callback({ type: 'cc', name: 'param4', ch, cc, value: norm });
  if (cc >= 48 && cc <= 55) return callback({ type: 'cc', name: 'scene1', ch, cc, scene: cc - 48, value: norm });
  if (cc >= 56 && cc <= 63) return callback({ type: 'cc', name: 'scene2', ch, cc, scene: cc - 56, value: norm });
  if (cc >= 88 && cc <= 103) return callback({ type: 'cc', name: 'encoder', ch, cc, index: cc - 88, value: norm });
  callback({ type: 'cc', name: 'unknown', ch, cc, value: norm });
}

function startMidi(callback) {
  if (!easymidi) return;

  const inputs = easymidi.getInputs();
  console.log('[midi] inputs:', inputs);

  if (inputs.length === 0) {
    console.log('[midi] no MIDI inputs found');
    return;
  }

  for (const name of inputs) {
    const input = new easymidi.Input(name);

    input.on('cc', (msg) => {
      const { channel: ch, controller: cc, value: v } = msg;
      console.log(`[midi] cc ch:${ch} cc:${cc} val:${(v / 127).toFixed(2)}`);
      parseCc(ch, cc, v, callback);
    });

    input.on('noteon', (msg) => {
      const { channel: ch, note, velocity: v } = msg;
      console.log(`[midi] noteon ch:${ch} note:${note} val:${(v / 127).toFixed(2)}`);
      callback({ type: 'noteon', ch, note, value: v / 127 });
    });

    input.on('noteoff', (msg) => {
      const { channel: ch, note, velocity: v } = msg;
      console.log(`[midi] noteoff ch:${ch} note:${note} val:${(v / 127).toFixed(2)}`);
      callback({ type: 'noteoff', ch, note, value: v / 127 });
    });

    input.on('program', (msg) => {
      const { channel: ch, number: program } = msg;
      if (ch === 14 && program >= 0 && program <= 7) {
        console.log(`[midi] program ch:${ch} prog:${program}`);
        callback({ type: 'pc', name: 'toggle', scene: program, value: program });
      }
    });
  }
}

module.exports = { startMidi };
