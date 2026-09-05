import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createProcessSupervisor } from "../process-supervisor.mjs";

class FakeChild extends EventEmitter {
  constructor() {
    super();
    this.exitCode = null;
    this.signalCode = null;
    this.kills = [];
  }
  kill(signal) {
    this.kills.push(signal);
    return true;
  }
  exit(code = 0, signal = null) {
    this.exitCode = signal ? null : code;
    this.signalCode = signal;
    this.emit("exit", this.exitCode, signal);
  }
  fail(error = new Error("spawn failed")) {
    this.emit("error", error);
  }
}

function fakeSchedule() {
  const timers = [];
  return {
    timers,
    schedule(fn, ms) {
      const timer = { fn, ms, cancelled: false, unref() {} };
      timers.push(timer);
      return timer;
    },
    cancel(timer) { timer.cancelled = true; },
    fire(timer) { if (!timer.cancelled) timer.fn(); },
  };
}

test("unexpected zero exit is fatal and terminates surviving children", () => {
  const api = new FakeChild();
  const site = new FakeChild();
  const commerce = new FakeChild();
  const clock = fakeSchedule();
  const exitCodes = [];
  const supervisor = createProcessSupervisor({
    children: [{ name: "api", child: api }, { name: "site", child: site }, { name: "commerce", child: commerce }],
    setExitCode: (code) => exitCodes.push(code),
    schedule: clock.schedule,
    cancelSchedule: clock.cancel,
    logger: null,
  });

  commerce.exit(0);

  assert.equal(supervisor.shuttingDown, true);
  assert.equal(supervisor.shutdownSignal, "SIGTERM");
  assert.deepEqual(exitCodes, [1]);
  assert.deepEqual(api.kills, ["SIGTERM"]);
  assert.deepEqual(site.kills, ["SIGTERM"]);
  assert.deepEqual(commerce.kills, []);
});

test("unexpected signal exit is fatal and signal-terminated children count as complete", () => {
  const api = new FakeChild();
  const commerce = new FakeChild();
  const clock = fakeSchedule();
  const exitCodes = [];
  const supervisor = createProcessSupervisor({
    children: [{ name: "api", child: api }, { name: "commerce", child: commerce }],
    setExitCode: (code) => exitCodes.push(code),
    schedule: clock.schedule,
    cancelSchedule: clock.cancel,
    logger: null,
  });

  commerce.exit(null, "SIGKILL");
  assert.deepEqual(exitCodes, [1]);
  assert.deepEqual(supervisor.remaining().map(({ name }) => name), ["api"]);

  api.exit(null, "SIGTERM");
  assert.equal(supervisor.remaining().length, 0);
  assert.equal(clock.timers[0].cancelled, true);
});

test("child spawn error is terminal and shuts down already-running siblings", () => {
  const api = new FakeChild();
  const commerce = new FakeChild();
  const clock = fakeSchedule();
  const exitCodes = [];
  const supervisor = createProcessSupervisor({
    children: [{ name: "api", child: api }, { name: "commerce", child: commerce }],
    setExitCode: (code) => exitCodes.push(code),
    schedule: clock.schedule,
    cancelSchedule: clock.cancel,
    logger: null,
  });

  commerce.fail();

  assert.equal(supervisor.shuttingDown, true);
  assert.deepEqual(exitCodes, [1]);
  assert.deepEqual(supervisor.remaining().map(({ name }) => name), ["api"]);
  assert.deepEqual(api.kills, ["SIGTERM"]);
  assert.deepEqual(commerce.kills, []);
});

test("external shutdown preserves graceful signal and cancels force-kill once all children exit", () => {
  const api = new FakeChild();
  const commerce = new FakeChild();
  const clock = fakeSchedule();
  const supervisor = createProcessSupervisor({
    children: [{ name: "api", child: api }, { name: "commerce", child: commerce }],
    shutdownGraceMs: 12_000,
    schedule: clock.schedule,
    cancelSchedule: clock.cancel,
    logger: null,
  });

  assert.equal(supervisor.shutdown("SIGTERM"), true);
  assert.equal(supervisor.graceMs, 12_000);
  assert.deepEqual(api.kills, ["SIGTERM"]);
  assert.deepEqual(commerce.kills, ["SIGTERM"]);
  assert.equal(supervisor.shutdown("SIGINT"), false);

  api.exit(null, "SIGTERM");
  commerce.exit(0);
  assert.equal(clock.timers[0].cancelled, true);
  clock.fire(clock.timers[0]);
  assert.deepEqual(api.kills, ["SIGTERM"]);
  assert.deepEqual(commerce.kills, ["SIGTERM"]);
});

test("shutdown grace expiry force-kills only surviving children", () => {
  const api = new FakeChild();
  const commerce = new FakeChild();
  const clock = fakeSchedule();
  const supervisor = createProcessSupervisor({
    children: [{ name: "api", child: api }, { name: "commerce", child: commerce }],
    shutdownGraceMs: 5_000,
    schedule: clock.schedule,
    cancelSchedule: clock.cancel,
    logger: null,
  });

  supervisor.shutdown("SIGTERM");
  api.exit(0);
  clock.fire(clock.timers[0]);

  assert.deepEqual(api.kills, ["SIGTERM"]);
  assert.deepEqual(commerce.kills, ["SIGTERM", "SIGKILL"]);
});
