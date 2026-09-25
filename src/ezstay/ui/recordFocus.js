export function scrollRecordIntoView(recordId) {
  if (!recordId) return undefined;

  const frame = globalThis.requestAnimationFrame?.(() => {
    const target = [...document.querySelectorAll("[data-record-id]")]
      .find(node => node.dataset.recordId === String(recordId));
    if (!target) return;

    const reduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    target.scrollIntoView({
      behavior:reduced ? "auto" : "smooth",
      block:"center",
    });
  });

  return () => globalThis.cancelAnimationFrame?.(frame);
}
