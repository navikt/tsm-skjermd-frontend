import { useState, useEffect, useCallback, useRef } from "react";
import type { AccountInfo, AuthenticationResult } from "@azure/msal-browser";
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
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      try {
        const msal = await getMsalInstance();

        await withTimeout(msal.handleRedirectPromise(), 3000, "handleRedirectPromise");

        const accounts = msal.getAllAccounts();
        if (accounts.length > 0) {
          msal.setActiveAccount(accounts[0]);
          log.info(`Already authenticated: ${accounts[0].username}`);
          setState({ status: "authenticated", account: accounts[0] });
          return;
        }

        if (isInIframe) {
          log.info("Running inside iframe, skipping ssoSilent (blocked in nested iframes)");
          setState({ status: "unauthenticated" });
          return;
        }

        try {
          const scopes = await getLoginScopes();
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

  const login = useCallback(async () => {
    try {
      setState({ status: "loading" });
      const msal = await getMsalInstance();
      const scopes = await getLoginScopes();
      const result: AuthenticationResult = await msal.loginPopup({
        scopes,
        prompt: "select_account",
      });

      msal.setActiveAccount(result.account);
      log.info(`Login successful: ${result.account?.username}`);
      setState({ status: "authenticated", account: result.account! });
    } catch (err) {
      log.error("Login failed", err);
      setState({
        status: "error",
        error: err instanceof Error ? err.message : "Innlogging feilet",
      });
    }
  }, []);

  const getAccessToken = useCallback(async (): Promise<string> => {
    const msal = await getMsalInstance();
    const account = msal.getActiveAccount();

    if (!account) {
      throw new Error("Ikke autentisert");
    }

    const backendSc = await getBackendScopes();
    const scopes = backendSc.length > 0 ? backendSc : await getLoginScopes();

    try {
      const result = await msal.acquireTokenSilent({ scopes, account });
      return result.accessToken;
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        log.info("Silent token acquisition failed, trying popup");
        const result = await msal.acquireTokenPopup({ scopes });
        return result.accessToken;
      }
      throw err;
    }
  }, []);

  return { ...state, login, getAccessToken };
}
