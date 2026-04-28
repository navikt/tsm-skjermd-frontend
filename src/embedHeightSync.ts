const THROTTLE_MS = 150;
let lastHeightSent = 0;
let throttleTimeout: ReturnType<typeof setTimeout> | null = null;

function measureContentHeight(): number {
  const root = document.getElementById("root");
  if (root) {
    return root.getBoundingClientRect().height;
  }
  const body = document.body;
  return body.getBoundingClientRect().height;
}

function sendHeightToParent() {
  const height = Math.ceil(measureContentHeight());
  if (height > 0 && Math.abs(height - lastHeightSent) > 2) {
    window.parent.postMessage({ type: "EMBED_CONTENT_HEIGHT", height }, "*");
    window.parent.postMessage({ type: "tsm-skjermd-resize", height }, "*");
    lastHeightSent = height;
  }
}

function throttledSendHeight() {
  if (throttleTimeout !== null) clearTimeout(throttleTimeout);
  throttleTimeout = setTimeout(sendHeightToParent, THROTTLE_MS);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", sendHeightToParent);
} else {
  sendHeightToParent();
}

window.addEventListener("resize", throttledSendHeight);

const resizeObserver = new ResizeObserver(throttledSendHeight);
resizeObserver.observe(document.body);
const root = document.getElementById("root");
if (root) resizeObserver.observe(root);

const mutationObserver = new MutationObserver(throttledSendHeight);
mutationObserver.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
});

setInterval(throttledSendHeight, 2000);
