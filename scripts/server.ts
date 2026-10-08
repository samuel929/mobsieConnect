import { createServer } from "node:http";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";

import { verifyParentToken } from "../server/parentAuth";
import { subscribeRealtime } from "../server/realtime";

async function main() {
const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

await app.prepare();

const server = createServer((request, response) => handler(request, response));
const sockets = new WebSocketServer({ noServer: true });

sockets.on("connection", (socket) => {
  let unsubscribe: (() => void) | null = null;
  const authTimer = setTimeout(() => socket.close(4401, "Authentication required"), 10_000);

  socket.on("message", async (raw) => {
    if (unsubscribe) return;
    try {
      const message = JSON.parse(raw.toString()) as { type?: string; token?: string };
      if (message.type !== "authenticate" || !message.token) throw new Error("Missing token");
      const parent = await verifyParentToken(message.token);
      clearTimeout(authTimer);
      unsubscribe = subscribeRealtime({
        tenantId: parent.tenantId,
        parentAccountId: parent.id,
        send: (payload) => {
          if (socket.readyState === WebSocket.OPEN) socket.send(payload);
        },
      });
      socket.send(JSON.stringify({ type: "ready" }));
    } catch {
      socket.close(4401, "Invalid session");
    }
  });
  socket.on("close", () => {
    clearTimeout(authTimer);
    unsubscribe?.();
  });
});

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (url.pathname !== "/api/realtime") {
    socket.destroy();
    return;
  }
  sockets.handleUpgrade(request, socket, head, (websocket) => sockets.emit("connection", websocket, request));
});

server.listen(port, hostname, () => {
  console.log(`Mobsie Connect ready on http://${hostname}:${port}`);
  const processScheduledPush = () => fetch(`http://127.0.0.1:${port}/api/internal/process-scheduled-notifications`, {
    method: "POST",
    headers: process.env.CRON_SECRET ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : undefined,
  }).catch((error) => console.error("Scheduled push processing failed", error));
  setTimeout(processScheduledPush, 5_000);
  setInterval(processScheduledPush, 60_000).unref();
});
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
