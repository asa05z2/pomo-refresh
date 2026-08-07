"use strict";

class PlantManager {
  constructor(storage = localStorage, now = () => Date.now()) {
    this.storage = storage;
    this.now = now;
    this.key = "pomorefresh:plant";
    this.stageThresholds = [0, 3, 15, 40, 90];
    this.state = this.load();
    this.applyTimeDecay();
  }

  initialState() {
    return { growthPt: 0, waterPt: 0, moisture: 70, plantStage: 1, updatedAt: this.now() };
  }

  load() {
    try {
      const saved = JSON.parse(this.storage.getItem(this.key));
      if (!saved || typeof saved !== "object") return this.initialState();
      return {
        growthPt: Math.max(0, Number(saved.growthPt) || 0),
        waterPt: Math.max(0, Math.floor(Number(saved.waterPt) || 0)),
        moisture: this.clamp(Number(saved.moisture), 0, 100, 70),
        plantStage: this.clamp(Math.floor(Number(saved.plantStage)), 1, 5, 1),
        updatedAt: Number(saved.updatedAt) || this.now()
      };
    } catch { return this.initialState(); }
  }

  save() {
    this.state.plantStage = this.stageFor(this.state.growthPt);
    this.state.updatedAt = this.now();
    this.storage.setItem(this.key, JSON.stringify(this.state));
  }

  clamp(value, min, max, fallback = min) {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  }

  applyTimeDecay() {
    const elapsedDays = Math.max(0, this.now() - this.state.updatedAt) / 86400000;
    if (elapsedDays > 0) this.state.moisture = this.clamp(this.state.moisture - elapsedDays * 5, 0, 100);
    this.save();
  }

  stageFor(growthPt) {
    let stage = 1;
    this.stageThresholds.forEach((threshold, index) => { if (growthPt >= threshold) stage = index + 1; });
    return stage;
  }

  moistureStatus() {
    if (this.state.moisture < 20) return { label: "しおれ気味", optimal: false };
    if (this.state.moisture < 40) return { label: "少し乾燥", optimal: false };
    if (this.state.moisture <= 85) return { label: "ちょうどいい", optimal: true };
    return { label: "水たっぷり", optimal: false };
  }

  growthProgress() {
    const stage = this.state.plantStage;
    if (stage >= 5) return { value: 100, current: this.state.growthPt, next: null };
    const currentThreshold = this.stageThresholds[stage - 1];
    const nextThreshold = this.stageThresholds[stage];
    return {
      value: ((this.state.growthPt - currentThreshold) / (nextThreshold - currentThreshold)) * 100,
      current: this.state.growthPt,
      next: nextThreshold
    };
  }

  rewardFocus(minutes) {
    const base = Math.max(0, Number(minutes) || 0);
    const bonus = this.moistureStatus().optimal ? 1.2 : 1;
    const earned = Math.round(base * bonus * 10) / 10;
    this.state.growthPt = Math.round((this.state.growthPt + earned) * 10) / 10;
    this.state.moisture = this.clamp(this.state.moisture - base * 0.6, 0, 100);
    this.save();
    return { earned, bonus };
  }

  earnWater(points) {
    const earned = Math.max(0, Math.floor(Number(points) || 0));
    this.state.waterPt += earned;
    this.save();
    return earned;
  }

  water() {
    if (this.state.waterPt < 1 || this.state.moisture >= 100) return false;
    this.state.waterPt -= 1;
    this.state.moisture = this.clamp(this.state.moisture + 20, 0, 100);
    this.save();
    return true;
  }
}

if (typeof module === "object" && module.exports) module.exports = { PlantManager };
