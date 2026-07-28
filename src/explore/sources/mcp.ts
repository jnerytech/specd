import type { ExploreSource } from "../../config/schema.js";
import { authHeaders } from "./http.js";
import {
  SourceConfigError,
  type Collector,
  type CollectorContext,
} from "./types.js";

export interface McpPayload {
  url: string;
  tool: string;
  result: unknown;
}

// The `mcp` source calls one tool on an MCP server over the Streamable HTTP
// transport: a JSON-RPC `tools/call` POST.
//
// Version 1 handles the JSON response mode only. A server that answers with an
// SSE stream reports the source as failed with that reason, rather than being
// half-parsed into a payload nobody can trust.
export const mcpCollector: Collector = {
  type: "mcp",
  async collect(
    source: ExploreSource,
    _ctx: CollectorContext,
  ): Promise<McpPayload> {
    const { url, tool } = source;
    if (url === undefined)
      throw new SourceConfigError(source, 'requires "url".');
    if (tool === undefined) {
      throw new SourceConfigError(source, 'requires "tool", the tool to call.');
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...authHeaders(source),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: tool, arguments: source.arguments ?? {} },
      }),
    });

    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `MCP ${url} responded ${response.status} ${response.statusText}: ${text.slice(0, 200)}`,
      );
    }
    if (contentType.includes("text/event-stream")) {
      throw new Error(
        `MCP ${url} answered with an SSE stream; this version reads the JSON response mode only.`,
      );
    }

    const envelope = JSON.parse(text) as {
      result?: unknown;
      error?: { code: number; message: string };
    };
    if (envelope.error) {
      throw new Error(
        `MCP tool "${tool}" failed: ${envelope.error.message} (code ${envelope.error.code})`,
      );
    }

    return { url, tool, result: envelope.result ?? null };
  },
};
