import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { readReleaseInfo } from "../backend/services/releaseInfoService.js";
import { createRuntimeLifecycle } from "../backend/services/runtimeLifecycleService.js";
const require = createRequire(import.meta.url);
const { createPerformanceMonitor } = require("../backend/services/performanceMonitor.js");
import { releaseMetadata } from "../scripts/deploy-all-vps.mjs";

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test("release ativa expõe versão, commit e alterações anotadas", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cine-release-info-"));
  try {
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ version: "2.4.0" }));
    fs.writeFileSync(path.join(root, "feature.js"), "export const old = true;\n");
    git(root, "init", "--quiet");
    git(root, "config", "user.email", "qa@example.test");
    git(root, "config", "user.name", "Release QA");
    git(root, "add", ".");
    git(root, "commit", "--quiet", "-m", "Versão inicial");
    fs.writeFileSync(path.join(root, "feature.js"), "export const live = true;\n");
    git(root, "add", "feature.js");
    git(root, "commit", "--quiet", "-m", "Melhora disponibilidade", "-m", "Registra quedas e recuperação no histórico.");
    const commit = git(root, "rev-parse", "HEAD");

    const manifest = releaseMetadata(root, commit, "20261005-120000-1234567", "20261004-120000-7654321");
    fs.writeFileSync(path.join(root, "release-info.json"), JSON.stringify(manifest));
    const actual = readReleaseInfo({ rootDir: root });

    assert.equal(actual.version, `2.4.0+${commit.slice(0, 7)}`);
    assert.equal(actual.commit, commit);
    assert.equal(actual.release, "20261005-120000-1234567");
    assert.equal(actual.previousRelease, "20261004-120000-7654321");
    assert.match(actual.summary, /Melhora disponibilidade/);
    assert.match(actual.summary, /Registra quedas e recuperação/);
    assert.deepEqual(actual.files, ["feature.js"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runtime distingue parada planejada de processo que reiniciou sem encerramento limpo", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cine-runtime-state-"));
  const statePath = path.join(root, "runtime-state.json");
  const events = [];
  try {
    fs.writeFileSync(statePath, JSON.stringify({
      status: "running", pid: 10, version: "2.3.0+aaaaaaa", startedAt: "2026-10-05T12:00:00.000Z",
      lastHeartbeatAt: "2026-10-05T12:00:30.000Z"
    }));
    const lifecycle = createRuntimeLifecycle({
      statePath,
      pid: 11,
      now: () => new Date("2026-10-05T12:01:00.000Z"),
      onEvent: (level, event, fields) => events.push({ level, event, fields })
    });
    lifecycle.start({ version: "2.4.0+bbbbbbb", commitShort: "bbbbbbb", release: "new-release" });
    assert.equal(events[0].event, "service.outage.recovered");
    assert.equal(events[0].fields.outageType, "process_exit_without_shutdown");
    assert.equal(events[0].fields.outageDurationSeconds, 30);
    lifecycle.stop("SIGTERM");

    events.length = 0;
    const afterPlannedRestart = createRuntimeLifecycle({
      statePath,
      pid: 12,
      now: () => new Date("2026-10-05T12:02:00.000Z"),
      onEvent: (level, event, fields) => events.push({ level, event, fields })
    });
    afterPlannedRestart.start({ version: "2.4.0+bbbbbbb", commitShort: "bbbbbbb" });
    assert.equal(events.some((event) => event.event === "service.outage.recovered"), false);
    afterPlannedRestart.stop("SIGTERM");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("monitor publica cada amostra assim que ela fica pronta", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cine-performance-stream-"));
  const samples = [];
  const monitor = createPerformanceMonitor({
    diskPath: root,
    intervalMs: 40,
    onSample: (sample) => samples.push(sample)
  });
  try {
    await new Promise((resolve) => setTimeout(resolve, 180));
    assert.ok(samples.length >= 2);
    assert.equal(samples.at(-1).sampledAt, monitor.snapshot().current.sampledAt);
    assert.equal(monitor.snapshot().history.at(-1).sampledAt, samples.at(-1).sampledAt);
  } finally {
    monitor.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
