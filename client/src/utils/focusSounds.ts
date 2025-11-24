// Sound effects library for focus mode

let currentAudioContext: AudioContext | null = null;
let currentInterval: number | null = null;

export const stopCurrentSound = () => {
    if (currentInterval) {
        clearInterval(currentInterval);
        currentInterval = null;
    }
    if (currentAudioContext) {
        try {
            currentAudioContext.close();
        } catch (e) {
            // Ignore if already closed
        }
        currentAudioContext = null;
    }
}

const createContext = () => {
    stopCurrentSound();
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    currentAudioContext = ctx;
    return ctx;
}

// Helper for playing a sequence of notes
const playSequence = (ctx: AudioContext, notes: { freq: number, dur: number, time: number }[], type: OscillatorType = 'sine', vol: number = 0.2) => {
    notes.forEach(note => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain).connect(ctx.destination);
        osc.type = type;
        osc.frequency.value = note.freq;

        const startTime = ctx.currentTime + note.time;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(vol, startTime + 0.05);
        gain.gain.setValueAtTime(vol, startTime + note.dur - 0.05);
        gain.gain.linearRampToValueAtTime(0, startTime + note.dur);

        osc.start(startTime);
        osc.stop(startTime + note.dur);
    });
};

export const focusSounds = {
    start: {
        none: () => { },
        gentle: () => {
            const ctx = createContext()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain).connect(ctx.destination)
            osc.frequency.setValueAtTime(523.25, ctx.currentTime) // C5
            osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.1) // E5
            osc.type = 'sine'
            gain.gain.setValueAtTime(0.3, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)
            osc.start(ctx.currentTime)
            osc.stop(ctx.currentTime + 0.2)
            setTimeout(() => { if (ctx.state !== 'closed') ctx.close() }, 300)
        },
        bell: () => {
            const ctx = createContext()
            const playBell = (freq: number, time: number) => {
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.connect(gain).connect(ctx.destination)
                osc.frequency.value = freq
                osc.type = 'sine'
                gain.gain.setValueAtTime(0.4, time)
                gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5)
                osc.start(time)
                osc.stop(time + 0.5)
            }
            const now = ctx.currentTime
            playBell(880, now) // A5
            playBell(1046.5, now + 0.15) // C6
            setTimeout(() => { if (ctx.state !== 'closed') ctx.close() }, 700)
        },
        energetic: () => {
            const ctx = createContext()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain).connect(ctx.destination)
            osc.type = 'square'
            osc.frequency.setValueAtTime(440, ctx.currentTime) // A4
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.05) // A5
            gain.gain.setValueAtTime(0.2, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
            osc.start(ctx.currentTime)
            osc.stop(ctx.currentTime + 0.15)
            setTimeout(() => { if (ctx.state !== 'closed') ctx.close() }, 300)
        },
        // Short Sounds
        future_alert: () => {
            const ctx = createContext()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain).connect(ctx.destination)
            osc.type = 'sine'
            osc.frequency.setValueAtTime(1200, ctx.currentTime)
            osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.3)
            gain.gain.setValueAtTime(0.3, ctx.currentTime)
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3)
            osc.start(ctx.currentTime)
            osc.stop(ctx.currentTime + 0.3)
            setTimeout(() => { if (ctx.state !== 'closed') ctx.close() }, 400)
        },
        retro_game: () => {
            const ctx = createContext()
            const playNote = (freq: number, time: number) => {
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.connect(gain).connect(ctx.destination)
                osc.type = 'square'
                osc.frequency.value = freq
                gain.gain.setValueAtTime(0.1, time)
                gain.gain.linearRampToValueAtTime(0, time + 0.1)
                osc.start(time)
                osc.stop(time + 0.1)
            }
            const now = ctx.currentTime
            playNote(523.25, now) // C5
            playNote(659.25, now + 0.1) // E5
            playNote(783.99, now + 0.2) // G5
            playNote(1046.50, now + 0.3) // C6
            setTimeout(() => { if (ctx.state !== 'closed') ctx.close() }, 500)
        },
        soft_piano: () => {
            const ctx = createContext()
            const playNote = (freq: number, time: number) => {
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.connect(gain).connect(ctx.destination)
                osc.type = 'triangle'
                osc.frequency.value = freq
                gain.gain.setValueAtTime(0, time)
                gain.gain.linearRampToValueAtTime(0.2, time + 0.05)
                gain.gain.exponentialRampToValueAtTime(0.01, time + 1.5)
                osc.start(time)
                osc.stop(time + 1.5)
            }
            const now = ctx.currentTime
            playNote(261.63, now) // C4
            playNote(329.63, now) // E4
            playNote(392.00, now) // G4
            setTimeout(() => { if (ctx.state !== 'closed') ctx.close() }, 1600)
        },
        success_fanfare: () => {
            const ctx = createContext()
            const playNote = (freq: number, time: number, dur: number) => {
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.connect(gain).connect(ctx.destination)
                osc.type = 'sawtooth'
                osc.frequency.value = freq
                gain.gain.setValueAtTime(0.1, time)
                gain.gain.linearRampToValueAtTime(0, time + dur)
                osc.start(time)
                osc.stop(time + dur)
            }
            const now = ctx.currentTime
            playNote(523.25, now, 0.2) // C5
            playNote(659.25, now + 0.2, 0.2) // E5
            playNote(783.99, now + 0.4, 0.4) // G5
            setTimeout(() => { if (ctx.state !== 'closed') ctx.close() }, 1000)
        },

        // New Long Sounds (>30s) - Upbeat, Bright, Loud
        upbeat_energy: () => {
            const ctx = createContext();
            const bpm = 120;
            const beatDur = 60 / bpm;

            // Major scale arpeggios: C E G C, F A C F, G B D G
            const freqs = [
                [523.25, 659.25, 783.99, 1046.50], // C Major
                [698.46, 880.00, 1046.50, 1396.91], // F Major
                [783.99, 987.77, 1174.66, 1567.98], // G Major
            ];

            let beat = 0;
            const playLoop = () => {
                if (ctx.state === 'closed') return;

                const now = ctx.currentTime;
                const chordIdx = Math.floor(beat / 16) % 3;
                const noteIdx = beat % 4;
                const freq = freqs[chordIdx][noteIdx];

                // Main melody (Square wave for "game" feel)
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain).connect(ctx.destination);
                osc.type = 'square';
                osc.frequency.value = freq;

                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

                osc.start(now);
                osc.stop(now + 0.1);

                // Bass (Sine wave)
                if (beat % 4 === 0) {
                    const bassOsc = ctx.createOscillator();
                    const bassGain = ctx.createGain();
                    bassOsc.connect(bassGain).connect(ctx.destination);
                    bassOsc.type = 'triangle';
                    bassOsc.frequency.value = freqs[chordIdx][0] / 2;

                    bassGain.gain.setValueAtTime(0.2, now);
                    bassGain.gain.linearRampToValueAtTime(0, now + 0.4);

                    bassOsc.start(now);
                    bassOsc.stop(now + 0.4);
                }

                beat++;
                if (beat < 120) { // 30 seconds approx (120 beats at 4 beats/sec is too fast, let's adjust)
                    // 120bpm = 2 beats per second. 30s = 60 beats.
                    // Current logic: beatDur = 0.5s. 
                }
            };

            // Run the loop
            currentInterval = window.setInterval(playLoop, beatDur * 1000 / 4); // 16th notes

            // Auto stop after 32 seconds
            setTimeout(() => {
                if (currentInterval) clearInterval(currentInterval);
                if (ctx.state !== 'closed') ctx.close();
            }, 32000);
        },

        victory_march: () => {
            const ctx = createContext();
            const notes = [523.25, 523.25, 523.25, 659.25, 783.99, 783.99, 659.25, 783.99, 1046.50];
            let index = 0;

            const playStep = () => {
                if (ctx.state === 'closed') return;
                const now = ctx.currentTime;
                const freq = notes[index % notes.length];

                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain).connect(ctx.destination);
                osc.type = 'sawtooth'; // Brighter sound
                osc.frequency.value = freq;

                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

                osc.start(now);
                osc.stop(now + 0.3);

                index++;
            };

            currentInterval = window.setInterval(playStep, 500); // 2 steps per second

            setTimeout(() => {
                if (currentInterval) clearInterval(currentInterval);
                if (ctx.state !== 'closed') ctx.close();
            }, 32000);
        },

        bright_morning: () => {
            const ctx = createContext();
            // Pentatonic scale: C D E G A
            const scale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];

            const playTinkle = () => {
                if (ctx.state === 'closed') return;
                const now = ctx.currentTime;

                // Play 2 random notes
                for (let i = 0; i < 2; i++) {
                    const freq = scale[Math.floor(Math.random() * scale.length)];
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain).connect(ctx.destination);
                    osc.type = 'sine'; // Pure, bell-like
                    osc.frequency.value = freq;

                    const offset = Math.random() * 0.2;
                    gain.gain.setValueAtTime(0, now + offset);
                    gain.gain.linearRampToValueAtTime(0.2, now + offset + 0.05);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 1.0);

                    osc.start(now + offset);
                    osc.stop(now + offset + 1.0);
                }
            };

            currentInterval = window.setInterval(playTinkle, 800);

            setTimeout(() => {
                if (currentInterval) clearInterval(currentInterval);
                if (ctx.state !== 'closed') ctx.close();
            }, 32000);
        },

        game_level: () => {
            const ctx = createContext();
            let beat = 0;

            const playBit = () => {
                if (ctx.state === 'closed') return;
                const now = ctx.currentTime;

                // Bass line
                const bassOsc = ctx.createOscillator();
                const bassGain = ctx.createGain();
                bassOsc.connect(bassGain).connect(ctx.destination);
                bassOsc.type = 'triangle';
                const bassFreq = (beat % 8 < 4) ? 110 : 146.83; // A2 then D3
                bassOsc.frequency.value = bassFreq;

                bassGain.gain.setValueAtTime(0.3, now);
                bassGain.gain.linearRampToValueAtTime(0, now + 0.2);
                bassOsc.start(now);
                bassOsc.stop(now + 0.2);

                // Melody (every other beat)
                if (beat % 2 === 0) {
                    const melOsc = ctx.createOscillator();
                    const melGain = ctx.createGain();
                    melOsc.connect(melGain).connect(ctx.destination);
                    melOsc.type = 'square';
                    // Simple rising melody
                    const melFreq = 440 + (beat % 16) * 20;
                    melOsc.frequency.value = melFreq;

                    melGain.gain.setValueAtTime(0.1, now);
                    melGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                    melOsc.start(now);
                    melOsc.stop(now + 0.1);
                }

                beat++;
            };

            currentInterval = window.setInterval(playBit, 250); // 4 beats per second

            setTimeout(() => {
                if (currentInterval) clearInterval(currentInterval);
                if (ctx.state !== 'closed') ctx.close();
            }, 32000);
        },

        inspiration: () => {
            const ctx = createContext();
            // Ascending sequence
            let note = 0;
            const baseFreq = 220;

            const playRise = () => {
                if (ctx.state === 'closed') return;
                const now = ctx.currentTime;

                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain).connect(ctx.destination);
                osc.type = 'sawtooth';

                // Harmonic series-ish rise
                const freq = baseFreq * (1 + (note % 8) * 0.25);
                osc.frequency.value = freq;

                // Swell effect
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
                gain.gain.linearRampToValueAtTime(0, now + 0.4);

                osc.start(now);
                osc.stop(now + 0.4);

                note++;
            };

            currentInterval = window.setInterval(playRise, 400);

            setTimeout(() => {
                if (currentInterval) clearInterval(currentInterval);
                if (ctx.state !== 'closed') ctx.close();
            }, 32000);
        }
    },
    end: {
        none: () => { },
        gentle: () => {
            const ctx = createContext()
            const playTone = (freq: number, start: number, dur: number) => {
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.connect(gain).connect(ctx.destination)
                osc.frequency.value = freq
                osc.type = 'sine'
                gain.gain.setValueAtTime(0.15, start)
                gain.gain.exponentialRampToValueAtTime(0.01, start + dur)
                osc.start(start)
                osc.stop(start + dur)
            }
            const now = ctx.currentTime
            playTone(523.25, now, 0.6) // C5
            playTone(659.25, now + 0.05, 0.6) // E5
            playTone(783.99, now + 0.1, 0.8) // G5
            setTimeout(() => { if (ctx.state !== 'closed') ctx.close() }, 1000)
        },
        chime: () => {
            const ctx = createContext()
            const playChime = (freq: number, time: number, dur: number) => {
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.connect(gain).connect(ctx.destination)
                osc.frequency.value = freq
                osc.type = 'sine'
                gain.gain.setValueAtTime(0.2, time)
                gain.gain.exponentialRampToValueAtTime(0.01, time + dur)
                osc.start(time)
                osc.stop(time + dur)
            }
            const now = ctx.currentTime
            playChime(523.25, now, 1) // C5
            playChime(659.25, now + 0.2, 1) // E5
            playChime(783.99, now + 0.4, 1.2) // G5
            playChime(1046.5, now + 0.6, 1.2) // C6
            setTimeout(() => { if (ctx.state !== 'closed') ctx.close() }, 2000)
        },
        triumph: () => {
            const ctx = createContext()
            const playNote = (freq: number, time: number, dur: number, vol: number) => {
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.connect(gain).connect(ctx.destination)
                osc.frequency.value = freq
                osc.type = 'triangle'
                gain.gain.setValueAtTime(vol, time)
                gain.gain.exponentialRampToValueAtTime(0.01, time + dur)
                osc.start(time)
                osc.stop(time + dur)
            }
            const now = ctx.currentTime
            playNote(523.25, now, 0.3, 0.15) // C5
            playNote(659.25, now + 0.15, 0.3, 0.15) // E5
            playNote(783.99, now + 0.3, 0.3, 0.2) // G5
            playNote(1046.5, now + 0.5, 0.8, 0.25) // C6
            setTimeout(() => { if (ctx.state !== 'closed') ctx.close() }, 1500)
        },

        // Reuse new long sounds for end
        upbeat_energy: () => focusSounds.start.upbeat_energy(),
        victory_march: () => focusSounds.start.victory_march(),
        bright_morning: () => focusSounds.start.bright_morning(),
        game_level: () => focusSounds.start.game_level(),
        inspiration: () => focusSounds.start.inspiration(),

        // Short Sounds (End variants)
        future_alert: () => focusSounds.start.future_alert(),
        retro_game: () => focusSounds.start.retro_game(),
        soft_piano: () => focusSounds.start.soft_piano(),
        success_fanfare: () => focusSounds.start.success_fanfare(),
    }
} as const

export const playFocusSound = (type: 'start' | 'end', soundName: string = 'gentle') => {
    const sounds = focusSounds[type]
    const soundFn = sounds[soundName as keyof typeof sounds]
    if (soundFn && typeof soundFn === 'function') {
        soundFn()
    }
}

export const SOUND_OPTIONS = {
    start: [
        { value: 'none', label: '无声音' },
        { value: 'gentle', label: '柔和 (推荐)' },
        { value: 'bell', label: '铃声' },
        { value: 'energetic', label: '活力' },
        { value: 'future_alert', label: '未来科技' },
        { value: 'retro_game', label: '复古游戏' },
        { value: 'soft_piano', label: '轻柔钢琴' },
        { value: 'success_fanfare', label: '成功号角' },
        { value: 'upbeat_energy', label: '欢快活力 (30秒)' },
        { value: 'victory_march', label: '胜利进行曲 (30秒)' },
        { value: 'bright_morning', label: '清晨闹钟 (30秒)' },
        { value: 'game_level', label: '游戏关卡 (30秒)' },
        { value: 'inspiration', label: '灵感时刻 (30秒)' },
    ],
    end: [
        { value: 'none', label: '无声音' },
        { value: 'gentle', label: '柔和 (推荐)' },
        { value: 'chime', label: '风铃' },
        { value: 'triumph', label: '胜利' },
        { value: 'future_alert', label: '未来科技' },
        { value: 'retro_game', label: '复古游戏' },
        { value: 'soft_piano', label: '轻柔钢琴' },
        { value: 'success_fanfare', label: '成功号角' },
        { value: 'upbeat_energy', label: '欢快活力 (30秒)' },
        { value: 'victory_march', label: '胜利进行曲 (30秒)' },
        { value: 'bright_morning', label: '清晨闹钟 (30秒)' },
        { value: 'game_level', label: '游戏关卡 (30秒)' },
        { value: 'inspiration', label: '灵感时刻 (30秒)' },
    ]
}
