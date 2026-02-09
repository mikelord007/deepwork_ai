/**
 * Opik (Comet) client for LLM tracing. Optional: if OPIK_API_KEY is not set, all helpers no-op.
 */
import { Opik } from "opik";

let _client: Opik | null | undefined = undefined;

export function getOpik(): Opik | null {
  if (_client === undefined) {
    const key = process.env.OPIK_API_KEY;
    _client = key && key.trim() ? new Opik() : null;
  }
  return _client ?? null;
}

export async function flushOpik(): Promise<void> {
  const client = getOpik();
  if (client) await client.flush();
}
