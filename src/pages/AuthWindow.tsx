import { useEffect, useState } from "react";
import { getMsalInstance, getLoginScopes } from "../auth/msalConfig";

type Status = "redirecting" | "completing" | "done" | "error";

export function AuthWindow() {
  const [status, setStatus] = useState<Status>("redirecting");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const msal = await getMsalInstance();
        const result = await msal.handleRedirectPromise();

        if (result?.accessToken) {
          setStatus("completing");

          const sid = sessionStorage.getItem("embed-auth-sid");
          if (sid) {
            await fetch("/embed/api/auth/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sid, accessToken: result.accessToken }),
            });
            sessionStorage.removeItem("embed-auth-sid");
          }

          setStatus("done");
          setTimeout(() => window.close(), 1500);
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const sid = params.get("sid");
        if (sid) {
          sessionStorage.setItem("embed-auth-sid", sid);
        }

        const scopes = await getLoginScopes();
        await msal.loginRedirect({
          scopes,
          redirectUri: `${window.location.origin}/embed/auth-window`,
        });
      } catch (err) {
        console.error("Auth window error:", err);
        setError(err instanceof Error ? err.message : "Innlogging feilet");
        setStatus("error");
      }
    })();
  }, []);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontFamily: "sans-serif" }}>
      {status === "redirecting" && <p>Omdirigerer til innlogging...</p>}
      {status === "completing" && <p>Fullfører innlogging...</p>}
      {status === "done" && <p>Du er logget inn! Denne fanen lukkes automatisk.</p>}
      {status === "error" && (
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "red" }}>Innlogging feilet: {error}</p>
          <button onClick={() => window.close()}>Lukk</button>
        </div>
      )}
    </div>
  );
}
