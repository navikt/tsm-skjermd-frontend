const THROTTLE_MS = 150;
let lastHeightSent = 0;
let throttleTimeout: ReturnType<typeof setTimeout> | null = null;

function measureContentHeight(): number {
  const html = document.documentElement;
  const body = document.body;
  return Math.max(
    html.scrollHeight,
    html.offsetHeight,
    body.scrollHeight,
    body.offsetHeight
  );
}

function sendHeightToParent() {
  const height = measureContentHeight();
  if (Math.abs(height - lastHeightSent) > 10) {
    window.parent.postMessage({ type: "EMBED_CONTENT_HEIGHT", height }, "*");
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

const mutationObserver = new MutationObserver(throttledSendHeight);
mutationObserver.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
});

setInterval(throttledSendHeight, 2000);
