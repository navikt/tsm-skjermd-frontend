import { useState, useEffect, useCallback, useRef } from "react";
import { createLogger } from "../logger";

const log = createLogger("EmbedAuth");

const TOKEN_STORAGE_KEY = "embed-access-token";
const EXPIRY_SKEW_MS = 60 * 1000;

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

  useEffect(() => {
    setLoginUrl(`/embed/auth/start?sid=${sidRef.current}`);

    const stored = loadStoredToken();
    if (stored) {
      tokenRef.current = stored;
      log.info("Reusing stored access token");
      setState({ status: "authenticated" });
    } else {
      setState({ status: "unauthenticated" });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const onLoginClick = useCallback(() => {
    setState({ status: "polling" });

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/embed/api/auth/poll?sid=${sidRef.current}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "authenticated" && data.accessToken) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          tokenRef.current = data.accessToken;
          storeToken(data.accessToken);
          log.info("Login completed via server-side auth");
          setState({ status: "authenticated" });
        }
      } catch {
        // Network error, keep polling
      }
    }, 2000);
  }, []);

  const getAccessToken = useCallback(async (): Promise<string> => {
    if (tokenRef.current) {
      const exp = decodeTokenExp(tokenRef.current);
      if (exp && exp - EXPIRY_SKEW_MS < Date.now()) {
        tokenRef.current = null;
        try {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
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

  return { ...state, loginUrl, onLoginClick, getAccessToken };
}
