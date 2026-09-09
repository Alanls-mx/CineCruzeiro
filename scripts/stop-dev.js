const { execFileSync } = require("child_process");

const PORTS = new Set(["3000", "4000"]);

function stopWindowsPorts() {
  const output = execFileSync("netstat", ["-ano", "-p", "tcp"], { encoding: "utf8" });
  const pids = new Set();

  output.split(/\r?\n/).forEach((line) => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) return;
    const localAddress = parts[1] || "";
    const state = parts[3] || "";
    const pid = parts[4] || "";
    const port = localAddress.split(":").pop();
    if (PORTS.has(port) && state === "LISTENING" && pid) {
      pids.add(pid);
    }
  });

  if (!pids.size) {
    console.log("Nenhum servidor local nas portas 3000/4000.");
    return;
  }

  pids.forEach((pid) => {
    try {
      execFileSync("taskkill", ["/PID", pid, "/F"], { stdio: "ignore" });
      console.log(`Processo ${pid} finalizado.`);
    } catch {
      console.log(`Nao foi possivel finalizar o processo ${pid}.`);
    }
  });
}

function stopUnixPorts() {
  for (const port of PORTS) {
    try {
      const output = execFileSync("lsof", ["-ti", `tcp:${port}`], { encoding: "utf8" });
      output.split(/\s+/).filter((pid) => /^\d+$/.test(pid)).forEach((pid) => process.kill(Number(pid), "SIGTERM"));
      console.log(`Porta ${port} liberada.`);
    } catch {
      // Port was already free.
    }
  }
}

if (process.platform === "win32") {
  stopWindowsPorts();
} else {
  stopUnixPorts();
}
