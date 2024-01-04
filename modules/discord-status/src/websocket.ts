import type { ServerWebSocket } from "bun";

import { redis } from "./clients";
import {
  errorMessage,
  type Message,
  pingMessage,
  statusMessage,
} from "./messages";

type Data = ReturnType<typeof setTimeout>;

export const sockets = new Set<ServerWebSocket<Data>>();

export async function open(ws: ServerWebSocket<Data>) {
  sockets.add(ws);

  // Send the current status to the client
  ws.send(statusMessage((await redis.get("discord-status"))!));

  // Send a ping every minute to keep the connection alive
  const timeoutHandle = setInterval(() => ws.send(pingMessage), 60_000);
  ws.data = timeoutHandle;
}

export function close(ws: ServerWebSocket<Data>) {
  // Clear the ping interval
  if (ws.data) clearInterval(ws.data);

  sockets.delete(ws);
}

export async function message(ws: ServerWebSocket<Data>, msg: string | Buffer) {
  // Ignore messages that aren't strings
  if (typeof msg !== "string") return;

  // Parse the message as JSON
  try {
    const data = JSON.parse(msg) as Message;

    switch (data.type) {
      // Send the current status to the client, when requested
      case "request":
        ws.send(statusMessage((await redis.get("discord-status"))!));
        break;

      // Valid, but no response needed
      case "ping":
        break;

      default:
        throw new Error(`Unknown message type: ${data.type}`);
    }
  } catch (e) {
    ws.send(errorMessage(e as Error | string));
  }
}
