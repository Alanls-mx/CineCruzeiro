const { spawn } = require("child_process");
const net = require("net");

const processes = [];

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => {
        server.close(() => resolve(true));
      })
      .listen(port, "0.0.0.0");
  });
}

function run(label, commandLine) {
  const child = spawn(commandLine, {
    shell: true,
    stdio: "pipe",
    env: process.env,
  });

  processes.push(child);

  child.stdout.on("data", (data) => {
    process.stdout.write(`[${label}] ${data}`);
  });

  child.stderr.on("data", (data) => {
    process.stderr.write(`[${label}] ${data}`);
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[${label}] exited with code ${code}`);
      shutdown(code);
    }
  });
}

function shutdown(code = 0) {
  while (processes.length) {
    const child = processes.pop();
    if (child && !child.killed) child.kill();
  }
  process.exit(code);
}

async function main() {
  const busyPorts = [];
  for (const port of [3000, 4000]) {
    if (!(await isPortFree(port))) busyPorts.push(port);
  }

  if (busyPorts.length) {
    console.error(`Porta(s) ocupada(s): ${busyPorts.join(", ")}.`);
    console.error("Rode npm run dev:stop e tente npm run dev novamente.");
    process.exit(1);
  }

  run("backend", "node backend/server.js");
  run("frontend", "next dev");

  console.log("Cine Cruzeiro local:");
  console.log("Landing: http://localhost:3000");
  console.log("Admin:   http://localhost:4000/admin");
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

main();
