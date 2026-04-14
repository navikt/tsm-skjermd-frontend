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
    let frameId = 0;

    const sendHeight = () => {
      const body = document.body;
      const doc = document.documentElement;
      const height = Math.max(
        body?.scrollHeight ?? 0,
        body?.offsetHeight ?? 0,
        doc.scrollHeight,
        doc.offsetHeight,
        doc.clientHeight
      );
      window.parent.postMessage({ type: "tsm-skjermd-resize", height }, "*");
    };

    const scheduleHeightSync = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(sendHeight);
    };

    scheduleHeightSync();

    const resizeObserver = new ResizeObserver(scheduleHeightSync);
    if (document.body) {
      resizeObserver.observe(document.body);
    }
    resizeObserver.observe(document.documentElement);

    const mutationObserver = new MutationObserver(scheduleHeightSync);
    if (document.body) {
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
    }

    window.addEventListener("resize", scheduleHeightSync);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", scheduleHeightSync);
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
