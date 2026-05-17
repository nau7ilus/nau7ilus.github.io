function enhanceCodeBlocks() {
  const blocks = document.querySelectorAll(
    "pre:not(.ascii):not([data-copy])",
  );
  blocks.forEach((pre) => {
    pre.dataset.copy = "1";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-btn";
    btn.textContent = "copy";
    btn.setAttribute("aria-label", "Copy code to clipboard");
    btn.addEventListener("click", async () => {
      const code = pre.querySelector("code") ?? pre;
      const text = code.textContent ?? "";
      try {
        await navigator.clipboard.writeText(text);
        btn.dataset.state = "copied";
        btn.textContent = "copied";
      } catch {
        btn.dataset.state = "failed";
        btn.textContent = "failed";
      }
      setTimeout(() => {
        btn.removeAttribute("data-state");
        btn.textContent = "copy";
      }, 1500);
    });
    pre.appendChild(btn);
  });
}
enhanceCodeBlocks();
document.addEventListener("astro:page-load", enhanceCodeBlocks);
