import { useState, useEffect, useCallback, useRef } from "react";
import { createLogger } from "../logger";

const log = createLogger("EmbedAuth");

const TOKEN_STORAGE_KEY = "embed-access-token";
const EXPIRY_SKEW_MS = 60 * 1000;
const SILENT_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 2000;
const SILENT_POLL_INTERVAL_MS = 750;

function decodeTokenExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function loadStoredToken(): string | null {
  try {
    const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) return null;
    const exp = decodeTokenExp(token);
    if (!exp || exp - EXPIRY_SKEW_MS < Date.now()) {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

function storeToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Storage unavailable, token kept in memory only
  }
}

type AuthState =
  | { status: "loading" }
  | { status: "polling" }
  | { status: "authenticated" }
  | { status: "unauthenticated" }
  | { status: "error"; error: string };

export function useEmbedAuth() {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sidRef = useRef<string>(crypto.randomUUID());
  const tokenRef = useRef<string | null>(null);
  const silentFrameRef = useRef<HTMLIFrameElement | null>(null);
  const silentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const cleanupSilentAttempt = useCallback(() => {
    if (silentTimeoutRef.current) {
      clearTimeout(silentTimeoutRef.current);
      silentTimeoutRef.current = null;
    }
    if (silentFrameRef.current) {
      silentFrameRef.current.remove();
      silentFrameRef.current = null;
    }
  }, []);

  const applyToken = useCallback((accessToken: string) => {
    tokenRef.current = accessToken;
    storeToken(accessToken);
    setState({ status: "authenticated" });
  }, []);

  const startPolling = useCallback(
    ({ silent = false }: { silent?: boolean } = {}) => {
      stopPolling();

      // Under et stille forsøk skal brukeren ikke se noe. Vi blir stående i
      // "loading" til utfallet er kjent, i stedet for å vise ventetekst.
      setState({ status: silent ? "loading" : "polling" });

      pollingRef.current = setInterval(
        async () => {
          try {
            const res = await fetch(`/embed/api/auth/poll?sid=${sidRef.current}`);
            if (!res.ok) return;
            const data = await res.json();

            if (data.status === "authenticated" && data.accessToken) {
              stopPolling();
              cleanupSilentAttempt();
              log.info(`Login completed via ${silent ? "silent SSO" : "server-side auth"}`);
              applyToken(data.accessToken);
              return;
            }

            if (data.status === "failed") {
              stopPolling();
              cleanupSilentAttempt();
              if (silent) {
                log.info(`Silent SSO unavailable (${data.error}), falling back to interactive login`);
                setState({ status: "unauthenticated" });
              } else {
                log.warn(`Login failed (${data.error})`);
                setState({ status: "error", error: "Innlogging feilet. Prøv igjen." });
              }
            }
          } catch {
            // Network error, keep polling
          }
        },
        silent ? SILENT_POLL_INTERVAL_MS : POLL_INTERVAL_MS,
      );
    },
    [stopPolling, cleanupSilentAttempt, applyToken],
  );

  // Stille SSO-forsøk: laster autorisasjonsflyten med prompt=none i en skjult
  // iframe. Har brukeren en aktiv Entra-sesjon fullføres innloggingen uten
  // klikk. Hvis ikke – eller hvis nettleseren blokkerer tredjeparts-cookies
  // mot Entra – svarer serveren "failed", og vi viser innloggingsknappen.
  const trySilentLogin = useCallback(() => {
    // Rydd bort et eventuelt tidligere forsøk først. React StrictMode kjører
    // mount-effekten to ganger i utvikling, og uten dette ville den første
    // skjulte iframen bli liggende igjen i DOM uten å bli ryddet.
    cleanupSilentAttempt();

    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.display = "none";
    frame.src = `/embed/auth/start?sid=${sidRef.current}&silent=1`;
    document.body.appendChild(frame);
    silentFrameRef.current = frame;

    silentTimeoutRef.current = setTimeout(() => {
      stopPolling();
      cleanupSilentAttempt();
      log.info("Silent SSO timed out, falling back to interactive login");
      setState({ status: "unauthenticated" });
    }, SILENT_TIMEOUT_MS);

    startPolling({ silent: true });
  }, [startPolling, stopPolling, cleanupSilentAttempt]);

  useEffect(() => {
    setLoginUrl(`/embed/auth/start?sid=${sidRef.current}`);

    const stored = loadStoredToken();
    if (stored) {
      tokenRef.current = stored;
      log.info("Reusing stored access token");
      setState({ status: "authenticated" });
      return;
    }

    trySilentLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
      cleanupSilentAttempt();
    };
  }, [stopPolling, cleanupSilentAttempt]);

  const openLogin = useCallback((event?: { preventDefault?: () => void }) => {
    event?.preventDefault?.();

    // Avbryt et eventuelt pågående stille forsøk, slik at timeouten ikke
    // senere overstyrer tilstanden midt i den interaktive innloggingen.
    cleanupSilentAttempt();

    const url = `/embed/auth/start?sid=${sidRef.current}`;
    const absoluteUrl = new URL(url, window.location.origin).href;

    // Åpne login i et popup-vindu. Når iframe-sandboxen tillater popups
    // (allow-popups allow-popups-to-escape-sandbox) åpnes vinduet direkte.
    const w = 500, h = 700;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open(
      absoluteUrl,
      "skjermd-login",
      `popup=yes,width=${w},height=${h},left=${left},top=${top}`,
    );
    if (!popup) {
      // Popup blokkert — be Forge-verten åpne via router.open.
      log.info("Popup blocked, requesting parent to open login");
      window.parent.postMessage(
        { type: "skjermd:open-login", url: absoluteUrl },
        "*",
      );
    }

    startPolling();
  }, [startPolling, cleanupSilentAttempt]);

  const getAccessToken = useCallback(async (): Promise<string> => {
    if (tokenRef.current) {
      const exp = decodeTokenExp(tokenRef.current);
      if (exp && exp - EXPIRY_SKEW_MS < Date.now()) {
        tokenRef.current = null;
        try {
          sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        } catch {
          // ignore
        }
        setState({ status: "unauthenticated" });
        throw new Error("Tokenet er utløpt. Logg inn på nytt.");
      }
      return tokenRef.current;
    }
    throw new Error("Ikke autentisert");
  }, []);

  return { ...state, loginUrl, openLogin, getAccessToken };
}
