import { createLogger } from "../logger";

const log = createLogger("IframeAuth");

let iframeToken: string | null = null;
let tokenResolve: ((token: string) => void) | null = null;
let tokenPromise: Promise<string> | null = null;

const ALLOWED_ORIGINS = [
  "https://nav-sandbox.atlassian.net",
  "https://navikt.atlassian.net",
];

export function isIframeMode(): boolean {
  return window.location.pathname.startsWith("/embed/");
}

export function getIframeToken(): string | null {
  return iframeToken;
}

export function waitForToken(): Promise<string> {
  if (iframeToken) return Promise.resolve(iframeToken);
  if (tokenPromise) return tokenPromise;

  tokenPromise = new Promise((resolve) => {
    tokenResolve = resolve;
  });
  return tokenPromise;
}

function handleMessage(event: MessageEvent) {
  if (!ALLOWED_ORIGINS.includes(event.origin)) {
    log.warn(`Avvist postMessage fra ukjent origin: ${event.origin}`);
    return;
  }

  if (event.data?.type === "auth-token" && typeof event.data.token === "string") {
    log.info(`Token mottatt fra ${event.origin}`);
    iframeToken = event.data.token;
    if (tokenResolve) {
      tokenResolve(iframeToken!);
      tokenResolve = null;
    }
  }
}

export function initIframeAuth() {
  if (!isIframeMode()) return;
  log.info("Initialiserer iframe-autentisering, venter på token via postMessage...");
  window.addEventListener("message", handleMessage);
}

export function cleanupIframeAuth() {
  window.removeEventListener("message", handleMessage);
  iframeToken = null;
  tokenResolve = null;
  tokenPromise = null;
}
