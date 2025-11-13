// Amazon Rufus blocker, stricter version
(function initRufusBlocker() {
  const ATTR_HINTS = [
    '[aria-label*="Rufus"]',
    '[aria-labelledby*="rufus"]',
    '[id*="rufus"]',
    '[class*="rufus"]',
    '[data-cel-widget*="rufus"]',
    '[data-component-type*="assistant"]',
    '[data-widget-type*="assistant"]',
    '[data-a-popover*="rufus"]'
  ];

  const TEXT_HINTS = ["Rufus", "Ask Rufus", "Shopping assistant", "Ask our shopping assistant"];

  const CONTAINER_TAGS = ["DIV", "ASIDE", "SECTION", "IFRAME", "DIALOG"];

  const isVisible = (el: HTMLElement) => {
    const style = el.ownerDocument.defaultView?.getComputedStyle(el);
    if (!style) return false;
    if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity || "1") === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const looksLikeRufusByText = (el: Element) => {
    if (!(el instanceof HTMLElement)) return false;
    if (!CONTAINER_TAGS.includes(el.tagName)) return false;         // ignore SCRIPT and STYLE
    const txt = el.innerText?.trim() || "";
    if (!txt) return false;
    return TEXT_HINTS.some(h => txt.includes(h));
  };

  const hide = (el: HTMLElement, reason: string) => {
    if (!el || el.hasAttribute("data-wm-rufus-blocked")) return;
    if (!CONTAINER_TAGS.includes(el.tagName)) return;               // only UI containers
    if (!isVisible(el) && !reason.startsWith("attr")) return;       // avoid hiding invisible nodes unless strong attr match
    el.style.setProperty("display", "none", "important");
    el.style.setProperty("pointer-events", "none", "important");
    el.setAttribute("data-wm-rufus-blocked", reason);
    console.log("[wm] Rufus UI hidden:", reason, el);
  };

  const sweep = () => {
    // strong attribute based matches
    ATTR_HINTS.forEach(sel => {
      document.querySelectorAll<HTMLElement>(sel).forEach(n => hide(n, "attr " + sel));
    });
    // dialog or visible container that mentions Rufus
    document.querySelectorAll<HTMLElement>('div,aside,section,iframe,[role="dialog"]').forEach(n => {
      if (n.getAttribute("role") === "dialog" && looksLikeRufusByText(n)) hide(n, "dialog+text");
      else if (looksLikeRufusByText(n)) hide(n, "text");
    });
  };

  // initial pass
  sweep();

  // watch dynamic injections
  const obs = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === "childList") {
        m.addedNodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return;
          // check node and descendants
          if (looksLikeRufusByText(node)) hide(node, "mutation text");
          ATTR_HINTS.forEach(sel => node.querySelectorAll<HTMLElement>(sel).forEach(n => hide(n, "mutation " + sel)));
          node.querySelectorAll<HTMLElement>('div,aside,section,iframe,[role="dialog"]').forEach(n => {
            if (n.getAttribute("role") === "dialog" && looksLikeRufusByText(n)) hide(n, "mutation dialog+text");
            else if (looksLikeRufusByText(n)) hide(n, "mutation text");
          });
        });
      }
      if (m.type === "attributes" && m.target instanceof HTMLElement) {
        const el = m.target;
        if (looksLikeRufusByText(el)) hide(el, "attr-change text");
      }
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "id", "role", "aria-label", "aria-labelledby", "data-cel-widget", "data-component-type", "data-widget-type", "data-a-popover"] });

  // periodic safety pass for SPA navigations
  setInterval(sweep, 3000);
})();
