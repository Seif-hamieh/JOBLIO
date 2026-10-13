"use client";

import { useEffect, useSyncExternalStore } from "react";

// Chrome/Edge/Android fire `beforeinstallprompt` once the app is installable. We keep the
// event in a module store (captured as soon as this module loads) so any "Install app"
// button — in the user menu or in Settings — can show the browser's install dialog later.
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own button instead of the mini-infobar
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", listener);
  };
}

function isStandalone() {
  return installed || window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

// iOS (any browser there is WebKit) has no install prompt: users add it from the Share menu.
function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

type InstallState = "unsupported" | "available" | "ios" | "installed";
const getState = (): InstallState => (isStandalone() ? "installed" : deferred ? "available" : isIos() ? "ios" : "unsupported");

export function useInstallPrompt() {
  const state = useSyncExternalStore(subscribe, getState, () => "unsupported" as InstallState);
  async function install(): Promise<"accepted" | "dismissed" | "unavailable"> {
    const event = deferred;
    if (!event) return "unavailable";
    await event.prompt();
    const { outcome } = await event.userChoice;
    deferred = null; // a prompt can only be used once
    emit();
    return outcome;
  }
  return { state, install };
}

/** Removes cached pages (they contain the signed-in user's data). Call on sign-out. */
export function clearCachedPages() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.controller?.postMessage({ type: "clear-pages" });
}

/** Registers the service worker — production builds only (dev reloads would fight the cache). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}
