const fs = require("node:fs");
const path = require("node:path");

const lockFilePath = process.argv[2];
const dataDir = process.argv[3];
const sessionId = process.argv[4] || "chaos-worker-session";

if (!lockFilePath || !dataDir) {
  process.exit(1);
}

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 1. Escribir ego.lock del worker
const lockRecord = {
  pid: process.pid,
  sessionId,
  startedAt: Date.now(),
  lastHeartbeat: Date.now(),
  version: "0.1.0",
};
fs.writeFileSync(lockFilePath, JSON.stringify(lockRecord, null, 2), "utf8");

// 2. Loop de escrituras continuas
let count = 0;
const interval = setInterval(() => {
  count++;
  const filePath = path.join(dataDir, `item_${count}.json`);
  fs.writeFileSync(filePath, JSON.stringify({ index: count, data: "payload_data", ts: Date.now() }), "utf8");

  // Actualizar heartbeat periódicamente
  if (count % 5 === 0) {
    lockRecord.lastHeartbeat = Date.now();
    try {
      fs.writeFileSync(lockFilePath, JSON.stringify(lockRecord, null, 2), "utf8");
    } catch {
      // ignore
    }
  }

  if (count === 10 && process.send) {
    process.send({ status: "writing_active", count });
  }
}, 10);
