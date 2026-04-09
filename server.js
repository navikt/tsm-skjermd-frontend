import crypto from "crypto";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

function log(category, message, ...args) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${category}] ${message}`, ...args);
}

function logError(category, message, ...args) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [${category}] ${message}`, ...args);
}

const app = express();
const PORT = process.env.PORT || 8080;
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";
const TOKEN_EXCHANGE_ENDPOINT = process.env.NAIS_TOKEN_EXCHANGE_ENDPOINT;
// Target audience for OBO token exchange (backend app)
const BACKEND_TARGET_AUDIENCE = process.env.BACKEND_TARGET_AUDIENCE || "api://dev-gcp.team-service-management.tsm-skjermd/.default";
const EMBED_API_KEY = process.env.EMBED_API_KEY;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

log('Startup', `Backend URL: ${BACKEND_URL}`);
log('Startup', `Token Exchange Endpoint: ${TOKEN_EXCHANGE_ENDPOINT || 'NOT SET (local dev mode)'}`);
log('Startup', `Backend Target Audience: ${BACKEND_TARGET_AUDIENCE}`);
log('Startup', `Embed API Key: ${EMBED_API_KEY ? 'SET' : 'NOT SET'}`);

// Embed token store: Map<embedToken, { email, sakId, expiresAt }>
const embedTokenStore = new Map();
const EMBED_TOKEN_TTL_MS = 3600 * 1000;

function cleanupExpiredEmbedTokens() {
    const now = Date.now();
    for (const [key, value] of embedTokenStore) {
        if (value.expiresAt < now) {
            embedTokenStore.delete(key);
        }
    }
}

setInterval(cleanupExpiredEmbedTokens, 60 * 1000);

// Parse JSON bodies
app.use(express.json());

// Log ALL incoming requests
app.use((req, res, next) => {
    log('Express', `${req.method} ${req.url}`);
    next();
});

// Helper function to decode JWT payload (without verification - Wonderwall already verified)
function decodeJwtPayload(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
        return JSON.parse(payload);
    } catch (error) {
        logError('JWT', 'Failed to decode token:', error);
        return null;
    }
}

// Endpoint to get current user info from Wonderwall token
app.get('/api/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = decodeJwtPayload(token);

    if (!payload) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    // Extract user info from Entra ID token claims
    const userInfo = {
        navIdent: payload.NAVident || payload.preferred_username?.split('@')[0] || 'Ukjent',
        name: payload.name || payload.preferred_username || 'Ukjent bruker',
        email: payload.preferred_username || payload.email || null,
    };

    log('User', `Authenticated: ${userInfo.navIdent} (${userInfo.name})`);
    res.json(userInfo);
});

// Generate embed token for iframe access
app.post('/api/generate-embed-token', (req, res) => {
    if (!EMBED_API_KEY) {
        logError('Embed', 'EMBED_API_KEY not configured');
        return res.status(500).json({ error: 'Embed tokens not configured' });
    }

    const apiKey = req.headers['x-api-key'];
    if (apiKey !== EMBED_API_KEY) {
        logError('Embed', 'Invalid API key');
        return res.status(403).json({ error: 'Invalid API key' });
    }

    const { email, sakId } = req.body;
    if (!email || !sakId) {
        return res.status(400).json({ error: 'Missing email or sakId' });
    }

    const embedToken = crypto.randomUUID();
    const expiresAt = Date.now() + EMBED_TOKEN_TTL_MS;

    embedTokenStore.set(embedToken, { email, sakId, expiresAt });

    log('Embed', `Token generated for sak ${sakId}, user ${email}, expires in ${EMBED_TOKEN_TTL_MS / 1000}s`);
    res.json({ token: embedToken, expiresIn: EMBED_TOKEN_TTL_MS / 1000 });
});

app.get('/api/validate-embed-token', (req, res) => {
    const token = req.query.token;
    if (!token) {
        return res.status(401).json({ valid: false, error: 'Missing token' });
    }

    const stored = embedTokenStore.get(token);
    if (!stored) {
        log('Embed', `Validation failed: unknown token`);
        return res.status(401).json({ valid: false, error: 'Invalid token' });
    }

    if (stored.expiresAt < Date.now()) {
        embedTokenStore.delete(token);
        log('Embed', `Validation failed: expired token`);
        return res.status(401).json({ valid: false, error: 'Token expired' });
    }

    const requestedSakId = req.query.sakId;
    if (requestedSakId && requestedSakId !== stored.sakId) {
        log('Embed', `Validation failed: token for sak ${stored.sakId}, requested sak ${requestedSakId}`);
        return res.status(403).json({ valid: false, error: 'Token not valid for this sak' });
    }

    log('Embed', `Token validated for sak ${stored.sakId}, user ${stored.email}`);
    res.json({ valid: true, sakId: stored.sakId });
});

// Token cache for OBO tokens
const tokenCache = new Map();

async function exchangeToken(userToken) {
    if (!TOKEN_EXCHANGE_ENDPOINT) {
        log('OBO', 'No token exchange endpoint - using original token (local dev)');
        return userToken;
    }

    // Check cache
    const cacheKey = `${userToken.slice(-20)}_${BACKEND_TARGET_AUDIENCE}`;
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        log('OBO', 'Using cached token');
        return cached.token;
    }

    log('OBO', `Exchanging token for audience: ${BACKEND_TARGET_AUDIENCE}`);

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
            logError('OBO', `Token exchange failed: ${response.status} ${response.statusText}`);
            logError('OBO', `Error body: ${errorText}`);
            throw new Error(`Token exchange failed: ${response.status}`);
        }

        const data = await response.json();
        log('OBO', `Token exchange successful, expires in ${data.expires_in}s`);

        // Cache with buffer (subtract 60 seconds)
        tokenCache.set(cacheKey, {
            token: data.access_token,
            expiresAt: Date.now() + (data.expires_in - 60) * 1000,
        });

        return data.access_token;
    } catch (error) {
        logError('OBO', 'Token exchange error:', error);
        throw error;
    }
}

// Proxy for Jira description update via Forge
const JIRA_FORGE_URL = 'https://96f81f54-9920-41c0-a6a1-f45bdbc548ad.hello.atlassian-dev.net/x1/WPJvDj6Vxt4N_owp0xJ1bz0HSYc';
const JIRA_FORGE_COMMENT_URL = 'https://96f81f54-9920-41c0-a6a1-f45bdbc548ad.hello.atlassian-dev.net/x1/lsVk0jR_aCzx4T9pwD0TVRG3wVY';

app.post('/embed/api/jira/update-description', async (req, res) => {
    try {
        const embedToken = req.headers.authorization?.replace('Bearer ', '');
        if (!embedToken) {
            return res.status(401).json({ error: 'No embed token' });
        }

        const stored = embedTokenStore.get(embedToken);
        if (!stored || stored.expiresAt < Date.now()) {
            if (stored) embedTokenStore.delete(embedToken);
            return res.status(401).json({ error: 'Invalid or expired embed token' });
        }

        if (!EMBED_API_KEY) {
            logError('JiraProxy', 'EMBED_API_KEY not configured');
            return res.status(500).json({ error: 'API key not configured' });
        }

        const { issueKey, text } = req.body;
        if (!issueKey || text == null) {
            return res.status(400).json({ error: 'issueKey and text are required' });
        }

        log('JiraProxy', `Updating description for ${issueKey} (user: ${stored.email})`);

        const response = await fetch(JIRA_FORGE_URL, {
            method: 'POST',
            headers: {
                'X-API-Key': EMBED_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ issueKey, text, email: stored.email }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            logError('JiraProxy', `Forge responded ${response.status}: ${errorText}`);
            return res.status(response.status).json({ error: 'Forge request failed' });
        }

        const data = await response.json().catch(() => ({}));
        log('JiraProxy', `Description updated for ${issueKey}`);
        res.json(data);
    } catch (error) {
        logError('JiraProxy', 'Error:', error);
        res.status(500).json({ error: 'Failed to update Jira description' });
    }
});

app.post('/embed/api/jira/add-comment', async (req, res) => {
    try {
        const embedToken = req.headers.authorization?.replace('Bearer ', '');
        if (!embedToken) {
            return res.status(401).json({ error: 'No embed token' });
        }

        const stored = embedTokenStore.get(embedToken);
        if (!stored || stored.expiresAt < Date.now()) {
            if (stored) embedTokenStore.delete(embedToken);
            return res.status(401).json({ error: 'Invalid or expired embed token' });
        }

        if (!EMBED_API_KEY) {
            logError('JiraProxy', 'EMBED_API_KEY not configured');
            return res.status(500).json({ error: 'API key not configured' });
        }

        const { issueKey, text } = req.body;
        if (!issueKey || text == null) {
            return res.status(400).json({ error: 'issueKey and text are required' });
        }

        log('JiraProxy', `Adding comment to ${issueKey} (user: ${stored.email})`);

        const response = await fetch(JIRA_FORGE_COMMENT_URL, {
            method: 'POST',
            headers: {
                'X-API-Key': EMBED_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ issueKey, text, email: stored.email }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            logError('JiraProxy', `Forge responded ${response.status}: ${errorText}`);
            return res.status(response.status).json({ error: 'Forge request failed' });
        }

        const data = await response.json().catch(() => ({}));
        log('JiraProxy', `Comment added to ${issueKey}`);
        res.json(data);
    } catch (error) {
        logError('JiraProxy', 'Error:', error);
        res.status(500).json({ error: 'Failed to add Jira comment' });
    }
});

// Proxy for iframe embed API - validates embed token
app.use('/embed/api', async (req, res) => {
    const startTime = Date.now();
    try {
        const embedToken = req.headers.authorization?.replace('Bearer ', '');
        if (!embedToken) {
            logError('EmbedProxy', 'No embed token provided');
            return res.status(401).json({ error: 'No embed token' });
        }

        const stored = embedTokenStore.get(embedToken);
        if (!stored) {
            logError('EmbedProxy', 'Invalid embed token');
            return res.status(401).json({ error: 'Invalid or expired embed token' });
        }

        if (stored.expiresAt < Date.now()) {
            embedTokenStore.delete(embedToken);
            logError('EmbedProxy', 'Expired embed token');
            return res.status(401).json({ error: 'Embed token expired' });
        }

        const requestedSakId = req.url.match(/\/saker\/([^/]+)/)?.[1];
        if (requestedSakId && requestedSakId !== stored.sakId) {
            logError('EmbedProxy', `Token for sak ${stored.sakId} used against sak ${requestedSakId}`);
            return res.status(403).json({ error: 'Token not valid for this sak' });
        }

        const targetUrl = `${BACKEND_URL}/embed/v1${req.url}`;
        log('EmbedProxy', `${req.method} ${targetUrl} (user: ${stored.email})`);

        const headers = {
            'Content-Type': 'application/json',
            'X-User-Email': stored.email,
            'X-API-Key': EMBED_API_KEY,
        };

        if (req.headers['x-correlation-id']) {
            headers['X-Correlation-Id'] = req.headers['x-correlation-id'];
        }

        const options = { method: req.method, headers };
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            options.body = JSON.stringify(req.body);
        }

        log('EmbedProxy', `Forwarding to: ${targetUrl}`);
        const response = await fetch(targetUrl, options);
        const duration = Date.now() - startTime;
        log('EmbedProxy', `Response: ${response.status} ${response.statusText} (${duration}ms)`);

        res.status(response.status);
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            if (response.status >= 400) logError('EmbedProxy', `Error: ${JSON.stringify(data)}`);
            res.json(data);
        } else if (response.status === 204) {
            res.end();
        } else {
            const text = await response.text();
            if (response.status >= 400) logError('EmbedProxy', `Error: ${text}`);
            res.send(text);
        }
    } catch (error) {
        const duration = Date.now() - startTime;
        logError('EmbedProxy', `Error (${duration}ms):`, error);
        res.status(500).json({ error: 'Proxy request failed', message: error.message });
    }
});

// Proxy API requests til backend
app.use('/internal', async (req, res) => {
    const startTime = Date.now();
    try {
        const targetUrl = `${BACKEND_URL}/internal${req.url}`;
        log('Proxy', `${req.method} ${targetUrl}`);

        // Get user token from Wonderwall
        const authHeader = req.headers.authorization;
        log('Proxy', `Authorization header present: ${!!authHeader}`);

        if (!authHeader) {
            logError('Proxy', 'No Authorization header - user not authenticated');
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // Exchange token for backend
        const userToken = authHeader.replace('Bearer ', '');
        let backendToken;
        try {
            backendToken = await exchangeToken(userToken);
        } catch (error) {
            logError('Proxy', 'Token exchange failed:', error);
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
            log('Proxy', `Request body: ${JSON.stringify(req.body)}`);
        }

        log('Proxy', `Forwarding to: ${targetUrl}`);
        const response = await fetch(targetUrl, options);
        const duration = Date.now() - startTime;

        log('Proxy', `Response: ${response.status} ${response.statusText} (${duration}ms)`);

        // Forward status code
        res.status(response.status);

        // Forward response based on content type
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            if (response.status >= 400) {
                logError('Proxy', `Error response: ${JSON.stringify(data, null, 2)}`);
            }
            res.json(data);
        } else if (response.status === 204) {
            res.end();
        } else {
            const text = await response.text();
            if (response.status >= 400) {
                logError('Proxy', `Error response (text): ${text}`);
            }
            res.send(text);
        }
    } catch (error) {
        const duration = Date.now() - startTime;
        logError('Proxy', `Error (${duration}ms):`, error);
        res.status(500).json({
            error: 'Proxy request failed',
            message: error.message,
        });
    }
});

// Serve statiske filer fra dist/
app.use(express.static(path.join(__dirname, "dist")));

// Håndter SPA-routing ved å alltid returnere index.html
app.get("/{*path}", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
    log('Startup', `Server running on http://localhost:${PORT}`);
});
