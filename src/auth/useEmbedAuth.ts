import { useState, useEffect, useCallback, useRef } from "react";
import { createLogger } from "../logger";

const log = createLogger("EmbedAuth");

type AuthState =
  | { status: "loading" }
  | { status: "polling" }
  | { status: "authenticated" }
  | { status: "unauthenticated" }
  | { status: "error"; error: string };

export function useEmbedAuth() {
  const [state, setState] = useState<AuthState>({ status: "unauthenticated" });
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sidRef = useRef<string>(crypto.randomUUID());
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    setLoginUrl(`/embed/auth/start?sid=${sidRef.current}`);
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
          log.info("Login completed via server-side auth");
          setState({ status: "authenticated" });
        }
      } catch {
        // Network error, keep polling
      }
    }, 2000);
  }, []);

  const getAccessToken = useCallback(async (): Promise<string> => {
    if (tokenRef.current) return tokenRef.current;
    throw new Error("Ikke autentisert");
  }, []);

  return { ...state, loginUrl, onLoginClick, getAccessToken };
}
