import { useEffect } from "react";
import { getMsalInstance } from "../auth/msalConfig";

export const AuthCallback = () => {
  useEffect(() => {
    getMsalInstance().then((msal) => msal.handleRedirectPromise());
    window.close();
  }, []);

  return null;
};
