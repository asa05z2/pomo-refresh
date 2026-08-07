"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { AudioManager } = require("../audio-manager.js");

class AudioMock {
  static instances = [];
  constructor(src) {
    this.src = src; this.loop = false; this.preload = ""; this.muted = false;
    this.volume = 1; this.paused = true; this.removedSource = false;
    AudioMock.instances.push(this);
  }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  removeAttribute(name) { if (name === "src") { this.src = ""; this.removedSource = true; } }
  load() {}
}

class AudioParamMock {
  constructor() { this.value = 0; }
  setValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
}

class AudioNodeMock {
  constructor() { this.frequency = new AudioParamMock(); this.gain = new AudioParamMock(); this.started = false; this.stopped = false; }
  connect(destination) { return destination; }
  disconnect() {}
  start() { this.started = true; }
  stop() { this.stopped = true; }
}

class AudioContextMock {
  constructor() { this.state = "suspended"; this.currentTime = 1; this.destination = new AudioNodeMock(); this.oscillators = []; }
  resume() { this.state = "running"; return Promise.resolve(); }
  createOscillator() { const node = new AudioNodeMock(); this.oscillators.push(node); return node; }
  createGain() { return new AudioNodeMock(); }
}

function installBrowserMocks(values = {}) {
  const storage = new Map(Object.entries(values));
  global.localStorage = {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, value)
  };
  AudioMock.instances = [];
  global.Audio = AudioMock;
  global.window = { AudioContext: AudioContextMock };
  return storage;
}

test("指定された5つのMP3をトラックへ割り当てる", () => {
  installBrowserMocks();
  const manager = new AudioManager();
  assert.deepEqual(manager.tracks, {
    threeMinute: "3min.mp3",
    focus2: "focus2.mp3",
    birdRiver: "bird_river.mp3",
    rain: "rain.mp3",
    relax: "relax.mp3"
  });
});

test("未設定時は音量35%・ミュート解除を使用する", () => {
  installBrowserMocks();
  const manager = new AudioManager();
  assert.equal(manager.volume, 0.35);
  assert.equal(manager.isMuted, false);
});

test("MP3をループ設定で再生する", () => {
  installBrowserMocks();
  const manager = new AudioManager();
  manager.switchSound("threeMinute", 0);
  assert.equal(manager.currentAudio.src, "3min.mp3");
  assert.equal(manager.currentAudio.loop, true);
  assert.equal(manager.currentAudio.preload, "auto");
  assert.equal(manager.currentAudio.paused, false);
  assert.equal(manager.currentAudio.volume, 0.21);
  manager.stop(0);
});

test("3分専用音源だけを設定音量から40%下げる", () => {
  installBrowserMocks();
  const manager = new AudioManager();
  manager.setVolume(0.5);
  manager.switchSound("threeMinute", 0);
  assert.equal(manager.currentAudio.volume, 0.3);
  manager.stop(0);
  manager.switchSound("focus2", 0);
  assert.equal(manager.currentAudio.volume, 0.5);
  manager.stop(0);
});

test("再生中の音量変更にも3分音源の補正を適用する", () => {
  installBrowserMocks();
  const manager = new AudioManager();
  manager.switchSound("threeMinute", 0);
  manager.setVolume(0.8);
  assert.equal(manager.currentAudio.volume, 0.48);
  manager.stop(0);
});

test("集中曲から休憩曲へクロスフェードして以前の音源を解放する", async () => {
  installBrowserMocks();
  const manager = new AudioManager();
  manager.switchSound("rain", 0);
  const rain = manager.currentAudio;
  manager.switchSound("relax", 0.001);
  assert.equal(manager.currentAudio.src, "relax.mp3");
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(rain.paused, true);
  assert.equal(rain.removedSource, true);
  manager.stop(0);
});

test("音量とミュート設定を保存し、再生中の音源へ反映する", () => {
  const storage = installBrowserMocks();
  const manager = new AudioManager();
  manager.switchSound("focus2", 0);
  manager.setVolume(0.62); manager.setMuted(true);
  assert.equal(storage.get("pomorefresh:volume"), "0.62");
  assert.equal(storage.get("pomorefresh:muted"), "true");
  assert.equal(manager.currentAudio.volume, 0.62);
  assert.equal(manager.currentAudio.muted, true);
  manager.stop(0);
});

test("停止時に音源を一時停止してsrcを解放する", () => {
  installBrowserMocks();
  const manager = new AudioManager();
  manager.switchSound("birdRiver", 0);
  const audio = manager.currentAudio;
  manager.stop(0);
  assert.equal(manager.currentAudio, null);
  assert.equal(manager.isPlaying, false);
  assert.equal(audio.paused, true);
  assert.equal(audio.removedSource, true);
});

test("リフレッシュ完了時にWeb Audio APIで4音のチャイムを生成する", () => {
  installBrowserMocks();
  const manager = new AudioManager();
  assert.equal(manager.completionCtx, null);
  manager.initCompletionAudio();
  manager.playCompletionSound();
  assert.equal(manager.completionCtx.state, "running");
  assert.equal(manager.completionCtx.oscillators.length, 4);
  assert.ok(manager.completionCtx.oscillators.every((node) => node.started && node.stopped));
});

test("ミュート中はリフレッシュ完了音を再生しない", () => {
  installBrowserMocks({ "pomorefresh:muted": "true" });
  const manager = new AudioManager();
  manager.initCompletionAudio();
  manager.playCompletionSound();
  assert.equal(manager.completionCtx.oscillators.length, 0);
});
