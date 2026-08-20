"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { DataManager } = require("../data-manager.js");

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (key) => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key), value: (key) => JSON.parse(values.get(key)) };
}

test("タスクを優先順位と作成順で並べる", () => {
  let now = new Date("2026-08-19T10:00:00+09:00").getTime(); const store = storage(); const manager = new DataManager(store, () => now);
  manager.addTask("B first", "B"); now += 1; manager.addTask("A first", "A"); now += 1; manager.addTask("A second", "A");
  assert.deepEqual(manager.sortedOpenTasks().map((task) => task.name), ["A first", "A second", "B first"]);
});

test("タスク完了数は再完了しても二重計上しない", () => {
  const now = new Date("2026-08-19T10:00:00+09:00").getTime(); const manager = new DataManager(storage(), () => now); const task = manager.addTask("finish");
  manager.completeTask(task.id); manager.reopenTask(task.id); manager.completeTask(task.id);
  assert.equal(manager.lastSevenDays().at(-1).completedTasks, 1);
});

test("セッション詳細を100件に制限し日別集計へ実集中時間を加える", () => {
  const now = new Date("2026-08-19T10:00:00+09:00").getTime(); const manager = new DataManager(storage(), () => now);
  for (let i = 0; i < 105; i += 1) manager.recordSession({ modeId: "quick", focusedSeconds: 60, outcome: "completed" });
  assert.equal(manager.history().length, 100); assert.equal(manager.lastSevenDays().at(-1).focusSeconds, 6300);
});

test("停止中・実行中・期限切れの復元状態を分類する", () => {
  let now = 100000; const store = storage(); const manager = new DataManager(store, () => now);
  manager.saveTimer({ running: false, remaining: 60 }); assert.equal(manager.timerRecovery().type, "recoverable");
  manager.saveTimer({ running: true, endAt: now + 1000 }); now += 2000; assert.equal(manager.timerRecovery().type, "overdue");
  manager.saveTimer({ running: false, remaining: 60 }); now += 86400001; assert.equal(manager.timerRecovery().type, "expired");
});
