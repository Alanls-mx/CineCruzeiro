const { execSync } = require("child_process");

const PORTS = new Set(["3000", "4000"]);

function stopWindowsPorts() {
  const output = execSync("netstat -ano -p tcp", { encoding: "utf8" });
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
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      console.log(`Processo ${pid} finalizado.`);
    } catch {
      console.log(`Nao foi possivel finalizar o processo ${pid}.`);
    }
  });
}

function stopUnixPorts() {
  for (const port of PORTS) {
    try {
      execSync(`lsof -ti tcp:${port} | xargs kill -9`, { stdio: "ignore", shell: "/bin/sh" });
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
