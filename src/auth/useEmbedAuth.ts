import { useState, useEffect, useCallback, useRef } from "react";
import type { AccountInfo, AuthenticationResult, IPublicClientApplication } from "@azure/msal-browser";
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
  const msalRef = useRef<IPublicClientApplication | null>(null);
  const scopesRef = useRef<string[]>([]);

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
          log.info("Running inside iframe, skipping ssoSilent (blocked in nested iframes)");
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

  const login = useCallback(async () => {
    const msal = msalRef.current;
    const scopes = scopesRef.current;

    if (!msal) {
      log.error("MSAL not initialized yet");
      setState({ status: "error", error: "Autentisering er ikke klar ennå" });
      return;
    }

    // Open popup synchronously to preserve user gesture context.
    // MSAL does async work before calling window.open(), which breaks the
    // gesture chain and causes browsers to block the popup in iframe contexts.
    const popupWindow = window.open("about:blank", "msal-login", "width=483,height=600,left=200,top=100");
    if (!popupWindow) {
      setState({ status: "error", error: "Popup ble blokkert av nettleseren. Tillat popups for denne siden." });
      return;
    }

    const originalOpen = window.open.bind(window);
    window.open = () => {
      window.open = originalOpen;
      return popupWindow;
    };

    try {
      setState({ status: "loading" });
      const result: AuthenticationResult = await msal.loginPopup({
        scopes,
        prompt: "select_account",
      });

      msal.setActiveAccount(result.account);
      log.info(`Login successful: ${result.account?.username}`);
      setState({ status: "authenticated", account: result.account! });
    } catch (err) {
      popupWindow.close();
      log.error("Login failed", err);
      setState({
        status: "error",
        error: err instanceof Error ? err.message : "Innlogging feilet",
      });
    } finally {
      window.open = originalOpen;
    }
  }, []);

  const getAccessToken = useCallback(async (): Promise<string> => {
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
        log.info("Silent token acquisition failed, trying popup");
        const result = await msal.acquireTokenPopup({ scopes });
        return result.accessToken;
      }
      throw err;
    }
  }, []);

  return { ...state, login, getAccessToken };
}
