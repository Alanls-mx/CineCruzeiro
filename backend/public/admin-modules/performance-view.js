((root) => {
  function createPerformanceView({ $, escapeHtml }) {
    let performancePeakCpu = 0;

function formatPerfBytes(bytes) {
  if (bytes == null || isNaN(bytes)) return "Indisponível";
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 ** 2);
  return `${mb.toFixed(0)} MB`;
}

function buildSmoothSvgPath(points, minY, maxY) {
  if (!points || !points.length) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    let cp1x = p1.x + (p2.x - p0.x) / 6;
    let cp1y = p1.y + (p2.y - p0.y) / 6;
    let cp2x = p2.x - (p3.x - p1.x) / 6;
    let cp2y = p2.y - (p3.y - p1.y) / 6;

    if (Math.abs(p1.y - p2.y) < 0.01) {
      cp1y = p1.y;
      cp2y = p2.y;
    }
    if (minY != null && maxY != null) {
      cp1y = Math.min(maxY, Math.max(minY, cp1y));
      cp2y = Math.min(maxY, Math.max(minY, cp2y));
    }
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function renderCapacityBar(percent, toneClass = "cpu") {
  const clamped = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  return `
    <div class="perf-bar-wrap" title="${clamped}%">
      <div class="perf-bar-fill tone-${toneClass}" style="width: ${clamped}%"></div>
    </div>
  `;
}

function renderPerformanceKpis(metrics, history) {
  const grid = $("perfKpiGrid");
  if (!grid) return;

  const cpu = metrics.cpuPercent != null ? Number(metrics.cpuPercent) : 0;
  performancePeakCpu = Math.max(performancePeakCpu, cpu);
  const cpuTone = cpu >= 85 ? "danger" : cpu >= 60 ? "amber" : "normal";
  const cpuBadge = cpu >= 85 ? "Sobrecarga" : cpu >= 60 ? "Moderado" : "Normal";

  const totalMem = Number(metrics.memoryTotal) || 1;
  const usedMem = Number(metrics.memoryUsed) || 0;
  const memPercent = Math.round((usedMem / totalMem) * 100);
  const memTone = memPercent >= 90 ? "danger" : memPercent >= 75 ? "amber" : "normal";

  const reqLatency = metrics.operationalRequestP95Ms ?? metrics.requestP95Ms;
  const latencyVal = reqLatency != null ? `${reqLatency} ms` : "Sem tráfego";
  const latencyTone = reqLatency == null ? "normal" : reqLatency < 250 ? "normal" : reqLatency < 800 ? "amber" : "danger";
  const latencyBadge = reqLatency == null ? "Ocioso" : reqLatency < 250 ? "Normal" : reqLatency < 800 ? "Atenção" : "Crítico";
  const latencyRatio = reqLatency != null ? Math.min(100, Math.round((reqLatency / 1500) * 100)) : 0;

  const diskTotal = Number(metrics.diskTotal) || 0;
  const diskAvail = Number(metrics.diskAvailable) || 0;
  const diskUsedPercent = diskTotal > 0 ? Math.round(((diskTotal - diskAvail) / diskTotal) * 100) : 0;
  const diskTone = diskUsedPercent >= 90 ? "danger" : diskUsedPercent >= 75 ? "amber" : "normal";

  const errors = Number(metrics.errors5xx) || 0;
  const externalLatency = metrics.externalRequestP95Ms != null ? `${metrics.externalRequestP95Ms} ms` : "Sem chamadas";
  const externalCount = Number(metrics.externalRequestCount) || 0;
  const adminTaskLatency = metrics.administrativeRequestP95Ms != null ? `${metrics.administrativeRequestP95Ms} ms` : "Sem tarefas";
  const adminTaskCount = Number(metrics.administrativeRequestCount) || 0;
  const adminTaskErrors = Number(metrics.administrativeErrors5xx) || 0;
  const healthBadge = errors === 0 ? "Estável" : `${errors} Falhas`;
  const healthTone = errors === 0 ? "normal" : "danger";

  grid.innerHTML = `
    <!-- Card 1: CPU -->
    <div class="perf-kpi-card">
      <div class="perf-kpi-head">
        <span class="perf-kpi-title">Uso de CPU</span>
        <span class="perf-kpi-badge ${cpuTone}">${cpuBadge}</span>
      </div>
      <div class="perf-kpi-body">
        <div class="perf-kpi-num-row">
          <span class="perf-kpi-big-num">${cpu}%</span>
          <span class="perf-kpi-pill-meta">${metrics.vcores || 2} vCPU</span>
        </div>
        <div class="perf-kpi-bar-row">
          ${renderCapacityBar(cpu, cpuTone === "danger" ? "danger" : cpuTone === "amber" ? "amber" : "cpu")}
        </div>
      </div>
      <div class="perf-kpi-footer">
        <span>Pico na sessão: <strong>${performancePeakCpu}%</strong></span>
        <span>Amostras: <strong>15s</strong></span>
      </div>
    </div>

    <!-- Card 2: Memória RAM -->
    <div class="perf-kpi-card">
      <div class="perf-kpi-head">
        <span class="perf-kpi-title">Memória RAM</span>
        <span class="perf-kpi-badge ${memTone}">${memPercent}% em uso</span>
      </div>
      <div class="perf-kpi-body">
        <div class="perf-kpi-num-row">
          <span class="perf-kpi-big-num">${formatPerfBytes(usedMem)}</span>
          <span class="perf-kpi-pill-meta">de ${formatPerfBytes(totalMem)}</span>
        </div>
        <div class="perf-kpi-bar-row">
          ${renderCapacityBar(memPercent, memTone === "danger" ? "danger" : memTone === "amber" ? "amber" : "ram")}
        </div>
      </div>
      <div class="perf-kpi-footer">
        <span>Backend (Node.js): <strong>${formatPerfBytes(metrics.processRss)}</strong></span>
        <span>Livre: <strong>${formatPerfBytes(totalMem - usedMem)}</strong></span>
      </div>
    </div>

    <!-- Card 3: Latência HTTP -->
    <div class="perf-kpi-card">
      <div class="perf-kpi-head">
        <span class="perf-kpi-title">Latência da operação HTTP (p95)</span>
        <span class="perf-kpi-badge ${latencyTone}">${latencyBadge}</span>
      </div>
      <div class="perf-kpi-body">
        <div class="perf-kpi-num-row">
          <span class="perf-kpi-big-num">${latencyVal}</span>
          <span class="perf-kpi-pill-meta">Janela: 5m</span>
        </div>
        <div class="perf-kpi-bar-row">
          ${renderCapacityBar(latencyRatio, latencyTone === "danger" ? "danger" : latencyTone === "amber" ? "amber" : "latency")}
        </div>
      </div>
      <div class="perf-kpi-footer">
        <span>Integrações: <strong>${externalLatency}</strong> em ${externalCount} reqs</span>
        <span>Administração: <strong>${adminTaskLatency}</strong> em ${adminTaskCount} tarefas${adminTaskErrors ? ` · ${adminTaskErrors} falhas` : ""}</span>
      </div>
    </div>

    <!-- Card 4: Disco do Servidor -->
    <div class="perf-kpi-card">
      <div class="perf-kpi-head">
        <span class="perf-kpi-title">Disco do Servidor</span>
        <span class="perf-kpi-badge ${healthTone}">${healthBadge}</span>
      </div>
      <div class="perf-kpi-body">
        <div class="perf-kpi-num-row">
          <span class="perf-kpi-big-num">${formatPerfBytes(diskAvail)}</span>
          <span class="perf-kpi-pill-meta">livres de ${formatPerfBytes(diskTotal)}</span>
        </div>
        <div class="perf-kpi-bar-row">
          ${renderCapacityBar(diskUsedPercent, diskTone === "danger" ? "danger" : diskTone === "amber" ? "amber" : "disk")}
        </div>
      </div>
      <div class="perf-kpi-footer">
        <span>Uso em disco: <strong>${diskUsedPercent}%</strong></span>
        <span>Erros 5xx: <strong>${errors}</strong></span>
      </div>
    </div>
  `;
}

function buildPerfTimeLabels(samples, xFn, height) {
  if (!samples || !samples.length) return "";
  if (samples.length === 1) {
    const d = new Date(samples[0].sampledAt);
    const tStr = isNaN(d.getTime()) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return `<text class="perf-axis-text" x="${xFn(0).toFixed(1)}" y="${height - 10}" text-anchor="middle">${tStr}</text>`;
  }

  const targetCount = Math.min(5, samples.length);
  const step = (samples.length - 1) / Math.max(1, targetCount - 1);
  const candidateIndices = [];
  for (let k = 0; k < targetCount; k++) {
    const idx = Math.round(k * step);
    if (!candidateIndices.includes(idx)) candidateIndices.push(idx);
  }

  const safeIndices = [];
  let lastX = -999;
  for (const idx of candidateIndices) {
    const posX = xFn(idx);
    if (posX - lastX >= 80) {
      safeIndices.push(idx);
      lastX = posX;
    }
  }

  const lastIdx = samples.length - 1;
  const lastPos = xFn(lastIdx);
  if (!safeIndices.includes(lastIdx)) {
    if (safeIndices.length > 0 && (lastPos - xFn(safeIndices[safeIndices.length - 1]) < 80)) {
      safeIndices[safeIndices.length - 1] = lastIdx;
    } else {
      safeIndices.push(lastIdx);
    }
  }

  return safeIndices.map((idx) => {
    const s = samples[idx];
    const d = new Date(s.sampledAt);
    const tStr = isNaN(d.getTime()) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return `<text class="perf-axis-text" x="${xFn(idx).toFixed(1)}" y="${height - 10}" text-anchor="middle">${tStr}</text>`;
  }).join("");
}

function renderPerformanceCharts(history, current) {
  let samples = Array.isArray(history) && history.length ? [...history] : [current];
  if (samples.length > 40) samples = samples.slice(-40);

  // Gráfico 1: CPU & RAM (%)
  const cpuContainer = $("perfCpuChartContainer");
  if (cpuContainer) {
    const width = 740;
    const height = 205;
    const padL = 42;
    const padR = 20;
    const padT = 16;
    const padB = 30;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;
    const bottomY = height - padB;

    const x = (i) => padL + (samples.length === 1 ? innerW / 2 : (i / (samples.length - 1)) * innerW);
    const yPct = (pct) => padT + (1 - Math.max(0, Math.min(100, pct || 0)) / 100) * innerH;

    const cpuPoints = samples.map((s, i) => ({ x: x(i), y: yPct(s.cpuPercent || 0), s }));
    const ramPoints = samples.map((s, i) => ({ x: x(i), y: yPct((s.memoryUsed / s.memoryTotal) * 100), s }));
    const appPoints = samples.map((s, i) => ({ x: x(i), y: yPct((s.processRss / s.memoryTotal) * 100), s }));

    const cpuLine = buildSmoothSvgPath(cpuPoints, padT, bottomY);
    const ramLine = buildSmoothSvgPath(ramPoints, padT, bottomY);
    const appLine = buildSmoothSvgPath(appPoints, padT, bottomY);

    const firstX = cpuPoints[0].x.toFixed(1);
    const lastX = cpuPoints[cpuPoints.length - 1].x.toFixed(1);
    const bottomYStr = bottomY.toFixed(1);

    const cpuArea = `${cpuLine} L ${lastX} ${bottomYStr} L ${firstX} ${bottomYStr} Z`;
    const ramArea = `${ramLine} L ${lastX} ${bottomYStr} L ${firstX} ${bottomYStr} Z`;

    const lastCpu = cpuPoints[cpuPoints.length - 1];
    const lastRam = ramPoints[ramPoints.length - 1];

    const gridLines = [0, 25, 50, 75, 100].map((pct) => {
      const lineY = yPct(pct).toFixed(1);
      return `
        <line class="perf-grid-line" x1="${padL}" y1="${lineY}" x2="${width - padR}" y2="${lineY}" />
        <text class="perf-axis-text" x="${padL - 8}" y="${Number(lineY) + 3}" text-anchor="end">${pct}%</text>
      `;
    }).join("");

    const timeLabels = buildPerfTimeLabels(samples, x, height);

    cpuContainer.innerHTML = `
      <svg class="perf-chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="cpuAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.16" />
            <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.0" />
          </linearGradient>
          <linearGradient id="ramAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#818cf8" stop-opacity="0.10" />
            <stop offset="100%" stop-color="#818cf8" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        ${gridLines}
        <path d="${ramArea}" fill="url(#ramAreaGrad)" />
        <path d="${cpuArea}" fill="url(#cpuAreaGrad)" />
        <path d="${ramLine}" fill="none" stroke="#818cf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="${appLine}" fill="none" stroke="#94a3b8" stroke-width="1.4" stroke-dasharray="3 3" stroke-linecap="round" />
        <path d="${cpuLine}" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
        <circle class="perf-live-dot" cx="${lastRam.x.toFixed(1)}" cy="${lastRam.y.toFixed(1)}" r="4" fill="#818cf8" />
        <circle class="perf-live-dot" cx="${lastCpu.x.toFixed(1)}" cy="${lastCpu.y.toFixed(1)}" r="4.5" fill="#38bdf8" stroke="#fff" stroke-width="1.5" />
        ${timeLabels}
      </svg>
      <div id="perfCpuTooltip" class="perf-tooltip-overlay" style="display:none;"></div>
    `;

    cpuContainer.onmousemove = (e) => {
      const rect = cpuContainer.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const idx = Math.min(samples.length - 1, Math.max(0, Math.round(relX * (samples.length - 1))));
      const s = samples[idx];
      const tip = $("perfCpuTooltip");
      if (tip && s) {
        tip.style.display = "block";
        const tStr = new Date(s.sampledAt).toLocaleTimeString("pt-BR");
        const ramUsedGb = formatPerfBytes(s.memoryUsed);
        tip.innerHTML = `<strong>${tStr}</strong> • CPU: <span style="color:#38bdf8">${s.cpuPercent}%</span> • RAM: <span style="color:#818cf8">${ramUsedGb} (${Math.round((s.memoryUsed/s.memoryTotal)*100)}%)</span> • Backend: <span style="color:#94a3b8">${formatPerfBytes(s.processRss)}</span>`;
      }
    };
    cpuContainer.onmouseleave = () => {
      const tip = $("perfCpuTooltip");
      if (tip) tip.style.display = "none";
    };
  }

  // Gráfico 2: Latência HTTP & Event Loop
  const latContainer = $("perfLatencyChartContainer");
  if (latContainer) {
    const width = 740;
    const height = 205;
    const padL = 46;
    const padR = 20;
    const padT = 16;
    const padB = 30;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;
    const bottomY = height - padB;

    const maxMs = Math.max(80, ...samples.map((s) => Math.max(Number(s.operationalRequestP95Ms ?? s.requestP95Ms) || 0, Number(s.eventLoopP95Ms) || 0))) * 1.15;
    const x = (i) => padL + (samples.length === 1 ? innerW / 2 : (i / (samples.length - 1)) * innerW);
    const yMs = (ms) => padT + (1 - Math.max(0, Number(ms) || 0) / maxMs) * innerH;

    const latPoints = samples.map((s, i) => ({ x: x(i), y: yMs(s.operationalRequestP95Ms ?? s.requestP95Ms ?? 0), s }));
    const loopPoints = samples.map((s, i) => ({ x: x(i), y: yMs(s.eventLoopP95Ms || 0), s }));

    const latLine = buildSmoothSvgPath(latPoints, padT, bottomY);
    const loopLine = buildSmoothSvgPath(loopPoints, padT, bottomY);

    const firstX = latPoints[0].x.toFixed(1);
    const lastX = latPoints[latPoints.length - 1].x.toFixed(1);
    const bottomYStr = bottomY.toFixed(1);
    const latArea = `${latLine} L ${lastX} ${bottomYStr} L ${firstX} ${bottomYStr} Z`;

    const lastLat = latPoints[latPoints.length - 1];
    const lastLoop = loopPoints[loopPoints.length - 1];

    const gridLines = [0, 0.33, 0.66, 1].map((ratio) => {
      const val = Math.round(maxMs * ratio);
      const lineY = yMs(val).toFixed(1);
      return `
        <line class="perf-grid-line" x1="${padL}" y1="${lineY}" x2="${width - padR}" y2="${lineY}" />
        <text class="perf-axis-text" x="${padL - 8}" y="${Number(lineY) + 3}" text-anchor="end">${val}ms</text>
      `;
    }).join("");

    const timeLabels = buildPerfTimeLabels(samples, x, height);

    latContainer.innerHTML = `
      <svg class="perf-chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="latencyAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.14" />
            <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        ${gridLines}
        <path d="${latArea}" fill="url(#latencyAreaGrad)" />
        <path d="${loopLine}" fill="none" stroke="#2dd4bf" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        <path d="${latLine}" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
        <circle class="perf-live-dot" cx="${lastLoop.x.toFixed(1)}" cy="${lastLoop.y.toFixed(1)}" r="3.5" fill="#2dd4bf" />
        <circle class="perf-live-dot" cx="${lastLat.x.toFixed(1)}" cy="${lastLat.y.toFixed(1)}" r="4.5" fill="#f59e0b" stroke="#fff" stroke-width="1.5" />
        ${timeLabels}
      </svg>
      <div id="perfLatTooltip" class="perf-tooltip-overlay" style="display:none;"></div>
    `;

    latContainer.onmousemove = (e) => {
      const rect = latContainer.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const idx = Math.min(samples.length - 1, Math.max(0, Math.round(relX * (samples.length - 1))));
      const s = samples[idx];
      const tip = $("perfLatTooltip");
      if (tip && s) {
        tip.style.display = "block";
        const tStr = new Date(s.sampledAt).toLocaleTimeString("pt-BR");
        const operationLatency = s.operationalRequestP95Ms ?? s.requestP95Ms;
        const latStr = operationLatency != null ? `${operationLatency} ms` : "0 ms";
        const adminStr = s.administrativeRequestP95Ms != null ? `${s.administrativeRequestP95Ms} ms` : "sem tarefas";
        tip.innerHTML = `<strong>${tStr}</strong> • Operação HTTP p95: <span style="color:#f59e0b">${latStr}</span> • Administração: <span style="color:#a78bfa">${adminStr}</span> • Event Loop: <span style="color:#2dd4bf">${s.eventLoopP95Ms} ms</span>`;
      }
    };
    latContainer.onmouseleave = () => {
      const tip = $("perfLatTooltip");
      if (tip) tip.style.display = "none";
    };
  }
}

function renderPerformanceAlerts(alerts = []) {
  const alertsEl = $("performanceAlerts");
  if (!alertsEl) return;
  if (!alerts.length) {
    alertsEl.className = "perf-alerts-bar";
    alertsEl.innerHTML = `
      <div class="perf-alert-healthy">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>
        <span>Todos os sistemas operando normalmente. Sem gargalos de CPU, memória, latência ou armazenamento.</span>
      </div>
    `;
    return;
  }
  alertsEl.className = "perf-alerts-bar has-alerts";
  alertsEl.innerHTML = alerts.map((alert) => `
    <div class="perf-alert-entry">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
      <span><strong>Atenção:</strong> ${escapeHtml(alert.message)}</span>
    </div>
  `).join("");
}

function renderPerformanceSlowRoutes(routes = []) {
  const container = $("performanceSlowRoutes");
  if (!container) return;
  const items = (Array.isArray(routes) ? routes : []).filter((route) => route?.route && route.requestP95Ms != null);
  if (!items.length) {
    container.innerHTML = "";
    container.hidden = true;
    return;
  }
  container.hidden = false;
  container.innerHTML = `
    <div class="perf-slow-routes-head">
      <strong>Rotas com maior tempo de resposta</strong>
      <span>Janela móvel de 5 minutos</span>
    </div>
    <div class="perf-slow-routes-list">
      ${items.map((route) => `
        <div class="perf-slow-route-row">
          <code>${escapeHtml(route.route)}</code>
          <span>${route.administrativeTask ? "Tarefa administrativa" : route.externalDependency ? "Integração externa" : "Operação"}</span>
          <strong>${Number(route.requestP95Ms || 0)} ms</strong>
          <small>${Number(route.requestCount || 0)} reqs${Number(route.errors5xx || 0) ? ` · ${Number(route.errors5xx)} erros` : ""}</small>
        </div>
      `).join("")}
    </div>
  `;
}
    return { renderPerformanceKpis, renderPerformanceCharts, renderPerformanceAlerts, renderPerformanceSlowRoutes };
  }

  const api = Object.freeze({ createPerformanceView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.CineAdminModules ||= {};
    root.CineAdminModules.performanceView = api;
  }
})(globalThis);
