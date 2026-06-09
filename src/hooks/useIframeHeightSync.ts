import { useEffect } from "react";

export function useIframeHeightSync() {
  useEffect(() => {
    let lastHeight = 0;

    const reportHeight = () => {
      const root = document.getElementById("root");
      let height = root ? root.scrollHeight : document.body?.scrollHeight ?? 0;

      const modal = document.querySelector("dialog[open]");
      if (modal) {
        const modalRect = modal.getBoundingClientRect();
        const modalBottom = modalRect.top + window.scrollY + modalRect.height;
        height = Math.max(height, modalBottom);
      }

      if (height > 0 && height !== lastHeight) {
        lastHeight = height;
        window.parent.postMessage({ type: "tsm-skjermd-resize", height }, "*");
      }
    };

    reportHeight();

    const resizeObserver = new ResizeObserver(reportHeight);
    if (document.body) resizeObserver.observe(document.body);

    const mutationObserver = new MutationObserver(reportHeight);
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    const interval = setInterval(reportHeight, 200);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      clearInterval(interval);
    };
  }, []);
}
