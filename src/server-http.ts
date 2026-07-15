import path from "path";
import http from "http";
import { randomUUID } from "crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { registerAllHandlers } from "./handlers";
import { config } from "dotenv";
import { McpServerWithMiddleware } from "./utils/middleware";
import fs from "fs";

// Self-contained projPath - no import from index.ts
export const projPath = path.resolve(__dirname, "..");

config({ path: path.join(projPath, ".env") });

// Self-contained logging - no import from index.ts
const log_file = fs.createWriteStream(path.resolve(projPath, "serverlog.txt"), {
    flags: "a", encoding: "utf-8", mode: 0o666,
});
const err_log_file = fs.createWriteStream(path.resolve(projPath, "errorlog.txt"), {
    flags: "a", encoding: "utf-8", mode: 0o666,
});

const logInfo = (msg: any) => {
    try { log_file.write(`${new Date().toISOString()} ${msg}\n`); } catch {}
};
const logError = (msg: any) => {
    try { err_log_file.write(`${new Date().toISOString()} ${msg}\n`); } catch {}
};

process.on("uncaughtException", (err) => {
    logError(err);
    process.exit(2);
});

const PORT = parseInt(process.env.PORT || "3000");

// Store active Streamable HTTP transports by session ID
const transports = new Map<string, StreamableHTTPServerTransport>();

// Read and JSON-parse a request body (Streamable HTTP posts JSON-RPC messages).
const readJsonBody = (req: http.IncomingMessage): Promise<any> =>
    new Promise((resolve, reject) => {
        let raw = "";
        req.on("data", (chunk) => { raw += chunk; });
        req.on("end", () => {
            if (!raw) { resolve(undefined); return; }
            try { resolve(JSON.parse(raw)); } catch (err) { reject(err); }
        });
        req.on("error", reject);
    });

const httpServer = http.createServer(async (req, res) => {

    // Health check for CF
    if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", service: "mcp-integration-suite-chris" }));
        return;
    }

    // Streamable HTTP endpoint (replaces the deprecated SSE transport)
    if (req.url?.startsWith("/mcp")) {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;

        // POST: client -> server JSON-RPC messages
        if (req.method === "POST") {
            let body: any;
            try {
                body = await readJsonBody(req);
            } catch {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    jsonrpc: "2.0",
                    error: { code: -32700, message: "Parse error: invalid JSON" },
                    id: null,
                }));
                return;
            }

            let transport: StreamableHTTPServerTransport;

            if (sessionId && transports.has(sessionId)) {
                // Reuse the transport for an established session
                transport = transports.get(sessionId)!;
            } else if (!sessionId && isInitializeRequest(body)) {
                // New session: create a transport + server and connect them
                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => randomUUID(),
                    onsessioninitialized: (sid) => {
                        logInfo(`Streamable HTTP session initialized: ${sid}`);
                        transports.set(sid, transport);
                    },
                });

                transport.onclose = () => {
                    if (transport.sessionId) {
                        logInfo(`Streamable HTTP session closed: ${transport.sessionId}`);
                        transports.delete(transport.sessionId);
                    }
                };

                const mcpServer = new McpServerWithMiddleware(
                    { name: "integration-suite", version: "1.0.0" },
                    { capabilities: { resources: {}, tools: {} } }
                );
                registerAllHandlers(mcpServer);

                await mcpServer.connect(transport);
            } else {
                // No valid session and not an initialize request
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    jsonrpc: "2.0",
                    error: { code: -32000, message: "Bad Request: No valid session ID provided" },
                    id: null,
                }));
                return;
            }

            await transport.handleRequest(req, res, body);
            return;
        }

        // GET: server -> client notification stream; DELETE: terminate session
        if (req.method === "GET" || req.method === "DELETE") {
            if (!sessionId || !transports.has(sessionId)) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    jsonrpc: "2.0",
                    error: { code: -32000, message: "Bad Request: Invalid or missing session ID" },
                    id: null,
                }));
                return;
            }

            await transports.get(sessionId)!.handleRequest(req, res);
            return;
        }

        res.writeHead(405, { "Allow": "GET, POST, DELETE" });
        res.end();
        return;
    }

    res.writeHead(404);
    res.end();
});

httpServer.listen(PORT, () => {
    logInfo(`MCP HTTP server running on port ${PORT}`);
    console.log(`MCP HTTP server running on port ${PORT}`);
});
