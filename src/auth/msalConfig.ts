import { PublicClientApplication, type Configuration, LogLevel } from "@azure/msal-browser";

interface AuthConfig {
  clientId: string;
  authority: string;
  backendScope: string;
}

let authConfig: AuthConfig | null = null;

async function fetchAuthConfig(): Promise<AuthConfig> {
  if (authConfig) return authConfig;

  const envClientId = import.meta.env.VITE_AZURE_CLIENT_ID;
  if (envClientId) {
    authConfig = {
      clientId: envClientId,
      authority: import.meta.env.VITE_AZURE_AUTHORITY || "https://login.microsoftonline.com/nav.no",
      backendScope: import.meta.env.VITE_MSAL_BACKEND_SCOPE || "",
    };
    return authConfig;
  }

  const res = await fetch("/embed/api/auth-config");
  if (!res.ok) throw new Error("Kunne ikke hente auth-konfigurasjon");
  authConfig = await res.json();
  return authConfig!;
}

function createMsalConfig(config: AuthConfig): Configuration {
  return {
    auth: {
      clientId: config.clientId,
      authority: config.authority,
      redirectUri: `${window.location.origin}/embed/auth-callback`,
      postLogoutRedirectUri: window.location.origin,
    },
    cache: {
      cacheLocation: "sessionStorage",
    },
    system: {
      loggerOptions: {
        logLevel: LogLevel.Warning,
        piiLoggingEnabled: false,
      },
    },
  };
}

let msalInstance: PublicClientApplication | null = null;

export async function getMsalInstance(): Promise<PublicClientApplication> {
  if (msalInstance) return msalInstance;

  const config = await fetchAuthConfig();
  msalInstance = new PublicClientApplication(createMsalConfig(config));
  await msalInstance.initialize();
  return msalInstance;
}

export async function getLoginScopes(): Promise<string[]> {
  const config = await fetchAuthConfig();
  return config.backendScope ? [config.backendScope] : ["openid", "profile"];
}

export async function getBackendScopes(): Promise<string[]> {
  const config = await fetchAuthConfig();
  return config.backendScope ? [config.backendScope] : [];
}
