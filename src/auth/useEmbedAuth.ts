import { useState, useEffect, useCallback } from "react";
import { createLogger } from "../logger";
import { openLoginPopup } from "../api/sakApi";

const log = createLogger("EmbedAuth");

type AuthState =
  | { status: "loading" }
  | { status: "polling" }
  | { status: "authenticated" }
  | { status: "unauthenticated" }
  | { status: "error"; error: string };

export function useEmbedAuth() {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/embed/api/auth-config", { credentials: "include" })
      .then((res) => {
        if (cancelled) return;
        setState({ status: res.ok ? "authenticated" : "unauthenticated" });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "unauthenticated" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openLogin = useCallback((event?: { preventDefault?: () => void }) => {
    event?.preventDefault?.();
    log.info("Opening login popup");
    openLoginPopup();
  }, []);

  const getAccessToken = useCallback(async (): Promise<string> => "", []);

  return { ...state, loginUrl: "/oauth2/login", openLogin, getAccessToken };
}
