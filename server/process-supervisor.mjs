const DEFAULT_SHUTDOWN_GRACE_MS = 30_000;

function normalizeGraceMs(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1000) return DEFAULT_SHUTDOWN_GRACE_MS;
  return Math.min(Math.floor(parsed), 60_000);
}

function hasExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

export function createProcessSupervisor({
  children,
  shutdownGraceMs = DEFAULT_SHUTDOWN_GRACE_MS,
  logger = console,
  setExitCode = (code) => { process.exitCode = code; },
  schedule = setTimeout,
  cancelSchedule = clearTimeout,
} = {}) {
  if (!Array.isArray(children) || children.length === 0) throw new TypeError("children are required");
  const entries = children.map((entry, index) => {
    const child = entry?.child || entry;
    if (!child || typeof child.on !== "function" || typeof child.kill !== "function") throw new TypeError(`child ${index} is invalid`);
    return { name: entry?.name || `child-${index + 1}`, child };
  });
  const graceMs = normalizeGraceMs(shutdownGraceMs);
  let shuttingDown = false;
  let shutdownTimer = null;
  let shutdownSignal = null;

  function remaining() {
    return entries.filter(({ child }) => !hasExited(child));
  }

  function clearShutdownTimer() {
    if (shutdownTimer !== null) {
      cancelSchedule(shutdownTimer);
      shutdownTimer = null;
    }
  }

  function finishIfComplete() {
    if (!shuttingDown || remaining().length > 0) return false;
    clearShutdownTimer();
    return true;
  }

  function killRemaining(signal) {
    for (const { name, child } of remaining()) {
      try {
        child.kill(signal);
      } catch (error) {
        logger?.error?.(`[process-supervisor] failed to signal ${name} with ${signal}`, error);
        setExitCode(1);
      }
    }
  }

  function shutdown(signal = "SIGTERM", { failureCode = null } = {}) {
    if (failureCode !== null) setExitCode(Math.max(1, Number(failureCode) || 1));
    if (shuttingDown) return false;
    shuttingDown = true;
    shutdownSignal = signal;
    killRemaining(signal);
    if (!finishIfComplete()) {
      shutdownTimer = schedule(() => {
        const survivors = remaining();
        if (!survivors.length) return;
        logger?.error?.(`[process-supervisor] shutdown grace expired; force-killing ${survivors.map(({ name }) => name).join(", ")}`);
        killRemaining("SIGKILL");
      }, graceMs);
      shutdownTimer?.unref?.();
    }
    return true;
  }

  for (const { name, child } of entries) {
    child.on("exit", (code, signal) => {
      if (!shuttingDown) {
        const failureCode = Number.isInteger(code) && code !== 0 ? code : 1;
        logger?.error?.(`[process-supervisor] ${name} exited unexpectedly`, { code, signal });
        shutdown("SIGTERM", { failureCode });
      }
      finishIfComplete();
    });
  }

  return Object.freeze({
    shutdown,
    remaining,
    get shuttingDown() { return shuttingDown; },
    get shutdownSignal() { return shutdownSignal; },
    get graceMs() { return graceMs; },
  });
}
