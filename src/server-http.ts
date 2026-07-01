import path from "path";
import http from "http";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
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

// Store active transports by session ID
const transports = new Map<string, SSEServerTransport>();

const httpServer = http.createServer(async (req, res) => {

    // Health check for CF
    if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", service: "mcp-integration-suite" }));
        return;
    }

    // SSE connection endpoint
    if (req.method === "GET" && req.url === "/sse") {
        logInfo("New SSE connection established");

        const mcpServer = new McpServerWithMiddleware(
            { name: "integration-suite", version: "1.0.0" },
            { capabilities: { resources: {}, tools: {} } }
        );
        registerAllHandlers(mcpServer);

        const transport = new SSEServerTransport("/messages", res);

        transports.set(transport.sessionId, transport);

        transport.onclose = () => {
            logInfo(`SSE connection closed: ${transport.sessionId}`);
            transports.delete(transport.sessionId);
        };

        await mcpServer.connect(transport);
        return;
    }

    // Message POST endpoint
    if (req.method === "POST" && req.url?.startsWith("/messages")) {
        const urlParams = new URL(req.url, `http://localhost`).searchParams;
        const sessionId = urlParams.get("sessionId") ?? "";

        let transport = transports.get(sessionId);

        if (!transport && transports.size === 1) {
            transport = transports.values().next().value;
        }

        if (!transport) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "No active session found" }));
            return;
        }

        await transport.handlePostMessage(req, res);
        return;
    }

    res.writeHead(404);
    res.end();
});

httpServer.listen(PORT, () => {
    logInfo(`MCP HTTP server running on port ${PORT}`);
    console.log(`MCP HTTP server running on port ${PORT}`);
});