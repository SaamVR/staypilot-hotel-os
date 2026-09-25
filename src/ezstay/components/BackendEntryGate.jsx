import { useEffect, useRef, useState } from "react";
import { ShieldCheck, X } from "lucide-react";

const TURNSTILE_SCRIPT_ID = "ezstay-turnstile-script";
const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadTurnstile() {
  if (globalThis.turnstile?.render) return Promise.resolve(globalThis.turnstile);
  if (!globalThis.document) return Promise.reject(new Error("turnstile_unavailable"));

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID);
    const finish = () => globalThis.turnstile?.render
      ? resolve(globalThis.turnstile)
      : reject(new Error("turnstile_unavailable"));

    if (existing) {
      existing.addEventListener("load", finish, { once:true });
      existing.addEventListener("error", () => reject(new Error("turnstile_unavailable")), { once:true });
      setTimeout(() => {
        if (globalThis.turnstile?.render) resolve(globalThis.turnstile);
      }, 0);
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", finish, { once:true });
    script.addEventListener("error", () => reject(new Error("turnstile_unavailable")), { once:true });
    document.head.appendChild(script);
  });
}

export default function BackendEntryGate({
  open,
  siteKey,
  busy,
  error,
  onToken,
  onError,
  onCancel,
}) {
  const containerRef = useRef(null);
  const callbacksRef = useRef({ onToken, onError });
  const [widgetState, setWidgetState] = useState("loading");
  callbacksRef.current = { onToken, onError };

  useEffect(() => {
    if (!open || !siteKey) return undefined;
    let active = true;
    let widgetId = null;

    loadTurnstile().then(api => {
      if (!active || !containerRef.current) return;
      setWidgetState("ready");
      widgetId = api.render(containerRef.current, {
        sitekey:siteKey,
        theme:"light",
        size:"flexible",
        action:"ezstay_demo",
        appearance:"interaction-only",
        callback(token) {
          if (!active) return;
          setWidgetState("verified");
          callbacksRef.current.onToken?.(token);
        },
        "error-callback"(code) {
          if (!active) return;
          setWidgetState("error");
          callbacksRef.current.onError?.(`Turnstile verification failed${code ? ` (${code})` : ""}.`);
        },
        "expired-callback"() {
          if (!active) return;
          setWidgetState("ready");
          callbacksRef.current.onError?.("Verification expired. Please try again.");
        },
      });
    }).catch(() => {
      if (!active) return;
      setWidgetState("error");
      callbacksRef.current.onError?.("Verification could not load.");
    });

    return () => {
      active = false;
      if (widgetId !== null && globalThis.turnstile?.remove) {
        try { globalThis.turnstile.remove(widgetId); } catch {}
      }
    };
  }, [open, siteKey]);

  if (!open) return null;

  return <div className="backend-entry-backdrop" role="presentation">
    <section className="backend-entry-card" role="dialog" aria-modal="true" aria-labelledby="backend-entry-title">
      <button className="backend-entry-close" onClick={onCancel} disabled={busy} aria-label="Close verification"><X size={17}/></button>
      <span className="backend-entry-icon"><ShieldCheck size={21}/></span>
      <span className="presentation-kicker">Protected demo sandbox</span>
      <h2 id="backend-entry-title">Create your isolated Northstar workspace</h2>
      <p>One quick verification protects the public demo from automated abuse. No email, phone number, or personal profile is required.</p>
      <div ref={containerRef} className="turnstile-container" aria-live="polite"/>
      <div className="backend-entry-status">
        {busy ? "Preparing your sandbox…" : widgetState === "loading" ? "Loading verification…" : "Verification is handled by Cloudflare Turnstile."}
      </div>
      {error && <div className="backend-entry-error" role="alert">{error}</div>}
      <small>After verification, Supabase creates an anonymous Auth identity used only to isolate your demo data.</small>
    </section>
  </div>;
}
