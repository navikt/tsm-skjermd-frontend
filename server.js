import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 8080;
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";
const TOKEN_EXCHANGE_ENDPOINT = process.env.NAIS_TOKEN_EXCHANGE_ENDPOINT;
// Target audience for OBO token exchange (backend app)
const BACKEND_TARGET_AUDIENCE = process.env.BACKEND_TARGET_AUDIENCE || "api://dev-gcp.team-service-management.tsm-skjermd/.default";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(`[Startup] Backend URL: ${BACKEND_URL}`);
console.log(`[Startup] Token Exchange Endpoint: ${TOKEN_EXCHANGE_ENDPOINT || 'NOT SET (local dev mode)'}`);
console.log(`[Startup] Backend Target Audience: ${BACKEND_TARGET_AUDIENCE}`);

// Parse JSON bodies
app.use(express.json());

// Log ALL incoming requests
app.use((req, res, next) => {
    console.log(`[Express] ${req.method} ${req.url}`);
    next();
});

// Token cache for OBO tokens
const tokenCache = new Map();

async function exchangeToken(userToken) {
    if (!TOKEN_EXCHANGE_ENDPOINT) {
        console.log(`[OBO] No token exchange endpoint - using original token (local dev)`);
        return userToken;
    }

    // Check cache
    const cacheKey = `${userToken.slice(-20)}_${BACKEND_TARGET_AUDIENCE}`;
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        console.log(`[OBO] Using cached token`);
        return cached.token;
    }

    console.log(`[OBO] Exchanging token for audience: ${BACKEND_TARGET_AUDIENCE}`);

    try {
        const response = await fetch(TOKEN_EXCHANGE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                identity_provider: 'entra_id',
                target: BACKEND_TARGET_AUDIENCE,
                user_token: userToken,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[OBO] Token exchange failed: ${response.status} ${response.statusText}`);
            console.error(`[OBO] Error body: ${errorText}`);
            throw new Error(`Token exchange failed: ${response.status}`);
        }

        const data = await response.json();
        console.log(`[OBO] Token exchange successful, expires in ${data.expires_in}s`);

        // Cache with buffer (subtract 60 seconds)
        tokenCache.set(cacheKey, {
            token: data.access_token,
            expiresAt: Date.now() + (data.expires_in - 60) * 1000,
        });

        return data.access_token;
    } catch (error) {
        console.error(`[OBO] Token exchange error:`, error);
        throw error;
    }
}

// Proxy API requests til backend
app.use('/api', async (req, res) => {
    const startTime = Date.now();
    try {
        const targetUrl = `${BACKEND_URL}/api${req.url}`;
        console.log(`[Proxy] ${req.method} ${targetUrl}`);

        // Get user token from Wonderwall
        const authHeader = req.headers.authorization;
        console.log(`[Proxy] Authorization header present: ${!!authHeader}`);

        if (!authHeader) {
            console.error(`[Proxy] No Authorization header - user not authenticated`);
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // Exchange token for backend
        const userToken = authHeader.replace('Bearer ', '');
        let backendToken;
        try {
            backendToken = await exchangeToken(userToken);
        } catch (error) {
            console.error(`[Proxy] Token exchange failed:`, error);
            return res.status(401).json({ error: 'Token exchange failed', message: error.message });
        }

        // Build request headers
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${backendToken}`,
        };

        // Forward correlation ID if present
        if (req.headers['x-correlation-id']) {
            headers['X-Correlation-Id'] = req.headers['x-correlation-id'];
        }

        const options = {
            method: req.method,
            headers: headers,
        };

        // Include body for POST/PUT/PATCH requests
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            options.body = JSON.stringify(req.body);
            console.log(`[Proxy] Request body:`, JSON.stringify(req.body));
        }

        console.log(`[Proxy] Forwarding to: ${targetUrl}`);
        const response = await fetch(targetUrl, options);
        const duration = Date.now() - startTime;

        console.log(`[Proxy] Response: ${response.status} ${response.statusText} (${duration}ms)`);

        // Forward status code
        res.status(response.status);

        // Forward response based on content type
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            if (response.status >= 400) {
                console.error(`[Proxy] Error response:`, JSON.stringify(data, null, 2));
            }
            res.json(data);
        } else if (response.status === 204) {
            res.end();
        } else {
            const text = await response.text();
            if (response.status >= 400) {
                console.error(`[Proxy] Error response (text):`, text);
            }
            res.send(text);
        }
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[Proxy] Error (${duration}ms):`, error);
        res.status(500).json({
            error: 'Proxy request failed',
            message: error.message,
        });
    }
});

// Serve statiske filer fra dist/
app.use(express.static(path.join(__dirname, "dist")));

// Håndter SPA-routing ved å alltid returnere index.html
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
