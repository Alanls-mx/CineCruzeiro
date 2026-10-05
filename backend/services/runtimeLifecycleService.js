const fs = require("node:fs");
const path = require("node:path");

function createRuntimeLifecycle({ statePath, onEvent = () => {}, now = () => new Date(), pid = process.pid, intervalMs = 30000 } = {}) {
  let timer = null;
  let state = null;

  function writeState(nextState) {
    if (!statePath) return;
    try {
      fs.mkdirSync(path.dirname(statePath), { recursive: true });
      const temporary = `${statePath}.${pid}.tmp`;
      fs.writeFileSync(temporary, `${JSON.stringify(nextState)}\n`, { mode: 0o600 });
      fs.renameSync(temporary, statePath);
    } catch (error) {
      onEvent("warn", "service.runtime_state_write_failed", { errorType: error.name || "Error", message: error.message });
    }
  }

  function heartbeat() {
    if (!state || state.status !== "running") return;
    state = { ...state, lastHeartbeatAt: now().toISOString() };
    writeState(state);
  }

  function start(release = {}) {
    if (state) return;
    let previous = null;
    try {
      previous = JSON.parse(fs.readFileSync(statePath, "utf8"));
    } catch {}

    const startedAt = now();
    if (previous?.status === "running") {
      const lastHeartbeatAt = String(previous.lastHeartbeatAt || previous.startedAt || "");
      const outageDurationSeconds = lastHeartbeatAt && Number.isFinite(Date.parse(lastHeartbeatAt))
        ? Math.max(0, Math.round((startedAt.getTime() - Date.parse(lastHeartbeatAt)) / 1000))
        : null;
      onEvent("warn", "service.outage.recovered", {
        outageType: "process_exit_without_shutdown",
        cause: "O processo anterior deixou de responder sem registrar um encerramento normal; a causa exata não foi confirmada.",
        diagnosis: "Verifique os logs do PM2 e do sistema operacional, incluindo eventos de falta de memória (OOM).",
        lastHeartbeatAt,
        outageDurationSeconds,
        previousPid: previous.pid,
        previousVersion: previous.version || "",
        currentVersion: release.version || "",
        currentCommit: release.commitShort || ""
      });
    }

    state = {
      status: "running",
      pid,
      startedAt: startedAt.toISOString(),
      lastHeartbeatAt: startedAt.toISOString(),
      version: release.version || "",
      commit: release.commitShort || "",
      release: release.release || ""
    };
    writeState(state);
    timer = setInterval(heartbeat, intervalMs);
    timer.unref?.();
    onEvent("info", "service.runtime.started", {
      version: state.version,
      commit: state.commit,
      release: state.release,
      pid
    });
  }

  function stop(signal = "unknown") {
    if (timer) clearInterval(timer);
    timer = null;
    if (!state || state.status !== "running") return;
    state = { ...state, status: "stopped", stoppedAt: now().toISOString(), signal };
    writeState(state);
    onEvent("info", "service.runtime.stopped", {
      version: state.version,
      commit: state.commit,
      release: state.release,
      signal
    });
  }

  return { start, stop, heartbeat };
}

module.exports = { createRuntimeLifecycle };
