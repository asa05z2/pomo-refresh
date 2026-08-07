"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { PlantManager } = require("../plant-manager.js");

function createStorage(initial) {
  const values = new Map();
  if (initial) values.set("pomorefresh:plant", JSON.stringify(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    saved: () => JSON.parse(values.get("pomorefresh:plant"))
  };
}

test("初期状態は種・成長0・水分70・水やり0", () => {
  const manager = new PlantManager(createStorage(), () => 1000);
  assert.deepEqual(manager.state, { growthPt: 0, waterPt: 0, moisture: 70, plantStage: 1, updatedAt: 1000 });
});

test("適正水分で集中すると成長ポイントが1.2倍になる", () => {
  const manager = new PlantManager(createStorage(), () => 1000);
  const reward = manager.rewardFocus(10);
  assert.deepEqual(reward, { earned: 12, bonus: 1.2 });
  assert.equal(manager.state.growthPt, 12);
  assert.equal(manager.state.moisture, 64);
  assert.equal(manager.state.plantStage, 2);
});

test("乾燥中は成長ボーナスを付けない", () => {
  const storage = createStorage({ growthPt: 0, waterPt: 0, moisture: 30, plantStage: 1, updatedAt: 1000 });
  const manager = new PlantManager(storage, () => 1000);
  assert.deepEqual(manager.rewardFocus(10), { earned: 10, bonus: 1 });
});

test("成長ポイントの閾値で5段階へ進化する", () => {
  const manager = new PlantManager(createStorage(), () => 1000);
  assert.deepEqual([0, 3, 15, 40, 90].map((points) => manager.stageFor(points)), [1, 2, 3, 4, 5]);
});

test("水やりポイント1を消費して水分を20回復する", () => {
  const storage = createStorage({ growthPt: 0, waterPt: 0, moisture: 35, plantStage: 1, updatedAt: 1000 });
  const manager = new PlantManager(storage, () => 1000);
  manager.earnWater(2);
  assert.equal(manager.water(), true);
  assert.equal(manager.state.waterPt, 1);
  assert.equal(manager.state.moisture, 55);
});

test("水やりポイントがなければ水分を回復しない", () => {
  const manager = new PlantManager(createStorage(), () => 1000);
  assert.equal(manager.water(), false);
  assert.equal(manager.state.moisture, 70);
});

test("長期間不在でも植物は消滅せず、水分だけが0まで低下する", () => {
  const start = 1000;
  const storage = createStorage({ growthPt: 45, waterPt: 2, moisture: 70, plantStage: 4, updatedAt: start });
  const manager = new PlantManager(storage, () => start + 30 * 86400000);
  assert.equal(manager.state.moisture, 0);
  assert.equal(manager.state.growthPt, 45);
  assert.equal(manager.state.plantStage, 4);
  assert.equal(manager.water(), true);
  assert.equal(manager.state.moisture, 20);
});
