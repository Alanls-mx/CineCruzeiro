const mode = process.env.CINE_OPERATION_MODE;
const instance = process.env.CINE_INSTANCE_SLUG;

if (instance !== "cinecruzeiro" || !["quiescent", "normal"].includes(mode)) {
  throw new Error("CINE_OPERATION_MODE_INVALID: selecione cinema e modo explicitamente.");
}

if (mode === "quiescent") {
  const { createMaintenanceServer } = require("./maintenanceServer");
  const server = createMaintenanceServer({ instance, expectedSha: process.env.CINE_EXPECTED_SHA });
  const host = process.env.HOST || "127.0.0.1";
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("MAINTENANCE_PORT_INVALID");
  server.listen(port, host, () => console.log(`CINE_QUIESCENT_READY instance=${instance} port=${port}`));
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.once(signal, () => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10000).unref?.();
    });
  }
} else {
  if (process.env.CINE_EXPECTED_SHA !== require("./services/releaseInfoService").readReleaseInfo().commit) {
    throw new Error("MAINTENANCE_RELEASE_MISMATCH");
  }
  require("./server");
}
