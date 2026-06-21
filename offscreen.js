// Guitar Engine using Web Audio API with realistic guitar synthesis
// Supports acoustic, electric, and classical guitar sounds

let audioContext = null;
let isPlaying = false;
let generator = null;
let gainNode = null;
let reverbNode = null;
let delayNode = null;
let chorusNode = null;
let convolverNode = null;
let isInitialized = false;

// Preset configurations
const PRESETS = {
  acoustic: {
    tempo: 70,
    density: 0.5,
    range: 'medium',
    complexity: 3,
    reverb: 0.6,
    effect: 'clean',
    description: 'Acoustic',
    style: 'fingerpicking'
  },
  electric: {
    tempo: 80,
    density: 0.7,
    range: 'wide',
    complexity: 4,
    reverb: 0.5,
    effect: 'chorus',
    description: 'Electric',
    style: 'strumming'
  },
  classical: {
    tempo: 65,
    density: 0.4,
    range: 'narrow',
    complexity: 2,
    reverb: 0.8,
    effect: 'clean',
    description: 'Classical',
    style: 'arpeggio'
  },
  blues: {
    tempo: 75,
    density: 0.6,
    range: 'medium',
    complexity: 3,
    reverb: 0.4,
    effect: 'delay',
    description: 'Blues',
    style: 'bending'
  },
  jazz: {
    tempo: 85,
    density: 0.7,
    range: 'wide',
    complexity: 5,
    reverb: 0.6,
    effect: 'chorus',
    description: 'Jazz',
    style: 'chords'
  }
};

// Guitar note frequencies (standard tuning EADGBE)
const NOTE_FREQUENCIES = {
  'E2': 82.41, 'F2': 87.31, 'F#2': 92.50, 'G2': 98.00, 'G#2': 103.83, 'A2': 110.00, 'A#2': 116.54, 'B2': 123.47,
  'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00,
  'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94, 'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13,
  'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
  'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'E5': 659.25, 'F5': 698.46, 'F#5': 739.99, 'G5': 783.99,
  'G#5': 830.61, 'A5': 880.00, 'A#5': 932.33, 'B5': 987.77, 'C6': 1046.50, 'D6': 1174.66, 'E6': 1318.51
};

const NOTE_RANGES = {
  narrow: ['G3', 'A3', 'B3', 'D4', 'E4', 'G4', 'A4', 'B4'],
  medium: ['E3', 'G3', 'A3', 'B3', 'D4', 'E4', 'G4', 'A4', 'B4', 'D5'],
  wide: ['C3', 'E3', 'G3', 'A3', 'B3', 'D4', 'E4', 'G4', 'A4', 'B4', 'D5', 'E5', 'G5']
};

// Guitar chord voicings for richer sound
const CHORD_VOICINGS = {
  'C': ['E3', 'G3', 'C4', 'E4', 'G4'],
  'G': ['G3', 'B3', 'D4', 'G4', 'B4'],
  'Am': ['A3', 'C4', 'E4', 'A4'],
  'Em': ['E3', 'G3', 'B3', 'E4'],
  'D': ['D3', 'A3', 'D4', 'F#4'],
  'A': ['A3', 'C#4', 'E4', 'A4'],
  'E': ['E3', 'G#3', 'B3', 'E4'],
  'F': ['F3', 'A3', 'C4', 'F4'],
  'Dm': ['D3', 'F3', 'A3', 'D4'],
  'G7': ['G3', 'B3', 'D4', 'F4', 'G4']
};

const CHORD_NAMES = ['C', 'G', 'Am', 'Em', 'D', 'A', 'E', 'F', 'Dm', 'G7'];

let state = {
  preset: 'acoustic',
  volume: 0.75,
  reverb: 0.6,
  effect: 'clean',
  noteCount: 0,
  startTime: Date.now(),
  currentChord: null
};

// Guitar Sound Engine
class GuitarEngine {
  constructor() {
    this.audioContext = null;
    this.gainNode = null;
    this.reverbNode = null;
    this.delayNode = null;
    this.chorusNode = null;
    this.overdriveNode = null;
    this.convolverNode = null;
    this.isInitialized = false;
    this.currentEffect = 'clean';
  }

  async init() {
    if (this.isInitialized) return;
    
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Master gain
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = state.volume;
      this.gainNode.connect(this.audioContext.destination);
      
      // Create effects
      await this.createReverb();
      this.createDelay();
      this.createChorus();
      this.createOverdrive();
      
      this.isInitialized = true;
      console.log('Guitar engine initialized');
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }

  async createReverb() {
    try {
      const sampleRate = this.audioContext.sampleRate;
      const length = sampleRate * 3;
      const impulse = this.audioContext.createBuffer(2, length, sampleRate);
      
      for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          const decay = Math.exp(-i / (sampleRate * (0.5 + state.reverb * 0.5)));
          channelData[i] = (Math.random() * 2 - 1) * decay * 0.3;
        }
      }
      
      this.convolverNode = this.audioContext.createConvolver();
      this.convolverNode.buffer = impulse;
      this.convolverNode.connect(this.gainNode);
    } catch (e) {
      console.warn('Reverb creation failed:', e);
    }
  }

  createDelay() {
    this.delayNode = this.audioContext.createDelay(1.0);
    this.delayNode.delayTime.value = 0.3;
    const feedback = this.audioContext.createGain();
    feedback.gain.value = 0.3;
    this.delayNode.connect(feedback);
    feedback.connect(this.delayNode);
  }

  createChorus() {
    this.chorusNode = this.audioContext.createDelay(0.02);
    this.chorusNode.delayTime.value = 0.005;
    const chorusGain = this.audioContext.createGain();
    chorusGain.gain.value = 0.5;
    this.chorusNode.connect(chorusGain);
    chorusGain.connect(this.chorusNode);
  }

  createOverdrive() {
    this.overdriveNode = this.audioContext.createGain();
    this.overdriveNode.gain.value = 1.0;
    // Simple overdrive via gain staging
    const distortion = this.audioContext.createWaveShaper();
    distortion.curve = this.makeDistortionCurve(0.3);
    this.overdriveNode.connect(distortion);
  }

  makeDistortionCurve(amount) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; ++i) {
      const x = i * 2 / samples - 1;
      curve[i] = (3 + amount) * x * 20 * deg / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  // Create realistic guitar sound
  playGuitarNote(note, time = 0, style = 'fingerpicking') {
    if (!this.isInitialized || !this.audioContext) return;
    
    try {
      const freq = NOTE_FREQUENCIES[note];
      if (!freq) return;
      
      const now = this.audioContext.currentTime + time;
      const velocity = 0.4 + Math.random() * 0.5;
      
      // Create a guitar-like sound with multiple layers
      
      // Layer 1: Main body (sawtooth with filter)
      const osc1 = this.audioContext.createOscillator();
      const gain1 = this.audioContext.createGain();
      const filter1 = this.audioContext.createBiquadFilter();
      
      osc1.type = style === 'fingerpicking' ? 'sine' : 'sawtooth';
      osc1.frequency.setValueAtTime(freq, now);
      
      // Pitch variation for realism
      osc1.frequency.exponentialRampToValueAtTime(freq * (1 + (Math.random() - 0.5) * 0.002), now + 0.1);
      
      filter1.type = 'lowpass';
      filter1.frequency.setValueAtTime(2000 + Math.random() * 1000, now);
      filter1.frequency.exponentialRampToValueAtTime(1000, now + 0.5);
      filter1.Q.value = 5;
      
      // Envelope for guitar
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.exponentialRampToValueAtTime(velocity * 0.5 * state.volume, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(velocity * 0.3 * state.volume, now + 0.1);
      gain1.gain.exponentialRampToValueAtTime(velocity * 0.15 * state.volume, now + 0.5);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 2 + Math.random() * 1.5);
      
      // Layer 2: String harmonics (sine at octave)
      const osc2 = this.audioContext.createOscillator();
      const gain2 = this.audioContext.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2, now);
      
      gain2.gain.setValueAtTime(0.001, now);
      gain2.gain.exponentialRampToValueAtTime(velocity * 0.12 * state.volume, now + 0.01);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      
      // Layer 3: Pick attack (noise burst)
      const bufferSize = this.audioContext.sampleRate * 0.005;
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
      }
      const noise = this.audioContext.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = this.audioContext.createGain();
      const noiseFilter = this.audioContext.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 2000 + Math.random() * 1000;
      noiseFilter.Q.value = 1;
      
      noiseGain.gain.setValueAtTime(velocity * 0.15 * state.volume, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
      
      // Layer 4: Body resonance
      const osc3 = this.audioContext.createOscillator();
      const gain3 = this.audioContext.createGain();
      osc3.type = 'sine';
      const bodyFreq = freq * (0.5 + Math.random() * 0.3);
      osc3.frequency.setValueAtTime(bodyFreq, now);
      
      gain3.gain.setValueAtTime(0.001, now);
      gain3.gain.exponentialRampToValueAtTime(velocity * 0.08 * state.volume, now + 0.05);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      
      // Connect layers
      osc1.connect(filter1);
      filter1.connect(gain1);
      osc2.connect(gain2);
      osc3.connect(gain3);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      
      // Apply effects based on current effect setting
      let outputNode = this.gainNode;
      
      if (this.currentEffect === 'chorus' || state.effect === 'chorus') {
        // Connect through chorus
        const chorusOut = this.audioContext.createGain();
        gain1.connect(chorusOut);
        chorusOut.connect(this.chorusNode);
        this.chorusNode.connect(outputNode);
        gain2.connect(outputNode);
        gain3.connect(outputNode);
        noiseGain.connect(outputNode);
      } else if (this.currentEffect === 'delay' || state.effect === 'delay') {
        // Connect through delay
        const delayOut = this.audioContext.createGain();
        gain1.connect(delayOut);
        delayOut.connect(this.delayNode);
        this.delayNode.connect(outputNode);
        gain1.connect(outputNode); // Dry signal
        gain2.connect(outputNode);
        gain3.connect(outputNode);
        noiseGain.connect(outputNode);
      } else if (this.currentEffect === 'overdrive' || state.effect === 'overdrive') {
        // Connect through overdrive
        const driveOut = this.audioContext.createGain();
        gain1.connect(driveOut);
        driveOut.connect(this.overdriveNode);
        this.overdriveNode.connect(outputNode);
        gain2.connect(outputNode);
        gain3.connect(outputNode);
        noiseGain.connect(outputNode);
      } else {
        // Clean - connect with reverb
        if (this.convolverNode) {
          const wetGain = this.audioContext.createGain();
          wetGain.gain.value = state.reverb * 0.5;
          gain1.connect(wetGain);
          wetGain.connect(this.convolverNode);
          
          const dryGain = this.audioContext.createGain();
          dryGain.gain.value = 1 - state.reverb * 0.3;
          gain1.connect(dryGain);
          dryGain.connect(outputNode);
          
          gain2.connect(this.convolverNode);
          gain3.connect(this.convolverNode);
          noiseGain.connect(this.convolverNode);
        } else {
          gain1.connect(outputNode);
          gain2.connect(outputNode);
          gain3.connect(outputNode);
          noiseGain.connect(outputNode);
        }
      }
      
      // Start all
      osc1.start(now);
      osc1.stop(now + 3);
      osc2.start(now);
      osc2.stop(now + 1.2);
      osc3.start(now);
      osc3.stop(now + 0.8);
      noise.start(now);
      noise.stop(now + 0.03);
      
      state.noteCount++;
      
    } catch (e) {
      console.debug('Note play error:', e);
    }
  }

  // Play a chord
  playGuitarChord(chordName, time = 0, style = 'strumming') {
    const chordNotes = CHORD_VOICINGS[chordName];
    if (!chordNotes) return;
    
    const strumDelay = style === 'strumming' ? 0.06 : 0.02;
    
    chordNotes.forEach((note, index) => {
      const delay = time + index * (strumDelay + Math.random() * 0.02);
      const velocity = 0.5 + Math.random() * 0.4;
      this.playGuitarNote(note, delay, style);
    });
  }

  setVolume(value) {
    state.volume = value;
    if (this.gainNode) {
      this.gainNode.gain.value = value;
    }
  }

  setReverb(value) {
    state.reverb = value;
    this.createReverb();
  }

  setEffect(effect) {
    this.currentEffect = effect;
    state.effect = effect;
  }

  dispose() {
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.isInitialized = false;
  }
}

// Music Generator
class MusicGenerator {
  constructor(engine) {
    this.engine = engine;
    this.isRunning = false;
    this.timeoutId = null;
    this.lastNoteTime = 0;
    this.currentChordIndex = 0;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    state.startTime = Date.now();
    this.scheduleMusic();
  }

  stop() {
    this.isRunning = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  scheduleMusic() {
    if (!this.isRunning) return;

    const preset = PRESETS[state.preset];
    const tempo = preset.tempo;
    const density = preset.density;
    const style = preset.style;
    const range = NOTE_RANGES[preset.range];
    const complexity = preset.complexity;

    const baseInterval = 60 / tempo;
    const variation = baseInterval * 0.25;
    let interval = baseInterval + (Math.random() - 0.5) * variation * 2;
    interval = interval / (0.5 + density * 0.7);

    this.timeoutId = setTimeout(() => {
      this.generateMusic(range, complexity, style);
      this.scheduleMusic();
    }, interval * 1000);

    if (this.lastNoteTime === 0) {
      this.generateMusic(range, complexity, style);
    }
    this.lastNoteTime = Date.now();
  }

  generateMusic(range, complexity, style) {
    const shouldPlayChord = Math.random() < 0.3 && style !== 'fingerpicking';
    
    if (shouldPlayChord) {
      // Play a chord
      const chordName = CHORD_NAMES[Math.floor(Math.random() * CHORD_NAMES.length)];
      this.engine.playGuitarChord(chordName, 0, style);
    } else {
      // Play individual notes
      const noteCount = Math.floor(1 + Math.random() * complexity);
      const notes = [];
      
      for (let i = 0; i < noteCount; i++) {
        const note = range[Math.floor(Math.random() * range.length)];
        notes.push(note);
      }
      
      notes.forEach((note, index) => {
        const delay = index * 0.04 + Math.random() * 0.02;
        this.engine.playGuitarNote(note, delay, style);
      });
    }
  }
}

// Initialize guitar engine
let guitarEngine = new GuitarEngine();
let musicGenerator = null;

// Message handler from background
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === 'startGuitar') {
    if (!guitarEngine.isInitialized) {
      await guitarEngine.init();
    }
    
    if (message.preset) state.preset = message.preset;
    if (message.volume !== undefined) guitarEngine.setVolume(message.volume);
    if (message.reverb !== undefined) guitarEngine.setReverb(message.reverb);
    if (message.effect) guitarEngine.setEffect(message.effect);
    
    if (!musicGenerator) {
      musicGenerator = new MusicGenerator(guitarEngine);
    }
    
    if (guitarEngine.audioContext && guitarEngine.audioContext.state === 'suspended') {
      await guitarEngine.audioContext.resume();
    }
    
    musicGenerator.start();
    isPlaying = true;
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'stopGuitar') {
    if (musicGenerator) {
      musicGenerator.stop();
    }
    isPlaying = false;
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'updateVolume') {
    if (guitarEngine) {
      guitarEngine.setVolume(message.volume);
    }
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'updateReverb') {
    if (guitarEngine) {
      guitarEngine.setReverb(message.reverb);
    }
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'updateEffect') {
    if (guitarEngine) {
      guitarEngine.setEffect(message.effect);
    }
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'updatePreset') {
    state.preset = message.preset;
    sendResponse({ success: true });
    return true;
  }
});

console.log('Offscreen guitar engine ready');
