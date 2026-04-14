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

    fetch(`/api/validate-embed-token?token=${encodeURIComponent(token)}&sakId=${encodeURIComponent(sakId)}`)
      .then((res) => {
        setTilgang(res.ok ? "ok" : "denied");
      }).catch(() => {
        setTilgang("denied");
      });
  }, [token, sakId]);

  useEffect(() => {
    let lastHeight = 0;

    const reportHeight = () => {
      const root = document.getElementById("root");
      const height = root ? root.scrollHeight : document.body?.scrollHeight ?? 0;
      if (height > 0 && height !== lastHeight) {
        lastHeight = height;
        window.parent.postMessage({ type: "tsm-skjermd-resize", height }, "*");
      }
    };

    reportHeight();

    const resizeObserver = new ResizeObserver(reportHeight);
    if (document.body) resizeObserver.observe(document.body);

    const interval = setInterval(reportHeight, 200);

    return () => {
      resizeObserver.disconnect();
      clearInterval(interval);
    };
  }, []);

  if (!sakId) {
    return <p>Mangler sakId</p>;
  }

  if (tilgang === "loading") {
    return null;
  }

  if (tilgang === "denied") {
    return (
      <div className="p-4" style={{ backgroundColor: "var(--ax-bg-danger-soft)" }}>
        <Alert variant="warning">Ingen tilgang</Alert>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="p-2" style={{ backgroundColor: "var(--ax-bg-danger-soft)" }}>
      <SensureringEditor
        sakId={sakId}
        autoSave
        onAuthError={() => setTilgang("denied")}
      />
    </div>
  );
};
