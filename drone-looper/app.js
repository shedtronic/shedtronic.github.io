const MAX_FILE_SIZE = 25 * 1024 * 1024;
const SAMPLE_LOOP_SECONDS = 2;
const MIN_LOOP_SECONDS = 0.75;
const LOOP_FADE_SECONDS = 0.04;
const ACCEPTED_EXTENSIONS = new Set(["mp3", "wav", "ogg", "flac", "m4a", "aac"]);

let audio;
let master;
let compressor;
let audioOn = false;
let activeSample = null;
let previewLoop = null;
let activeObjectUrl = "";
let idCounter = 0;
const drones = [];
const WAVE_TYPES = [
  { label: "Sine", type: "sine" },
  { label: "Tri", type: "triangle" },
  { label: "Pulse", type: "square" },
  { label: "Saw", type: "sawtooth" },
];

const els = {
  start: document.querySelector("#start-audio"),
  importer: document.querySelector("#sample-import"),
  bankCount: document.querySelector("#bank-count"),
  bankSize: document.querySelector("#bank-size"),
  nativeAudio: document.querySelector("#native-audio"),
  testSample: document.querySelector("#test-sample"),
  playSample: document.querySelector("#play-sample"),
  master: document.querySelector("#master"),
  snapGrid: document.querySelector("#snap-grid"),
};

class Drone {
  constructor(root, index) {
    this.root = root;
    this.index = index;
    this.mode = "synth";
    this.waveIndex = index === 0 ? 1 : 2;
    this.x = 0.5;
    this.y = 0.5;
    this.frozen = false;
    this.capturing = false;
    this.snapping = false;
    this.enabled = true;
    this.sampleId = "";
    this.sampleSource = null;
    this.sampleMedia = null;
    this.sampleMediaNode = null;
    this.sampleLoopTimer = null;
    this.lfoPhase = Math.random() * Math.PI * 2;
    this.canvas = root.querySelector(".scope");
    this.ctx2d = this.canvas.getContext("2d");
    this.nodes = {};
    this.ui = {
      pad: root.querySelector(".pad"),
      cursor: root.querySelector(".pad-cursor"),
      pitch: root.querySelector(".pitch"),
      fine: root.querySelector(".fine"),
      drift: root.querySelector(".drift"),
      decay: root.querySelector(".decay"),
      sample: root.querySelector(".sample-select"),
      wave: root.querySelector(".wave-btn"),
      power: root.querySelector(".power"),
      snap: root.querySelector(".snap"),
      freeze: root.querySelector(".freeze"),
      capture: root.querySelector(".capture"),
      mutate: root.querySelector(".mutate"),
      modes: [...root.querySelectorAll(".mode-btn")],
    };
    this.bindUi();
    this.draw();
  }

  bindUi() {
    this.ui.pad.addEventListener("pointerdown", (event) => {
      this.ui.pad.setPointerCapture(event.pointerId);
      this.updatePad(event);
    });
    this.ui.pad.addEventListener("pointermove", (event) => {
      if (!this.frozen && event.buttons) this.updatePad(event);
    });
    this.ui.modes.forEach((button) => {
      button.addEventListener("click", () => this.setMode(button.dataset.mode));
    });
    this.ui.wave.addEventListener("click", () => this.cycleWave());
    [this.ui.pitch, this.ui.fine, this.ui.drift, this.ui.decay].forEach((input) => {
      input.addEventListener("input", () => this.apply());
    });
    this.ui.sample.addEventListener("change", () => {
      this.sampleId = this.ui.sample.value;
      this.restartSample();
      this.apply();
    });
    this.ui.power.addEventListener("click", () => {
      this.enabled = !this.enabled;
      this.ui.power.classList.toggle("is-on", this.enabled);
      this.apply();
    });
    this.ui.snap.addEventListener("click", () => {
      this.snapping = !this.snapping;
      this.ui.snap.classList.toggle("is-active", this.snapping);
      this.positionCursor();
      this.apply();
    });
    this.ui.freeze.addEventListener("click", () => {
      this.frozen = !this.frozen;
      this.ui.freeze.classList.toggle("is-active", this.frozen);
      showToast(`Drone ${this.index === 0 ? "A" : "B"} pad ${this.frozen ? "held" : "free"}`);
    });
    this.ui.capture.addEventListener("click", () => {
      this.capturing = !this.capturing;
      this.ui.capture.classList.toggle("is-active", this.capturing);
      this.apply();
      showToast(`Drone ${this.index === 0 ? "A" : "B"} feedback ${this.capturing ? "on" : "off"}`);
    });
    this.ui.mutate.addEventListener("click", () => this.mutate());
  }

  boot() {
    const gain = audio.createGain();
    const synthGain = audio.createGain();
    const sampleGain = audio.createGain();
    const sub = audio.createOscillator();
    const osc = audio.createOscillator();
    const edge = audio.createOscillator();
    const edgeGain = audio.createGain();
    const mod = audio.createOscillator();
    const modGain = audio.createGain();
    const noise = audio.createBufferSource();
    const noiseGain = audio.createGain();
    const filter = audio.createBiquadFilter();
    const shaper = audio.createWaveShaper();
    const delay = audio.createDelay(8);
    const feedback = audio.createGain();
    const loopGain = audio.createGain();
    const analyser = audio.createAnalyser();

    sub.type = "sine";
    osc.type = WAVE_TYPES[this.waveIndex].type;
    edge.type = this.index === 0 ? "square" : "sawtooth";
    mod.type = "sine";
    filter.type = "lowpass";
    delay.delayTime.value = this.index === 0 ? 2.8 : 3.7;
    analyser.fftSize = 1024;

    noise.buffer = makeNoiseBuffer();
    noise.loop = true;
    mod.connect(modGain);
    modGain.connect(osc.detune);
    modGain.connect(edge.detune);
    sub.connect(synthGain);
    osc.connect(synthGain);
    edge.connect(edgeGain);
    edgeGain.connect(synthGain);
    noise.connect(noiseGain);
    noiseGain.connect(synthGain);
    synthGain.connect(filter);
    sampleGain.connect(filter);
    filter.connect(shaper);
    shaper.connect(loopGain);
    loopGain.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(gain);
    shaper.connect(gain);
    gain.connect(analyser);
    gain.connect(master);

    sub.start();
    osc.start();
    edge.start();
    mod.start();
    noise.start();

    this.nodes = {
      gain,
      synthGain,
      sampleGain,
      sub,
      osc,
      edge,
      edgeGain,
      mod,
      modGain,
      noiseGain,
      filter,
      shaper,
      loopGain,
      feedback,
      analyser,
    };
    this.restartSample();
    this.apply();
  }

  updatePad(event) {
    const rect = this.ui.pad.getBoundingClientRect();
    this.x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    this.y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    this.positionCursor();
    this.apply();
  }

  setMode(mode) {
    this.mode = mode;
    this.ui.modes.forEach((button) => button.classList.toggle("is-active", button.dataset.mode === mode));
    this.restartSample();
    this.apply();
  }

  cycleWave() {
    this.waveIndex = (this.waveIndex + 1) % WAVE_TYPES.length;
    const wave = WAVE_TYPES[this.waveIndex];
    this.ui.wave.textContent = wave.label;
    if (this.nodes.osc) this.nodes.osc.type = wave.type;
    showToast(`Drone ${this.index === 0 ? "A" : "B"} wave: ${wave.label}`);
    this.apply();
  }

  mutate() {
    this.x = clamp(this.x + (Math.random() - 0.5) * 0.42, 0, 1);
    this.y = clamp(this.y + (Math.random() - 0.5) * 0.42, 0, 1);
    this.ui.pitch.value = String(clamp(Number(this.ui.pitch.value) + Math.round((Math.random() - 0.5) * 10), -36, 12));
    this.ui.drift.value = String(clamp(Number(this.ui.drift.value) + Math.round((Math.random() - 0.5) * 36), 0, 100));
    this.positionCursor();
    this.apply();
  }

  positionCursor() {
    const padPitch = this.getPadPitch();
    const displayX = this.snapping ? (padPitch + 7) / 14 : this.x;
    this.ui.cursor.style.left = `${clamp(displayX, 0, 1) * 100}%`;
    this.ui.cursor.style.top = `${this.y * 100}%`;
    this.ui.pad.classList.toggle("is-snapping", this.snapping);
  }

  getPadPitch() {
    const raw = (this.x - 0.5) * 14;
    if (!this.snapping) return raw;
    const grid = Number(els.snapGrid.value);
    return clamp(Math.round(raw / grid) * grid, -7, 7);
  }

  apply() {
    if (!audio || !this.nodes.gain) return;
    const now = audio.currentTime;
    const pitch = Number(this.ui.pitch.value);
    const fine = Number(this.ui.fine.value);
    const drift = Number(this.ui.drift.value) / 100;
    const decay = Number(this.ui.decay.value) / 100;
    const base = this.index === 0 ? 65.41 : 73.42;
    const padPitch = this.getPadPitch();
    const freq = base * 2 ** ((pitch + padPitch + fine / 100) / 12);
    const pressure = 1 - this.y;
    const breakInput = this.x * 0.56 + pressure * 0.72 + drift * 0.2;
    const breakAmount = smoothstep(0.78, 1.34, breakInput);
    const musicalAmount = 1 - breakAmount;
    const synthLevel = this.mode === "sample" ? 0 : this.mode === "hybrid" ? 0.55 : 0.92;
    const sampleLevel = this.mode === "synth" || !this.sampleId ? 0 : this.mode === "hybrid" ? 0.62 : 0.96;

    setParam(this.nodes.sub.frequency, freq * 0.5, now);
    setParam(this.nodes.osc.frequency, freq * (this.index === 0 ? 1.005 : 1.25 + breakAmount * 0.25), now);
    setParam(this.nodes.edge.frequency, freq * (2 + breakAmount * (this.index === 0 ? 2.2 : 3.05)), now);
    setParam(this.nodes.edgeGain.gain, 0.004 + breakAmount * 0.36, now);
    setParam(this.nodes.mod.frequency, 0.045 + drift * (0.7 + breakAmount * 7.2), now);
    setParam(this.nodes.modGain.gain, drift * (4 + breakAmount * 180) + breakAmount * 58, now);
    setParam(this.nodes.noiseGain.gain, 0.001 + breakAmount * 0.23, now);
    setParam(this.nodes.synthGain.gain, synthLevel, now);
    setParam(this.nodes.sampleGain.gain, sampleLevel, now);
    setParam(this.nodes.filter.frequency, 120 + musicalAmount * 360 + breakAmount * 2350 + pressure * 130, now);
    setParam(this.nodes.filter.Q, 1.2 + musicalAmount * 1.6 + breakAmount * 20, now);
    setParam(this.nodes.loopGain.gain, this.capturing ? 0.78 : 0, now);
    setParam(this.nodes.feedback.gain, this.capturing ? clamp(decay, 0, 0.96) : 0.24, now);
    setParam(this.nodes.gain.gain, this.enabled ? 0.58 : 0, now);
    this.nodes.shaper.curve = makeDriveCurve(0.25 + breakAmount * 82);

    if (this.sampleSource) {
      const rate = 2 ** ((pitch + padPitch + fine / 100) / 12);
      setParam(this.sampleSource.playbackRate, clamp(rate, 0.0625, 4), now);
    }
    if (this.sampleMedia) {
      const wobble = Math.sin(now * (0.8 + drift * 5.5) + this.lfoPhase) * drift * breakAmount * 0.08;
      this.sampleMedia.playbackRate = clamp(2 ** ((pitch + padPitch + fine / 100) / 12) * (1 + wobble), 0.25, 4);
    }
  }

  restartSample() {
    if (!audio || !this.nodes.sampleGain) return;
    this.stopSamplePlayback();
    const sample = activeSample?.id === this.sampleId ? activeSample : null;
    if (!sample || this.mode === "synth") return;
    if (!sample.loopBuffer && !sample.buffer && sample.url) {
      this.startMediaSample(sample);
      return;
    }
    const source = audio.createBufferSource();
    source.buffer = sample.loopBuffer || sample.buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = source.buffer.duration;
    source.connect(this.nodes.sampleGain);
    source.start();
    this.sampleSource = source;
  }

  stopSamplePlayback() {
    if (this.sampleSource) {
      try {
        this.sampleSource.stop();
      } catch {}
      this.sampleSource.disconnect();
      this.sampleSource = null;
    }
    if (this.sampleLoopTimer) {
      clearInterval(this.sampleLoopTimer);
      this.sampleLoopTimer = null;
    }
    if (this.sampleMedia) {
      this.sampleMedia.pause();
      this.sampleMedia.src = "";
      this.sampleMedia = null;
    }
    if (this.sampleMediaNode) {
      this.sampleMediaNode.disconnect();
      this.sampleMediaNode = null;
    }
  }

  startMediaSample(sample) {
    const media = new Audio(sample.url);
    const loop = sample.loop || { start: 0, end: SAMPLE_LOOP_SECONDS };
    media.preload = "auto";
    media.volume = 1;
    disablePitchPreservation(media);
    const source = audio.createMediaElementSource(media);
    source.connect(this.nodes.sampleGain);
    this.sampleMedia = media;
    this.sampleMediaNode = source;
    this.sampleLoopTimer = setInterval(() => {
      if (!this.sampleMedia) return;
      if (this.sampleMedia.currentTime >= loop.end || this.sampleMedia.currentTime < loop.start) {
        this.sampleMedia.currentTime = loop.start;
      }
    }, 30);
    this.apply();
    waitForMediaMetadata(media)
      .then(() => {
        media.currentTime = loop.start;
        return media.play();
      })
      .catch(() => {
        setAudioStatus("Drone media play blocked", "Tap Sample Loop or Audio On");
      });
  }

  draw() {
    const canvas = this.canvas;
    const ctx = this.ctx2d;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * ratio));
    const height = Math.max(1, Math.floor(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = Math.max(1, ratio);
    ctx.strokeStyle = this.index === 0 ? "rgba(180,198,91,.42)" : "rgba(70,176,169,.42)";
    ctx.fillStyle = this.index === 0 ? "rgba(163,55,34,.12)" : "rgba(70,176,169,.10)";

    const data = new Uint8Array(512);
    if (this.nodes.analyser) this.nodes.analyser.getByteTimeDomainData(data);
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const value = this.nodes.analyser ? data[i] / 255 : 0.5 + Math.sin(i * 0.05 + performance.now() * 0.0008) * 0.12;
      const warp = Math.sin(i * 0.045 + this.x * 8 + performance.now() * 0.0005) * height * 0.08 * (1 - this.y);
      const x = (i / (data.length - 1)) * width;
      const y = value * height * 0.7 + height * 0.15 + warp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    for (let band = 0; band < 8; band++) {
      const y = ((band + 1) / 9) * height;
      const wobble = Math.sin(performance.now() * 0.0004 + band + this.x * 4) * 18 * ratio;
      ctx.fillRect(0, y + wobble, width, Math.max(1, ratio));
    }
    requestAnimationFrame(() => this.draw());
  }
}

els.start.addEventListener("click", async () => {
  if (audioOn) await killAudio();
  else await startAudio();
});

els.master.addEventListener("input", () => {
  if (master) setParam(master.gain, Number(els.master.value) / 100, audio.currentTime);
});

els.snapGrid.addEventListener("change", () => {
  drones.forEach((drone) => {
    drone.positionCursor();
    drone.apply();
  });
  showToast(`Snap grid: ${els.snapGrid.selectedOptions[0].textContent}`);
});

els.importer.addEventListener("change", async (event) => {
  await importAudio(event.target.files[0]);
  event.target.value = "";
});

els.playSample.addEventListener("click", async () => {
  if (previewLoop) stopSampleLoop();
  else await startSampleLoop();
});

els.testSample.addEventListener("click", async () => {
  await loadGeneratedTestLoop();
});

document.querySelectorAll(".drone").forEach((root, index) => drones.push(new Drone(root, index)));

async function startAudio() {
  const wasAlreadyOn = audioOn && audio?.state === "running";
  if (!audio) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      showToast("Web Audio is not available in this browser");
      return;
    }
    try {
      audio = new AudioCtx({ latencyHint: "interactive" });
    } catch {
      audio = new AudioCtx();
    }
    compressor = audio.createDynamicsCompressor();
    master = audio.createGain();
    compressor.threshold.value = -18;
    compressor.knee.value = 20;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.16;
    master.gain.value = Number(els.master.value) / 100;
    master.connect(compressor);
    compressor.connect(audio.destination);
    drones.forEach((drone) => drone.boot());
  }
  if (audio.state !== "running") await audio.resume();
  if (audio.state === "running") {
    audioOn = true;
    setParam(master.gain, Number(els.master.value) / 100, audio.currentTime);
    els.start.textContent = "Audio On";
    els.start.setAttribute("aria-pressed", "true");
    els.start.classList.add("is-on");
    if (!wasAlreadyOn) {
      playStartPulse();
      showToast("Audio on: use headphones for the low end");
    }
  } else {
    showToast("Audio is still suspended: tap Start Audio again");
  }
}

async function killAudio() {
  if (!audio || !master) return;
  stopSampleLoop();
  const now = audio.currentTime;
  setParam(master.gain, 0.0001, now);
  await new Promise((resolve) => setTimeout(resolve, 120));
  if (audio.state === "running") await audio.suspend();
  audioOn = false;
  els.start.textContent = "Audio Off";
  els.start.setAttribute("aria-pressed", "false");
  els.start.classList.remove("is-on");
  showToast("Audio killed");
}

function playStartPulse() {
  const now = audio.currentTime;
  const tone = audio.createOscillator();
  const gain = audio.createGain();
  tone.type = "sawtooth";
  tone.frequency.setValueAtTime(170, now);
  tone.frequency.exponentialRampToValueAtTime(72, now + 0.42);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.035);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
  tone.connect(gain);
  gain.connect(master);
  tone.start(now);
  tone.stop(now + 0.55);
}

async function importAudio(file) {
  if (!file) return;
  const extension = file.name.split(".").pop().toLowerCase();
  if (!ACCEPTED_EXTENSIONS.has(extension)) {
    setAudioStatus("Unsupported format", "Use MP3 WAV OGG FLAC M4A");
    showToast(`${file.name}: unsupported`);
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    setAudioStatus("File too large", "25 MB max");
    showToast(`${file.name}: over 25 MB`);
    return;
  }

  if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
  activeObjectUrl = URL.createObjectURL(file);
  els.nativeAudio.src = activeObjectUrl;
  els.nativeAudio.classList.add("is-loaded");

  createMediaOnlySample(file, "Media ready");
  setAudioStatus(`Loaded: ${activeSample.name}`, "Media loop ready / decoding in background");
  showToast("Audio loaded; Sample Loop is ready");
  startAudio().then(() => decodeImportedAudio(file, activeSample.id));
}

function createMediaOnlySample(file, reason) {
  activeSample = {
    id: makeId("sample"),
    name: file.name.replace(/\.[^.]+$/, ""),
    size: file.size,
    buffer: null,
    loop: { start: 0, end: SAMPLE_LOOP_SECONDS },
    loopBuffer: null,
    url: activeObjectUrl,
    reason,
  };
  assignActiveSample();
}

async function decodeImportedAudio(file, sampleId) {
  if (!audio || audio.state !== "running") return;
  try {
    const buffer = await file.arrayBuffer();
    const decoded = await audio.decodeAudioData(buffer.slice(0));
    if (!activeSample || activeSample.id !== sampleId) return;
    const loop = getSampleLoopBounds(decoded);
    activeSample.buffer = decoded;
    activeSample.loop = loop;
    activeSample.loopBuffer = makePlayableLoopBuffer(decoded, loop);
    activeSample.reason = "Decoded";
    drones.forEach((drone) => {
      if (drone.sampleId === activeSample.id && drone.mode !== "synth") drone.restartSample();
    });
    setAudioStatus(`Loaded: ${activeSample.name}`, `${loop.start.toFixed(1)}-${loop.end.toFixed(1)} sec / decoded`);
  } catch {
    if (activeSample?.id === sampleId) {
      setAudioStatus(`Loaded: ${activeSample.name}`, "Media fallback / decode unavailable");
    }
  }
}

function assignActiveSample() {
  if (!activeSample) return;
  els.playSample.disabled = false;
  drones.forEach((drone) => {
    drone.ui.sample.innerHTML = `<option value="">No sample loaded</option>`;
    const option = document.createElement("option");
    option.value = activeSample.id;
    option.textContent = activeSample.name;
    drone.ui.sample.append(option);
    drone.sampleId = activeSample.id;
    drone.ui.sample.value = activeSample.id;
    drone.restartSample();
    drone.apply();
  });
  if (drones.every((drone) => drone.mode === "synth")) {
    drones[0].ui.pitch.value = "0";
    drones[0].x = 0.5;
    drones[0].y = 0.62;
    drones[0].positionCursor();
    drones[0].setMode("sample");
  }
}

async function playSamplePreview() {
  await startSampleLoop();
}

async function startSampleLoop() {
  if (!activeSample) {
    showToast("Import audio first");
    return;
  }
  await startAudio();
  if (!audio || audio.state !== "running") return;
  stopSampleLoop();

  const drone = drones[0];
  drone.enabled = true;
  drone.ui.power.classList.add("is-on");
  drone.sampleId = activeSample.id;
  drone.ui.sample.value = activeSample.id;
  drone.setMode("sample");
  drone.restartSample();
  drone.apply();

  try {
    previewLoop = { drone };
    els.playSample.textContent = "Stop Sample";
    els.playSample.classList.add("is-active");
    setAudioStatus(`Looping: ${activeSample.name}`, "Drone A pad controls sample pitch and damage");
  } catch (error) {
    setAudioStatus("Loop start failed", error.message || "Unknown audio error");
    showToast("Loop start failed");
  }
}

async function loadGeneratedTestLoop() {
  await startAudio();
  if (!audio || audio.state !== "running") return;
  const loopBuffer = makeFallbackLoopBuffer();
  activeSample = {
    id: makeId("sample"),
    name: "test-loop",
    size: 0,
    buffer: loopBuffer,
    loop: { start: 0, end: loopBuffer.duration },
    loopBuffer,
    url: "",
  };
  assignActiveSample();
  setAudioStatus("Loaded: test-loop", `${loopBuffer.duration.toFixed(1)} sec generated`);
  await startSampleLoop();
}

function makePlayableLoopBuffer(buffer, loop) {
  const sampleRate = buffer.sampleRate;
  const startFrame = Math.max(0, Math.floor(loop.start * sampleRate));
  const endFrame = Math.min(buffer.length, Math.max(startFrame + 1, Math.floor(loop.end * sampleRate)));
  const frameCount = Math.max(1, endFrame - startFrame);
  const output = audio.createBuffer(buffer.numberOfChannels, frameCount, sampleRate);
  let peak = 0;

  for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex++) {
    const input = buffer.getChannelData(channelIndex);
    const data = output.getChannelData(channelIndex);
    let dc = 0;
    for (let i = 0; i < frameCount; i++) dc += input[startFrame + i] || 0;
    dc /= frameCount;
    for (let i = 0; i < frameCount; i++) {
      const value = (input[startFrame + i] || 0) - dc;
      data[i] = value;
      peak = Math.max(peak, Math.abs(value));
    }
  }

  if (peak < 0.0005) {
    return makeFallbackLoopBuffer();
  }

  const gain = Math.min(18, 0.88 / peak);
  const fadeFrames = Math.min(Math.floor(LOOP_FADE_SECONDS * sampleRate), Math.floor(frameCount / 4));
  for (let channelIndex = 0; channelIndex < output.numberOfChannels; channelIndex++) {
    const data = output.getChannelData(channelIndex);
    for (let i = 0; i < frameCount; i++) data[i] *= gain;
    for (let i = 0; i < fadeFrames; i++) {
      const t = i / fadeFrames;
      const start = data[i];
      const end = data[frameCount - fadeFrames + i];
      data[i] = start * t + end * (1 - t);
      data[frameCount - fadeFrames + i] = end * (1 - t);
    }
  }

  return output;
}

function makeFallbackLoopBuffer() {
  const sampleRate = audio.sampleRate;
  const frameCount = Math.floor(sampleRate * SAMPLE_LOOP_SECONDS);
  const buffer = audio.createBuffer(1, frameCount, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    const t = i / sampleRate;
    data[i] = Math.sin(2 * Math.PI * 82 * t) * 0.35 + Math.sin(2 * Math.PI * 123 * t) * 0.12;
  }
  return buffer;
}

async function startMediaSampleLoop() {
  const media = new Audio(activeSample.url);
  media.preload = "auto";
  media.volume = 0.92;
  disablePitchPreservation(media);
  await waitForMediaMetadata(media);
  const duration = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : SAMPLE_LOOP_SECONDS;
  const loop = {
    start: 0,
    end: Math.min(duration, SAMPLE_LOOP_SECONDS),
  };
  media.currentTime = loop.start;
  const enforceLoop = () => {
    if (media.currentTime >= loop.end || media.currentTime < loop.start) {
      media.currentTime = loop.start;
    }
  };
  const loopTimer = setInterval(enforceLoop, 30);
  media.addEventListener("ended", enforceLoop);
  try {
    await media.play();
    previewLoop = { media, enforceLoop, loopTimer };
    els.playSample.textContent = "Stop Sample";
    els.playSample.classList.add("is-active");
  } catch (error) {
    clearInterval(loopTimer);
    media.removeEventListener("ended", enforceLoop);
    setAudioStatus("Media play failed", error.message || "Browser blocked file playback");
    showToast("Media play failed");
  }
}

function waitForMediaMetadata(media) {
  if (Number.isFinite(media.duration) && media.duration > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      media.removeEventListener("loadedmetadata", done);
      media.removeEventListener("canplay", done);
      resolve();
    };
    media.addEventListener("loadedmetadata", done, { once: true });
    media.addEventListener("canplay", done, { once: true });
    media.load();
    setTimeout(done, 1200);
  });
}

function stopSampleLoop() {
  if (!previewLoop) return;
  if (previewLoop.drone) {
    previewLoop.drone.stopSamplePlayback();
    previewLoop.drone.setMode("synth");
    previewLoop = null;
    els.playSample.textContent = "Sample Loop";
    els.playSample.classList.remove("is-active");
    return;
  }
  if (previewLoop.media) {
    clearInterval(previewLoop.loopTimer);
    previewLoop.media.removeEventListener("ended", previewLoop.enforceLoop);
    previewLoop.media.pause();
    previewLoop.media.src = "";
    previewLoop = null;
    els.playSample.textContent = "Sample Loop";
    els.playSample.classList.remove("is-active");
    return;
  }
  const now = audio?.currentTime || 0;
  try {
    previewLoop.gain.gain.cancelScheduledValues(now);
    previewLoop.gain.gain.setTargetAtTime(0.0001, now, 0.025);
    previewLoop.source.stop(now + 0.12);
  } catch {}
  previewLoop = null;
  els.playSample.textContent = "Sample Loop";
  els.playSample.classList.remove("is-active");
}

function disablePitchPreservation(media) {
  media.preservesPitch = false;
  media.mozPreservesPitch = false;
  media.webkitPreservesPitch = false;
}

function getSampleLoopBounds(buffer) {
  const duration = Math.max(0.05, buffer.duration);
  const loopLength = Math.min(duration, SAMPLE_LOOP_SECONDS);
  if (duration <= MIN_LOOP_SECONDS) {
    return { start: 0, end: duration };
  }

  const channel = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const windowSamples = Math.max(1, Math.floor(loopLength * sampleRate));
  const hopSamples = Math.max(1, Math.floor(0.1 * sampleRate));
  const stride = Math.max(1, Math.floor(sampleRate / 900));
  let bestStart = 0;
  let bestScore = -1;

  for (let start = 0; start + windowSamples < channel.length; start += hopSamples) {
    let sum = 0;
    let count = 0;
    for (let i = start; i < start + windowSamples; i += stride) {
      const value = channel[i];
      sum += value * value;
      count++;
    }
    const score = count ? sum / count : 0;
    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }

  const refinedStart = findZeroCrossing(channel, bestStart, sampleRate, "forward");
  const targetEnd = Math.min(channel.length - 1, refinedStart + windowSamples);
  const refinedEnd = findZeroCrossing(channel, targetEnd, sampleRate, "backward");
  const minEnd = Math.min(channel.length - 1, refinedStart + Math.floor(MIN_LOOP_SECONDS * sampleRate));
  const safeEnd = refinedEnd > minEnd ? refinedEnd : Math.min(channel.length - 1, refinedStart + windowSamples);

  return {
    start: refinedStart / sampleRate,
    end: Math.max((refinedStart + 1) / sampleRate, safeEnd / sampleRate),
  };
}

function findZeroCrossing(channel, index, sampleRate, direction) {
  const limit = Math.floor(0.04 * sampleRate);
  const step = direction === "backward" ? -1 : 1;
  let previous = channel[index] || 0;
  for (let offset = 1; offset < limit; offset++) {
    const nextIndex = index + offset * step;
    if (nextIndex <= 0 || nextIndex >= channel.length) break;
    const value = channel[nextIndex];
    if ((previous <= 0 && value >= 0) || (previous >= 0 && value <= 0)) {
      return nextIndex;
    }
    previous = value;
  }
  return clamp(index, 0, channel.length - 1);
}

function setAudioStatus(lineOne, lineTwo) {
  els.bankCount.textContent = lineOne;
  els.bankSize.textContent = lineTwo;
}

function makeId(prefix) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeNoiseBuffer() {
  const length = audio.sampleRate * 2;
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    last = last * 0.985 + (Math.random() * 2 - 1) * 0.015;
    data[i] = last * 3.2;
  }
  return buffer;
}

function makeDriveCurve(amount) {
  const curve = new Float32Array(2048);
  const k = amount;
  for (let i = 0; i < curve.length; i++) {
    const x = (i * 2) / curve.length - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

function setParam(param, value, now) {
  param.cancelScheduledValues(now);
  param.setTargetAtTime(value, now, 0.035);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0, edge1, value) {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function showToast(message) {
  const template = document.querySelector("#status-template");
  const toast = template.content.firstElementChild.cloneNode(true);
  toast.textContent = message;
  document.body.append(toast);
  setTimeout(() => toast.remove(), 3200);
}

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
