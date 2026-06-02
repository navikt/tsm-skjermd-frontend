import { useState, useEffect, useCallback, useRef } from "react";
import type { AccountInfo, IPublicClientApplication } from "@azure/msal-browser";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { getMsalInstance, getLoginScopes, getBackendScopes } from "./msalConfig";
import { createLogger } from "../logger";

const log = createLogger("EmbedAuth");

const isInIframe = window.self !== window.top;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => {
        log.info(`${label} timed out after ${ms}ms`);
        resolve(null);
      }, ms);
    }),
  ]);
}

type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; account: AccountInfo }
  | { status: "unauthenticated" }
  | { status: "error"; error: string };

export function useEmbedAuth() {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const initRef = useRef(false);
  const msalRef = useRef<IPublicClientApplication | null>(null);
  const scopesRef = useRef<string[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sidRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      try {
        const msal = await getMsalInstance();
        msalRef.current = msal;

        const scopes = await getLoginScopes();
        scopesRef.current = scopes;

        await withTimeout(msal.handleRedirectPromise(), 3000, "handleRedirectPromise");

        const accounts = msal.getAllAccounts();
        if (accounts.length > 0) {
          msal.setActiveAccount(accounts[0]);
          log.info(`Already authenticated: ${accounts[0].username}`);
          setState({ status: "authenticated", account: accounts[0] });
          return;
        }

        if (isInIframe) {
          log.info("Running inside iframe, skipping ssoSilent");
          setState({ status: "unauthenticated" });
          return;
        }

        try {
          const ssoResult = await withTimeout(msal.ssoSilent({ scopes }), 5000, "ssoSilent");
          if (ssoResult?.account) {
            msal.setActiveAccount(ssoResult.account);
            log.info(`SSO silent succeeded: ${ssoResult.account.username}`);
            setState({ status: "authenticated", account: ssoResult.account });
            return;
          }
        } catch {
          // Expected — no existing session
        }

        log.info("No existing session, user needs to log in");
        setState({ status: "unauthenticated" });
      } catch (err) {
        log.error("MSAL initialization failed", err);
        setState({ status: "error", error: "Kunne ikke initialisere autentisering" });
      }
    })();
  }, []);

  useEffect(() => {
    if (state.status === "unauthenticated" && !loginUrl) {
      const sid = crypto.randomUUID();
      sidRef.current = sid;
      setLoginUrl(`/embed/auth-window?sid=${sid}`);
    }
  }, [state.status, loginUrl]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const onLoginClick = useCallback(() => {
    if (!sidRef.current) return;
    setState({ status: "loading" });

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/embed/api/auth/poll?sid=${sidRef.current}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "authenticated" && data.accessToken) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          tokenRef.current = data.accessToken;
          log.info("Login completed via new tab");

          const msal = msalRef.current;
          const account = msal?.getAllAccounts()[0];
          if (account) {
            setState({ status: "authenticated", account });
          } else {
            setState({ status: "authenticated", account: { username: "Authenticated" } as AccountInfo });
          }
        }
      } catch {
        // Network error, keep polling
      }
    }, 2000);
  }, []);

  const getAccessToken = useCallback(async (): Promise<string> => {
    if (tokenRef.current) {
      return tokenRef.current;
    }

    const msal = msalRef.current ?? await getMsalInstance();
    const account = msal.getActiveAccount();

    if (!account) {
      throw new Error("Ikke autentisert");
    }

    const backendSc = await getBackendScopes();
    const scopes = backendSc.length > 0 ? backendSc : scopesRef.current.length > 0 ? scopesRef.current : await getLoginScopes();

    try {
      const result = await msal.acquireTokenSilent({ scopes, account });
      return result.accessToken;
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        throw new Error("Tokenet er utløpt. Logg inn på nytt.");
      }
      throw err;
    }
  }, []);

  return { ...state, loginUrl, onLoginClick, getAccessToken };
}
