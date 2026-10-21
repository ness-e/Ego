import * as fs from "node:fs";
import * as path from "node:path";
import { LockFileRecord } from "../../src/types.js";

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
const lockRecord: LockFileRecord = {
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

  // Actualizar heartbeat cada 5 escrituras
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

// Mantener activo indefinidamente esperando el hard-kill