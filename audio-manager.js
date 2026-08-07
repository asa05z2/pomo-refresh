"use strict";

class AudioManager {
  constructor() {
    this.tracks = { threeMinute: "3min.mp3", focus2: "focus2.mp3", birdRiver: "bird_river.mp3", rain: "rain.mp3", relax: "relax.mp3" };
    this.trackVolume = { threeMinute: 0.6 };
    this.currentAudio = null;
    this.currentTrack = null;
    this.completionCtx = null;
    this.fadeTimers = new Set();
    this.isPlaying = false;
    this.volume = this.readNumber("pomorefresh:volume", 0.35);
    this.isMuted = localStorage.getItem("pomorefresh:muted") === "true";
  }

  readNumber(key, fallback) {
    const stored = localStorage.getItem(key);
    if (stored === null || stored === "") return fallback;
    const value = Number(stored);
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : fallback;
  }

  createAudio(track) {
    if (!this.tracks[track]) return null;
    const audio = new Audio(this.tracks[track]);
    audio.loop = true; audio.preload = "auto"; audio.muted = this.isMuted; audio.volume = 0;
    return audio;
  }

  switchSound(track, duration = 1.4) {
    if (!this.tracks[track]) { this.stop(duration); return; }
    if (this.currentAudio && this.currentTrack === track) {
      if (this.currentAudio.paused) this.safePlay(this.currentAudio);
      this.fade(this.currentAudio, this.currentAudio.volume, this.targetVolume(track), duration);
      this.isPlaying = true;
      return;
    }
    const previous = this.currentAudio;
    const next = this.createAudio(track);
    this.currentAudio = next; this.currentTrack = track; this.isPlaying = true;
    this.safePlay(next); this.fade(next, 0, this.targetVolume(track), duration);
    if (previous) this.fade(previous, previous.volume, 0, duration, () => this.disposeAudio(previous));
  }

  safePlay(audio) {
    const request = audio.play();
    if (request && typeof request.catch === "function") request.catch(() => { if (audio === this.currentAudio) this.isPlaying = false; });
  }

  fade(audio, from, to, duration, onComplete) {
    const milliseconds = Math.max(0, duration * 1000);
    const startedAt = Date.now();
    audio.volume = this.clampVolume(from);
    if (milliseconds === 0) { audio.volume = this.clampVolume(to); if (onComplete) onComplete(); return; }
    const timer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / milliseconds);
      audio.volume = this.clampVolume(from + (to - from) * progress);
      if (progress >= 1) { clearInterval(timer); this.fadeTimers.delete(timer); if (onComplete) onComplete(); }
    }, 40);
    this.fadeTimers.add(timer);
  }

  clampVolume(value) { return Math.min(1, Math.max(0, Number(value) || 0)); }
  targetVolume(track = this.currentTrack) { return this.clampVolume(this.volume * (this.trackVolume[track] || 1)); }

  disposeAudio(audio) {
    audio.pause(); audio.removeAttribute("src"); audio.load();
  }

  setVolume(value) {
    this.volume = this.clampVolume(value);
    localStorage.setItem("pomorefresh:volume", String(this.volume));
    if (this.currentAudio) this.currentAudio.volume = this.targetVolume();
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
    localStorage.setItem("pomorefresh:muted", String(this.isMuted));
    if (this.currentAudio) this.currentAudio.muted = this.isMuted;
  }

  stop(duration = 1.2) {
    if (!this.currentAudio) return;
    const audio = this.currentAudio;
    this.currentAudio = null; this.currentTrack = null; this.isPlaying = false;
    this.fade(audio, audio.volume, 0, duration, () => this.disposeAudio(audio));
  }

  initCompletionAudio() {
    if (!this.completionCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      this.completionCtx = new AudioContextClass();
    }
    if (this.completionCtx.state === "suspended") this.completionCtx.resume();
    return true;
  }

  playCompletionSound() {
    if (this.isMuted || !this.initCompletionAudio()) return;
    const now = this.completionCtx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      const oscillator = this.completionCtx.createOscillator();
      const gain = this.completionCtx.createGain();
      const start = now + index * 0.13;
      oscillator.type = index === 3 ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, this.volume * 0.45), start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
      oscillator.connect(gain).connect(this.completionCtx.destination);
      oscillator.start(start); oscillator.stop(start + 0.58);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  }
}

if (typeof module === "object" && module.exports) module.exports = { AudioManager };
