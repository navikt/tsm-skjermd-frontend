import { useParams, useSearchParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Alert } from "@navikt/ds-react";
import { SensureringEditor } from "../components/SensureringEditor";

export const SensureringIframe = () => {
  const { sakId } = useParams<{ sakId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [tilgang, setTilgang] = useState<"loading" | "ok" | "denied">("loading");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token || !sakId) {
      setTilgang("denied");
      return;
    }

    fetch(`/api/validate-embed-token?token=${encodeURIComponent(token)}`)
      .then((res) => {
        setTilgang(res.ok ? "ok" : "denied");
      }).catch(() => {
        setTilgang("denied");
      });
  }, [token, sakId]);

  useEffect(() => {
    const sendHeight = () => {
      const height = document.documentElement.scrollHeight;
      window.parent.postMessage({ type: "tsm-skjermd-resize", height }, "*");
    };

    sendHeight();

    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.documentElement);

    return () => observer.disconnect();
  }, []);

  if (!sakId) {
    return <p>Mangler sakId</p>;
  }

  if (tilgang === "loading") {
    return null;
  }

  if (tilgang === "denied") {
    return (
      <div className="p-4">
        <Alert variant="warning">Ingen tilgang</Alert>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="p-2">
      <SensureringEditor
        sakId={sakId}
        autoSave
        onAuthError={() => setTilgang("denied")}
      />
    </div>
  );
};
