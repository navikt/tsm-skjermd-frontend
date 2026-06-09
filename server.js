import crypto from "crypto";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
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
const BACKEND_TARGET_AUDIENCE = process.env.BACKEND_TARGET_AUDIENCE || "api://dev-gcp.team-service-management.tsm-skjermd/.default";
const EMBED_API_KEY = process.env.EMBED_API_KEY;
const JIRA_FORGE_URL = process.env.JIRA_FORGE_URL;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

log('Startup', `Backend URL: ${BACKEND_URL}`);
log('Startup', `Token Exchange Endpoint: ${TOKEN_EXCHANGE_ENDPOINT || 'NOT SET (local dev mode)'}`);
log('Startup', `Backend Target Audience: ${BACKEND_TARGET_AUDIENCE}`);
log('Startup', `Embed API Key: ${EMBED_API_KEY ? 'SET' : 'NOT SET'}`);
log('Startup', `Jira Forge URL: ${JIRA_FORGE_URL ? 'SET' : 'NOT SET'}`);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            frameAncestors: ["'self'", "https://*.atlassian.net", "https://*.atlassian-dev.net"],
        },
    },
    frameguard: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
}));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'For mange forespørsler, prøv igjen senere' },
});

app.use('/embed/auth', authLimiter);

// Embed token store: Map<embedToken, { email, sakId, expiresAt }>
// Used by the Forge app, which mints a token via /api/generate-embed-token
// (server-to-server, X-API-Key) before loading the iframe with ?token=...
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
app.use((req, res, next) => {
    if (req.headers['content-type']?.includes('multipart/form-data')) {
        return next();
    }
    express.json()(req, res, next);
});

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

// Generate embed token for iframe access (called server-to-server by the Forge app)
app.post('/api/generate-embed-token', (req, res) => {
    if (!EMBED_API_KEY) {
        logError('Embed', 'EMBED_API_KEY not configured');
        return res.status(500).json({ error: 'Embed tokens not configured' });
    }

    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey.length !== EMBED_API_KEY.length ||
        !crypto.timingSafeEqual(Buffer.from(apiKey), Buffer.from(EMBED_API_KEY))) {
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

    log('Embed', `Token generated for sak ${sakId}, expires in ${EMBED_TOKEN_TTL_MS / 1000}s`);
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

    log('Embed', `Token validated for sak ${stored.sakId}`);
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

// Runtime config for MSAL (kept for backwards compatibility)
app.get('/embed/api/auth-config', (req, res) => {
    res.json({
        clientId: process.env.AZURE_APP_CLIENT_ID || '',
        authority: `https://login.microsoftonline.com/${process.env.AZURE_APP_TENANT_ID || 'nav.no'}`,
        backendScope: BACKEND_TARGET_AUDIENCE,
    });
});

// --- Server-side OAuth flow for iframe embed auth ---
const authSessions = new Map();   // sid -> { accessToken, createdAt }
const authFlowStore = new Map();  // state -> { sid, codeVerifier, createdAt }

function generatePKCE() {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
}

setInterval(() => {
    const now = Date.now();
    for (const [key, val] of authSessions) {
        if (now - val.createdAt > 60 * 60 * 1000) authSessions.delete(key);
    }
    for (const [key, val] of authFlowStore) {
        if (now - val.createdAt > 5 * 60 * 1000) authFlowStore.delete(key);
    }
}, 60 * 1000);

app.get('/embed/auth/start', (req, res) => {
    const sid = req.query.sid;
    if (!sid) return res.status(400).send('Missing sid');

    const state = crypto.randomUUID();
    const { verifier, challenge } = generatePKCE();
    authFlowStore.set(state, { sid, codeVerifier: verifier, createdAt: Date.now() });

    const clientId = process.env.AZURE_APP_CLIENT_ID;
    const tenantId = process.env.AZURE_APP_TENANT_ID;
    const redirectUri = `https://${req.get('host')}/embed/auth/callback`;
    const scope = `openid profile api://${clientId}/.default`;

    const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope,
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        response_mode: 'query',
    });

    const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`;
    log('Auth', `Starting server-side auth flow for sid ${sid.slice(0, 8)}...`);
    res.redirect(authUrl);
});

app.get('/embed/auth/callback', async (req, res) => {
    const { code, state, error, error_description } = req.query;

    if (error) {
        logError('Auth', `Auth error: ${error} - ${error_description}`);
        return res.send(authResultPage('Innlogging feilet', error_description || error, true));
    }

    const flowData = authFlowStore.get(state);
    if (!flowData) {
        return res.status(400).send(authResultPage('Ugyldig forespørsel', 'State er utløpt eller ugyldig. Prøv å logge inn på nytt.', true));
    }
    authFlowStore.delete(state);

    const tokenEndpoint = process.env.AZURE_OPENID_CONFIG_TOKEN_ENDPOINT
        || `https://login.microsoftonline.com/${process.env.AZURE_APP_TENANT_ID}/oauth2/v2.0/token`;
    const redirectUri = `https://${req.get('host')}/embed/auth/callback`;

    try {
        const tokenRes = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.AZURE_APP_CLIENT_ID,
                client_secret: process.env.AZURE_APP_CLIENT_SECRET,
                code,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
                code_verifier: flowData.codeVerifier,
            }),
        });

        if (!tokenRes.ok) {
            const errText = await tokenRes.text();
            logError('Auth', `Token exchange failed: ${errText}`);
            return res.send(authResultPage('Innlogging feilet', 'Kunne ikke fullføre innlogging. Prøv igjen.', true));
        }

        const tokenData = await tokenRes.json();
        authSessions.set(flowData.sid, { accessToken: tokenData.access_token, createdAt: Date.now() });
        log('Auth', `Login completed for session ${flowData.sid.slice(0, 8)}...`);
        res.send(authResultPage('Du er logget inn!', 'Du kan lukke denne fanen og gå tilbake til Jira.', false));
    } catch (err) {
        logError('Auth', 'Token exchange error:', err);
        res.send(authResultPage('Innlogging feilet', 'En uventet feil oppstod.', true));
    }
});

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function authResultPage(title, message, isError) {
    const t = escapeHtml(title);
    const m = escapeHtml(message);
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${t}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f5f5f5">
<div style="text-align:center;padding:2rem;background:white;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.1)">
<h2 style="color:${isError ? '#c30000' : '#006a4e'}">${t}</h2>
<p>${m}</p>
</div></body></html>`;
}

app.get('/embed/api/auth/poll', (req, res) => {
    const sid = req.query.sid;
    if (!sid) return res.status(400).json({ error: 'Missing sid' });
    res.set('Cache-Control', 'no-store');
    const session = authSessions.get(sid);
    if (!session) return res.json({ status: 'pending' });
    const { accessToken } = session;
    authSessions.delete(sid);
    log('Auth', `Token delivered for session ${sid.slice(0, 8)}...`);
    res.json({ status: 'authenticated', accessToken });
});
// --- End server-side OAuth ---

// Check if a Bearer token is a JWT (Azure AD token) vs embed token (UUID)
function isJwtToken(token) {
    return token && token.includes('.');
}

// Proxy for Jira description update via Forge
app.post('/embed/api/jira/update-description', async (req, res) => {
    try {
        const bearerToken = req.headers.authorization?.replace('Bearer ', '');
        if (!bearerToken) {
            return res.status(401).json({ error: 'No token' });
        }

        let userEmail;
        if (isJwtToken(bearerToken)) {
            const payload = decodeJwtPayload(bearerToken);
            if (!payload) {
                return res.status(401).json({ error: 'Invalid token' });
            }
            userEmail = payload.preferred_username || payload.email;
        } else {
            const stored = embedTokenStore.get(bearerToken);
            if (!stored || stored.expiresAt < Date.now()) {
                if (stored) embedTokenStore.delete(bearerToken);
                return res.status(401).json({ error: 'Invalid or expired embed token' });
            }
            userEmail = stored.email;
        }

        if (!EMBED_API_KEY) {
            logError('JiraProxy', 'EMBED_API_KEY not configured');
            return res.status(500).json({ error: 'API key not configured' });
        }

        if (!JIRA_FORGE_URL) {
            logError('JiraProxy', 'JIRA_FORGE_URL not configured');
            return res.status(500).json({ error: 'Jira integration not configured' });
        }

        const { issueKey, text } = req.body;
        if (!issueKey) {
            return res.status(400).json({ error: 'issueKey is required' });
        }

        log('JiraProxy', `Updating description for ${issueKey}`);

        const response = await fetch(JIRA_FORGE_URL, {
            method: 'POST',
            headers: {
                'X-API-Key': EMBED_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ issueKey, text, email: userEmail }),
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

// Proxy for iframe embed API — supports both Azure AD tokens (PKCE flow) and
// legacy embed tokens (UUID) minted by the Forge app via /api/generate-embed-token
app.use('/embed/api', async (req, res) => {
    const startTime = Date.now();
    try {
        const bearerToken = req.headers.authorization?.replace('Bearer ', '');
        if (!bearerToken) {
            logError('EmbedProxy', 'No token provided');
            return res.status(401).json({ error: 'No token' });
        }

        let targetUrl;
        const headers = {};

        if (isJwtToken(bearerToken)) {
            // Azure AD token — exchange for backend OBO token and proxy to /internal/v1
            log('EmbedProxy', 'Using Azure AD token flow');
            let backendToken;
            try {
                backendToken = await exchangeToken(bearerToken);
            } catch (err) {
                logError('EmbedProxy', 'Token exchange failed:', err);
                return res.status(401).json({ error: 'Token exchange failed' });
            }
            targetUrl = `${BACKEND_URL}/internal/v1${req.url}`;
            headers['Authorization'] = `Bearer ${backendToken}`;
        } else {
            // Legacy embed token (UUID) — proxy to /embed/v1 with X-User-Email + X-API-Key
            const stored = embedTokenStore.get(bearerToken);
            if (!stored) {
                logError('EmbedProxy', 'Invalid embed token');
                return res.status(401).json({ error: 'Invalid or expired embed token' });
            }

            if (stored.expiresAt < Date.now()) {
                embedTokenStore.delete(bearerToken);
                logError('EmbedProxy', 'Expired embed token');
                return res.status(401).json({ error: 'Embed token expired' });
            }

            const requestedSakId = req.url.match(/\/saker\/([^/]+)/)?.[1];
            if (requestedSakId && requestedSakId !== stored.sakId) {
                logError('EmbedProxy', `Token for sak ${stored.sakId} used against sak ${requestedSakId}`);
                return res.status(403).json({ error: 'Token not valid for this sak' });
            }

            targetUrl = `${BACKEND_URL}/embed/v1${req.url}`;
            headers['X-User-Email'] = stored.email;
            headers['X-API-Key'] = EMBED_API_KEY;
            log('EmbedProxy', 'Using legacy embed token');
        }

        log('EmbedProxy', `${req.method} ${targetUrl}`);

        if (req.headers['x-correlation-id']) {
            headers['X-Correlation-Id'] = req.headers['x-correlation-id'];
        }

        const isMultipart = req.headers['content-type']?.includes('multipart/form-data');
        if (!isMultipart) {
            headers['Content-Type'] = 'application/json';
        }

        const options = { method: req.method, headers };
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            if (isMultipart) {
                const { Readable } = await import('stream');
                options.body = Readable.toWeb(req);
                headers['Content-Type'] = req.headers['content-type'];
                options.duplex = 'half';
            } else {
                options.body = JSON.stringify(req.body);
            }
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
        } else if (contentType && (contentType.includes('image/') || contentType.includes('application/pdf') || contentType.includes('application/octet-stream'))) {
            if (contentType) res.setHeader('Content-Type', contentType);
            const disposition = response.headers.get('content-disposition');
            if (disposition) res.setHeader('Content-Disposition', disposition);
            const arrayBuf = await response.arrayBuffer();
            res.send(Buffer.from(arrayBuf));
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
            'Authorization': `Bearer ${backendToken}`,
        };

        // Forward correlation ID if present
        if (req.headers['x-correlation-id']) {
            headers['X-Correlation-Id'] = req.headers['x-correlation-id'];
        }

        const isMultipart = req.headers['content-type']?.includes('multipart/form-data');
        if (!isMultipart) {
            headers['Content-Type'] = 'application/json';
        }

        const options = {
            method: req.method,
            headers: headers,
        };

        // Include body for POST/PUT/PATCH requests
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            if (isMultipart) {
                const { Readable } = await import('stream');
                options.body = Readable.toWeb(req);
                headers['Content-Type'] = req.headers['content-type'];
                options.duplex = 'half';
            } else {
                options.body = JSON.stringify(req.body);
                log('Proxy', `Request body: ${JSON.stringify(req.body)}`);
            }
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
        } else if (contentType && (contentType.includes('image/') || contentType.includes('application/pdf') || contentType.includes('application/octet-stream'))) {
            if (contentType) res.setHeader('Content-Type', contentType);
            const disposition = response.headers.get('content-disposition');
            if (disposition) res.setHeader('Content-Disposition', disposition);
            const arrayBuf = await response.arrayBuffer();
            res.send(Buffer.from(arrayBuf));
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
