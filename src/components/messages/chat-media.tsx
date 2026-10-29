"use client";

import { useEffect, useRef, useState } from "react";
import { FileArchive, FileText, MapPin, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

// Photos, voice messages, documents and locations in chat. A file goes up in two steps: its bytes to
// /api/v1/chat-upload (streamed to disk there, up to 100 MB), then the message with the returned url.

/** The server's limit for one chat file (100 MB). Checked here first so a huge file isn't sent for nothing. */
export const CHAT_MAX_BYTES = 100 * 1000 * 1000;

/** What the picker offers: images, PDF, Word, ZIP and text (the server checks the real type again). */
export const CHAT_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,.pdf,.doc,.docx,.zip,.txt,application/pdf,application/zip,text/plain";

export type Uploaded = { url: string; name: string; size: number; mime: string; kind: "IMAGE" | "AUDIO" | "FILE" };

/**
 * Sends a file's bytes to the chat upload, reporting progress (0–100). Rejects with a message to show. XHR rather
 * than fetch: fetch can't report upload progress.
 */
export function uploadChatFile(conversationId: string, file: File, onProgress: (pct: number) => void): Promise<Uploaded> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/v1/chat-upload?c=${encodeURIComponent(conversationId)}&name=${encodeURIComponent(file.name)}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data: { error?: { key?: string; message?: string } } & Partial<Uploaded> = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status === 201 && data.url) resolve(data as Uploaded);
      // A key ("@msg.…") is shown in the reader's language by the caller; Cloudflare's own 413 page has none.
      else reject(new Error(data.error?.key ?? (xhr.status === 413 ? "@messages.fileTooBig" : "@messages.notSent")));
    };
    xhr.onerror = () => reject(new Error("@messages.notSent"));
    xhr.send(file);
  });
}

/** Where the browser is now (asks for permission the first time). */
export function currentLocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("@messages.locationDenied"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: Number(p.coords.latitude.toFixed(6)), longitude: Number(p.coords.longitude.toFixed(6)) }),
      () => reject(new Error("@messages.locationDenied")),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 60_000 },
    );
  });
}

// ── Voice recording ─────────────────────────────────────────────────────────────────────────────────────────────

/** WebM/Opus where the browser can (Chrome, Firefox, Edge); MP4/AAC on Safari. */
function recorderType() {
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) if (MediaRecorder.isTypeSupported(type)) return type;
  return "";
}

/** A voice message stops by itself after 10 minutes. */
const MAX_SECONDS = 600;

/** Click the microphone to start; the composer shows a recording bar until you send or delete it. */
export function useVoiceRecorder(onError: (key: string) => void, onDone: (file: File) => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const keep = useRef(false);
  const started = useRef(0);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      const s = Math.floor((Date.now() - started.current) / 1000);
      setSeconds(s);
      if (s >= MAX_SECONDS) stop(true);
    }, 250);
    return () => clearInterval(timer);
  }, [recording]);

  // Leaving the conversation mid-recording releases the microphone.
  useEffect(() => () => stop(false), []);

  async function start() {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices) return onError("@messages.noRecorder");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return onError("@messages.micDenied");
    }
    const type = recorderType();
    const rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 64_000 } : undefined);
    chunks.current = [];
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      // Under a second is almost always a slip of the finger.
      if (!keep.current || Date.now() - started.current < 1000) return;
      const mime = rec.mimeType || type || "audio/webm";
      const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
      onDone(new File(chunks.current, `voice-message.${ext}`, { type: mime.split(";")[0] }));
    };
    recorder.current = rec;
    rec.start(1000);
    started.current = Date.now();
    setSeconds(0);
    setRecording(true);
  }

  function stop(send: boolean) {
    keep.current = send;
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    recorder.current = null;
    setRecording(false);
  }

  return { recording, seconds, start, send: () => stop(true), cancel: () => stop(false) };
}

export const formatDuration = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, "0")}`;

export function formatBytes(n: number | null) {
  if (!n) return "";
  return n >= 1000 * 1000 ? `${(n / 1000 / 1000).toFixed(n < 10 * 1000 * 1000 ? 1 : 0)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`;
}

// ── Message contents ────────────────────────────────────────────────────────────────────────────────────────────

/** Play / pause, a progress bar you can click to jump, and the time. Nothing downloads until you press play. */
export function VoiceMessage({ src, mine }: { src: string; mine: boolean }) {
  const { t } = useI18n();
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  function toggle() {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setPlaying(false));
    else a.pause();
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audio.current;
    if (!a || !duration) return;
    const box = e.currentTarget.getBoundingClientRect();
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const x = rtl ? box.right - e.clientX : e.clientX - box.left;
    a.currentTime = Math.min(duration, Math.max(0, (x / box.width) * duration));
  }

  const pct = duration ? Math.min(100, (time / duration) * 100) : 0;
  return (
    <div className={cn("flex w-64 items-center gap-3 rounded-3xl px-3 py-2.5", mine ? "rounded-ee-lg bg-brand text-brand-fg" : "rounded-es-lg bg-surface-2")}>
      <audio
        ref={audio}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setTime(0);
        }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        // WebM recordings often report no length until fully read; Infinity is treated as "not known yet".
        onDurationChange={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
      />
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full transition",
          mine ? "bg-white/20 hover:bg-white/30" : "bg-brand/15 text-brand-soft-fg hover:bg-brand/25",
        )}
        aria-label={playing ? "Pause" : t("messages.voiceMessage")}
      >
        {playing ? <Pause className="size-5" /> : <Play className="size-5 ms-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <div onClick={seek} className={cn("h-1.5 cursor-pointer overflow-hidden rounded-full", mine ? "bg-white/25" : "bg-border")}>
          <div className={cn("h-full rounded-full transition-[width] duration-200", mine ? "bg-white" : "bg-brand")} style={{ width: `${pct}%` }} />
        </div>
        <div className={cn("mt-1.5 text-[11px] tabular-nums", mine ? "text-white/80" : "text-fg-subtle")}>
          {duration ? `${formatDuration(time)} / ${formatDuration(duration)}` : playing ? formatDuration(time) : t("messages.voiceMessage")}
        </div>
      </div>
    </div>
  );
}

/** A document: icon, name and size; opens or downloads it. */
export function FileCard({ href, name, size, mime }: { href: string; name: string; size: number | null; mime: string | null }) {
  const zip = mime === "application/zip";
  const ext = name.includes(".") ? name.split(".").pop()!.toUpperCase() : "FILE";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download={zip ? name : undefined}
      className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 hover:border-brand/40"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-soft-fg">
        {zip ? <FileArchive className="size-5" /> : <FileText className="size-5" />}
      </span>
      <span className="min-w-0">
        <span className="block max-w-[220px] truncate text-sm font-medium">{name}</span>
        <span className="text-xs text-fg-subtle">{[ext, formatBytes(size)].filter(Boolean).join(" · ")}</span>
      </span>
    </a>
  );
}

// OpenStreetMap tiles for the preview (no key needed): a 3×3 block of 256 px tiles around the spot, moved so the
// spot sits in the middle of the card, with a pin on top.
const ZOOM = 15;
const W = 256;
const H = 150;

export function LocationCard({ latitude, longitude }: { latitude: number; longitude: number }) {
  const { t } = useI18n();
  const n = 2 ** ZOOM;
  const x = ((longitude + 180) / 360) * n;
  const rad = (latitude * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const left = W / 2 - (x - tx + 1) * 256;
  const top = H / 2 - (y - ty + 1) * 256;
  const tiles = [];
  for (let dy = 0; dy < 3; dy++)
    for (let dx = 0; dx < 3; dx++) tiles.push({ dx, dy, src: `https://tile.openstreetmap.org/${ZOOM}/${tx - 1 + dx}/${ty - 1 + dy}.png` });
  return (
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block overflow-hidden rounded-2xl border border-border bg-surface hover:border-brand/40"
      style={{ width: W }}
    >
      <div dir="ltr" className="relative overflow-hidden bg-surface-2" style={{ width: W, height: H }}>
        {tiles.map((tile) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={tile.src}
            src={tile.src}
            alt=""
            width={256}
            height={256}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="absolute max-w-none"
            style={{ left: left + tile.dx * 256, top: top + tile.dy * 256 }}
          />
        ))}
        <MapPin className="absolute size-9 -translate-x-1/2 -translate-y-full fill-brand text-white drop-shadow" style={{ left: W / 2, top: H / 2 }} />
        <span className="absolute bottom-0.5 right-1 rounded bg-white/75 px-1 text-[9px] text-neutral-700">© OpenStreetMap</span>
      </div>
      <div className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium">
        <MapPin className="size-4 text-brand-soft-fg" /> {t("messages.location")} · <span className="text-brand-soft-fg">{t("messages.openInMaps")}</span>
      </div>
    </a>
  );
}
