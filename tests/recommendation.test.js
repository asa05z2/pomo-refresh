"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateRecommendation, classifySessionOutcome } = require("../recommendation.js");

const MODES = [
  { id: "quick", name: "とりあえず3分", focus: 3 },
  { id: "short", name: "ショート", focus: 15 },
  { id: "classic", name: "クラシック", focus: 25 },
  { id: "long", name: "ロング", focus: 50 },
  { id: "ultradian", name: "ウルトラディアン", focus: 90 }
];

const tired = (modeId, minutes) => ({ modeId, focusedSeconds: minutes * 60, outcome: "tired" });
const completed = (modeId, minutes) => ({ modeId, focusedSeconds: minutes * 60, outcome: "completed" });

test("25分モードで15〜20分の中断が続くと15分モードを提案する", () => {
  const result = calculateRecommendation([
    tired("classic", 15), tired("classic", 18), tired("classic", 20)
  ], MODES, "classic");

  assert.equal(result.mode.id, "short");
  assert.equal(result.typicalMinutes, 18);
  assert.equal(result.sampleSize, 3);
});

test("履歴が3件未満なら提案しない", () => {
  const result = calculateRecommendation([
    tired("classic", 15), tired("classic", 18)
  ], MODES, "classic");

  assert.equal(result, null);
});

test("途中休憩が直近5件の60%なら提案する", () => {
  const result = calculateRecommendation([
    completed("classic", 25), tired("classic", 16), completed("classic", 25),
    tired("classic", 18), tired("classic", 20)
  ], MODES, "classic");

  assert.equal(result.mode.id, "short");
  assert.equal(result.sampleSize, 3);
});

test("途中休憩が60%未満なら提案しない", () => {
  const result = calculateRecommendation([
    tired("classic", 16), completed("classic", 25), completed("classic", 25),
    tired("classic", 18), completed("classic", 25)
  ], MODES, "classic");

  assert.equal(result, null);
});

test("同一モードの直近5件だけを判定に使う", () => {
  const oldInterruptions = [tired("classic", 15), tired("classic", 16), tired("classic", 17)];
  const recentCompletions = Array.from({ length: 5 }, () => completed("classic", 25));

  assert.equal(calculateRecommendation([...oldInterruptions, ...recentCompletions], MODES, "classic"), null);
});

test("他モードの履歴を判定に混ぜない", () => {
  const result = calculateRecommendation([
    tired("long", 20), tired("long", 22), tired("long", 24),
    completed("classic", 25), completed("classic", 25), completed("classic", 25)
  ], MODES, "classic");

  assert.equal(result, null);
});

test("50分モードで30分前後の中断なら25分モードを提案する", () => {
  const result = calculateRecommendation([
    tired("long", 28), tired("long", 30), tired("long", 34)
  ], MODES, "long");

  assert.equal(result.mode.id, "classic");
  assert.equal(result.typicalMinutes, 30);
});

test("15分モードで短時間の中断が続くと3分モードを提案する", () => {
  const result = calculateRecommendation([
    tired("short", 5), tired("short", 8), tired("short", 10)
  ], MODES, "short");

  assert.equal(result.mode.id, "quick");
});

test("最短の3分モードでは途中休憩が続いても提案しない", () => {
  const result = calculateRecommendation([
    tired("quick", 1), tired("quick", 1.5), tired("quick", 2)
  ], MODES, "quick");

  assert.equal(result, null);
});

test("不正な履歴値を途中休憩のサンプルから除外する", () => {
  const result = calculateRecommendation([
    tired("classic", 15),
    { modeId: "classic", focusedSeconds: Number.NaN, outcome: "tired" },
    { modeId: "classic", focusedSeconds: -60, outcome: "tired" },
    completed("classic", 25)
  ], MODES, "classic");

  assert.equal(result, null);
});

test("残り時間が10%ちょうどで疲れた場合は完了扱いにする", () => {
  assert.equal(classifySessionOutcome(150, 1500, true), "completed");
});

test("残り時間が10%未満で疲れた場合は完了扱いにする", () => {
  assert.equal(classifySessionOutcome(5, 1500, true), "completed");
});

test("残り時間が10%を超えて疲れた場合は途中休憩扱いにする", () => {
  assert.equal(classifySessionOutcome(151, 1500, true), "tired");
});

test("通常のタイマー終了は完了扱いにする", () => {
  assert.equal(classifySessionOutcome(0, 1500, false), "completed");
});
