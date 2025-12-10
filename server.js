import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
const PORT = process.env.PORT || 8080;
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log ALL incoming requests
app.use((req, res, next) => {
    console.log(`[Express] ${req.method} ${req.url}`);
    next();
});

// Proxy API requests til backend
console.log(`[Startup] Setting up proxy to: ${BACKEND_URL}`);
app.use("/api", createProxyMiddleware({
    target: BACKEND_URL,
    changeOrigin: true,
    secure: false,
    logLevel: 'debug',
    pathRewrite: (path) => {
        // Express stripper /api fra req.url, så vi må legge det tilbake
        const newPath = `/api${path}`;
        console.log(`[Proxy] Rewriting path: ${path} -> ${newPath}`);
        return newPath;
    },
    onProxyReq: (proxyReq, req) => {
        console.log(`[Proxy] Forwarding: ${req.method} ${BACKEND_URL}${proxyReq.path}`);
        console.log(`[Proxy] Authorization header present: ${!!req.headers.authorization}`);
        // Log all headers for debugging
        console.log(`[Proxy] Request headers:`, JSON.stringify(req.headers, null, 2));
    },
    onProxyRes: (proxyRes, req) => {
        console.log(`[Proxy] Response: ${proxyRes.statusCode} for ${req.originalUrl}`);
    },
    onError: (err, req, res) => {
        console.error(`[Proxy] Error: ${err.message} for ${req.originalUrl}`);
        console.error(`[Proxy] Error details:`, err);
        res.status(502).json({ error: 'Proxy error', message: err.message });
    },
}));

// Serve statiske filer fra dist/
app.use(express.static(path.join(__dirname, "dist")));

// Håndter SPA-routing ved å alltid returnere index.html
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Backend URL: ${BACKEND_URL}`);
});