import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Proxy API requests til backend
app.use("/api", createProxyMiddleware({
    target: BACKEND_URL,
    changeOrigin: true,
    onProxyReq: (proxyReq, req) => {
        console.log(`[Proxy] ${req.method} ${BACKEND_URL}${req.originalUrl}`);
    },
    onProxyRes: (proxyRes, req) => {
        console.log(`[Proxy] Response: ${proxyRes.statusCode} for ${req.originalUrl}`);
    },
    onError: (err, req, res) => {
        console.error(`[Proxy] Error: ${err.message} for ${req.originalUrl}`);
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