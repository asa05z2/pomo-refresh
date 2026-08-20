"use strict";

class DataManager {
  constructor(storage = localStorage, now = () => Date.now()) {
    this.storage = storage;
    this.now = now;
    this.keys = {
      tasks: "pomorefresh:tasks",
      history: "pomorefresh:sessionHistory",
      daily: "pomorefresh:dailyStats",
      timer: "pomorefresh:timerState"
    };
  }

  read(key, fallback) {
    try { const value = JSON.parse(this.storage.getItem(key)); return value ?? fallback; }
    catch { return fallback; }
  }

  write(key, value) { this.storage.setItem(key, JSON.stringify(value)); return value; }
  id() { return `${this.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`; }
  localDate(timestamp = this.now()) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  tasks() {
    const tasks = this.read(this.keys.tasks, []);
    return Array.isArray(tasks) ? tasks.filter((task) => task && typeof task.name === "string") : [];
  }

  saveTasks(tasks) { return this.write(this.keys.tasks, tasks); }
  addTask(name, priority = "B") {
    const cleanName = String(name || "").trim().slice(0, 40);
    if (!cleanName) return null;
    const tasks = this.tasks();
    if (tasks.filter((task) => !task.completed).length >= 100) return null;
    const task = { id: this.id(), name: cleanName, priority: ["A", "B", "C"].includes(priority) ? priority : "B", completed: false, createdAt: new Date(this.now()).toISOString(), completedAt: null, completionCounted: false };
    tasks.push(task); this.saveTasks(tasks); return task;
  }

  updateTask(id, changes) {
    const tasks = this.tasks(); const task = tasks.find((item) => item.id === id);
    if (!task) return null;
    if (changes.name !== undefined) { const name = String(changes.name).trim().slice(0, 40); if (name) task.name = name; }
    if (["A", "B", "C"].includes(changes.priority)) task.priority = changes.priority;
    this.saveTasks(tasks); return task;
  }

  completeTask(id) {
    const tasks = this.tasks(); const task = tasks.find((item) => item.id === id);
    if (!task || task.completed) return task || null;
    task.completed = true; task.completedAt = new Date(this.now()).toISOString();
    if (!task.completionCounted) { this.incrementDaily("completedTasks", 1); task.completionCounted = true; }
    this.saveTasks(tasks); return task;
  }

  reopenTask(id) {
    const tasks = this.tasks(); const task = tasks.find((item) => item.id === id);
    if (!task) return null;
    task.completed = false; task.completedAt = null; this.saveTasks(tasks); return task;
  }

  deleteTask(id) { const tasks = this.tasks().filter((task) => task.id !== id); this.saveTasks(tasks); }
  sortedOpenTasks() {
    const rank = { A: 0, B: 1, C: 2 };
    return this.tasks().filter((task) => !task.completed).sort((a, b) => (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1) || new Date(a.createdAt) - new Date(b.createdAt));
  }

  history() { const history = this.read(this.keys.history, []); return Array.isArray(history) ? history : []; }
  recordSession(session) {
    const endedAt = session.endedAt || new Date(this.now()).toISOString();
    const entry = { id: this.id(), ...session, endedAt };
    this.write(this.keys.history, [...this.history(), entry].slice(-100));
    this.incrementDaily("focusSeconds", Math.max(0, Number(entry.focusedSeconds) || 0), Date.parse(endedAt));
    this.incrementDaily("sessions", 1, Date.parse(endedAt));
    if (entry.outcome === "completed") this.incrementDaily("completedSessions", 1, Date.parse(endedAt));
    else if (entry.outcome === "tired") this.incrementDaily("tiredSessions", 1, Date.parse(endedAt));
    return entry;
  }

  daily() { const daily = this.read(this.keys.daily, {}); return daily && typeof daily === "object" && !Array.isArray(daily) ? daily : {}; }
  incrementDaily(field, amount, timestamp = this.now()) {
    const daily = this.daily(); const date = this.localDate(Number.isFinite(timestamp) ? timestamp : this.now());
    daily[date] ||= { focusSeconds: 0, sessions: 0, completedSessions: 0, tiredSessions: 0, completedTasks: 0 };
    daily[date][field] = Math.max(0, Number(daily[date][field]) || 0) + amount;
    const cutoff = this.now() - 89 * 86400000;
    Object.keys(daily).forEach((key) => { if (new Date(`${key}T23:59:59`).getTime() < cutoff) delete daily[key]; });
    this.write(this.keys.daily, daily);
  }

  lastSevenDays() {
    const daily = this.daily(); const result = [];
    const today = new Date(this.now()); today.setHours(12, 0, 0, 0);
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(today); date.setDate(today.getDate() - offset); const key = this.localDate(date.getTime());
      result.push({ date: key, ...{ focusSeconds: 0, sessions: 0, completedSessions: 0, tiredSessions: 0, completedTasks: 0 }, ...(daily[key] || {}) });
    }
    return result;
  }

  saveTimer(state) { return this.write(this.keys.timer, { ...state, savedAt: this.now() }); }
  timerState() { const state = this.read(this.keys.timer, null); return state && typeof state === "object" ? state : null; }
  clearTimer() { this.storage.removeItem(this.keys.timer); }
  timerRecovery(maxAge = 86400000) {
    const state = this.timerState(); if (!state) return { type: "none", state: null };
    if (!Number.isFinite(state.savedAt) || this.now() - state.savedAt > maxAge) { this.clearTimer(); return { type: "expired", state }; }
    if (state.running && Number.isFinite(state.endAt) && state.endAt <= this.now()) return { type: "overdue", state };
    return { type: "recoverable", state };
  }
}

if (typeof module === "object" && module.exports) module.exports = { DataManager };
