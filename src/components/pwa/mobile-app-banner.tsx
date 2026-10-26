"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, X } from "lucide-react";
import { useI18n } from "@/i18n/client";

/** The Android app, served from public/app (not in Git: the file is too big for GitHub). */
export const APP_APK_URL = "/app/getjoblio.apk";
const DISMISSED_KEY = "joblio.appBanner.dismissed";

const isAndroid = () => /Android/i.test(navigator.userAgent);
function wasDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false; // storage blocked (private mode): show it, the X still hides it for this visit
  }
}
const noSubscribe = () => () => {};

/** Height of the bottom navigation bar on this page (0 when there is none, or from the md breakpoint up). */
function navHeightNow() {
  const nav = document.querySelector<HTMLElement>("[data-mobile-nav]");
  return nav ? Math.round(nav.getBoundingClientRect().height) : 0;
}
// Re-read when the page changes (the bar comes and goes between pages) or the window resizes. A MutationObserver,
// not a ResizeObserver: it reports DOM changes right after React commits them, without waiting for a frame.
function subscribeNav(onChange: () => void) {
  const mutations = new MutationObserver(onChange);
  mutations.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("resize", onChange);
  return () => {
    mutations.disconnect();
    window.removeEventListener("resize", onChange);
  };
}

/**
 * "Get the JOBLIO App" — a bar fixed to the bottom of the screen on Android phones only (the APK installs nowhere
 * else), sitting just above the app's bottom navigation when a page has one. Closing it is remembered on this device.
 * Rendered after hydration only (the server can't know the device), so it never causes a mismatch.
 */
export function MobileAppBanner() {
  const { t } = useI18n();
  const eligible = useSyncExternalStore(noSubscribe, () => isAndroid() && !wasDismissed(), () => false);
  const [closed, setClosed] = useState(false);
  // Pages for signed-in members have a bottom navigation bar on phones: sit on top of it.
  const navHeight = useSyncExternalStore(subscribeNav, navHeightNow, () => 0);

  if (!eligible || closed) return null;

  function close() {
    setClosed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // storage blocked: hidden for this visit only
    }
  }

  return (
    <div
      role="region"
      aria-label={t("pwa.appBannerTitle")}
      className="fixed inset-x-3 z-40 md:hidden"
      style={{ bottom: navHeight ? navHeight + 10 : "calc(env(safe-area-inset-bottom) + 12px)" }}
    >
      <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-[#0f0d1d]/95 p-2.5 text-white shadow-[0_0_28px_rgba(139,92,246,0.35)] backdrop-blur-md">
        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed 44px icon from public, no optimisation needed */}
        <img src="/icon-192.png" alt="" width={44} height={44} className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13px] font-bold leading-tight">{t("pwa.appBannerTitle")}</p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-tight text-white/70">{t("pwa.appBannerText")}</p>
        </div>
        <a
          href={APP_APK_URL}
          download="JOBLIO.apk"
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#7c66f6] px-3 py-2 text-xs font-bold text-white shadow-[0_0_14px_rgba(139,92,246,0.7)] transition active:scale-95"
        >
          <Download className="size-4" aria-hidden />
          {t("pwa.appBannerDownload")}
        </a>
        <button type="button" onClick={close} aria-label={t("common.close")} className="-ms-1 -me-1 grid size-8 shrink-0 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white">
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
