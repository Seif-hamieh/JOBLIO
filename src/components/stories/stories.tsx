"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Eye, ImagePlus, Pause, Play, Plus, Trash2, X } from "lucide-react";
import { createStoryAction, deleteStoryAction, markStoryViewedAction } from "@/server/actions/stories";
import type { listStories } from "@/server/services/stories";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { resolveMessage } from "@/i18n/message";
import { acceptFor, checkUpload } from "@/lib/upload-check";
import { cn } from "@/lib/utils";
import { inspectVideo, uploadVideo, VIDEO_ACCEPT, type PickedVideo } from "@/lib/video-upload";

// Stories on the website, the same as in the app: a row of circles above the feed (yours first, a coloured ring
// while someone has stories you haven't seen), a full-screen viewer, and "Add story" for a photo or a video (up to
// 60 s). Stories last 24 hours and are seen by your connections and followers.

export type StoryGroup = Awaited<ReturnType<typeof listStories>>[number];

/** How long a photo story stays on screen; a video runs for its own length. */
const PHOTO_MS = 5000;

export function StoriesRow({ groups, viewer }: { groups: StoryGroup[]; viewer: { name: string; image: string | null } }) {
  const { t } = useI18n();
  // Seen here since the page loaded (the server's "seen" is from page load).
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [openAt, setOpenAt] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const mine = groups.find((g) => g.mine);
  const unseen = (g: StoryGroup) => g.stories.some((s) => !s.seen && !seen.has(s.id));

  return (
    <>
      <div className="surface flex gap-4 overflow-x-auto p-4" aria-label={t("feed.stories")}>
        {!mine && (
          <button type="button" onClick={() => setComposing(true)} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
            <span className="relative">
              <Avatar name={viewer.name} src={viewer.image} size="lg" />
              <span className="absolute -bottom-0.5 -end-0.5 grid size-5 place-items-center rounded-full border-2 border-surface bg-brand text-white">
                <Plus className="size-3" />
              </span>
            </span>
            <span className="w-full truncate text-center text-xs text-fg-muted">{t("feed.addStory")}</span>
          </button>
        )}
        {groups.map((g, i) => (
          <div key={g.user.id} className="relative flex w-16 shrink-0 flex-col items-center gap-1.5">
            <button type="button" onClick={() => setOpenAt(i)} className="flex flex-col items-center gap-1.5" aria-label={g.mine ? t("feed.yourStory") : g.user.name}>
              <span className={cn("rounded-full p-0.5", unseen(g) ? "bg-gradient-to-tr from-brand to-fuchsia-500" : "bg-border")}>
                <span className="block rounded-full border-2 border-surface">
                  <Avatar name={g.user.name} src={g.user.image} size="lg" />
                </span>
              </span>
              <span className="w-16 truncate text-center text-xs text-fg-muted">{g.mine ? t("feed.yourStory") : g.user.name}</span>
            </button>
            {g.mine && (
              <button
                type="button"
                onClick={() => setComposing(true)}
                className="absolute end-0 top-10 grid size-5 place-items-center rounded-full border-2 border-surface bg-brand text-white"
                aria-label={t("feed.addStory")}
              >
                <Plus className="size-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      {openAt !== null && (
        <StoryViewer
          groups={groups}
          start={openAt}
          onSeen={(id) => setSeen((s) => (s.has(id) ? s : new Set(s).add(id)))}
          isSeen={(id) => seen.has(id)}
          onClose={() => setOpenAt(null)}
        />
      )}
      <StoryComposer open={composing} onOpenChange={setComposing} />
    </>
  );
}

// ── Viewer ───────────────────────────────────────────────────────────────────────────────────────────────────────

function StoryViewer({
  groups,
  start,
  onSeen,
  isSeen,
  onClose,
}: {
  groups: StoryGroup[];
  start: number;
  onSeen: (id: string) => void;
  isSeen: (id: string) => boolean;
  onClose: () => void;
}) {
  const { t, f } = useI18n();
  const router = useRouter();
  // Stories deleted here, hidden until the page refreshes.
  const [gone, setGone] = useState<Set<string>>(() => new Set());
  const live = groups.map((g) => ({ ...g, stories: g.stories.filter((s) => !gone.has(s.id)) })).filter((g) => g.stories.length > 0);
  const [groupIndex, setGroupIndex] = useState(() => Math.max(0, live.findIndex((g) => g.user.id === groups[start]?.user.id)));
  const group = live[groupIndex];
  const [storyIndex, setStoryIndex] = useState(() => {
    const first = group?.stories.findIndex((s) => !s.seen && !isSeen(s.id)) ?? -1;
    return first > 0 ? first : 0;
  });
  const story = group?.stories[Math.min(storyIndex, (group?.stories.length ?? 1) - 1)];
  const [paused, setPaused] = useState(false);
  // How long the bar runs, once the photo or video can be shown (null while loading).
  const [duration, setDuration] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const next = useCallback(() => {
    if (!group) return;
    setDuration(null);
    if (storyIndex < group.stories.length - 1) return setStoryIndex(storyIndex + 1);
    if (groupIndex < live.length - 1) {
      setGroupIndex(groupIndex + 1);
      return setStoryIndex(0);
    }
    onClose();
  }, [group, storyIndex, groupIndex, live.length, onClose]);
  const previous = useCallback(() => {
    setDuration(null);
    if (storyIndex > 0) return setStoryIndex(storyIndex - 1);
    if (groupIndex > 0) {
      setStoryIndex(live[groupIndex - 1]!.stories.length - 1);
      return setGroupIndex(groupIndex - 1);
    }
  }, [storyIndex, groupIndex, live]);

  // Nothing left to show (the last one was deleted).
  useEffect(() => {
    if (!story) onClose();
  }, [story, onClose]);

  // Seen as soon as it's on screen; counted on the server once (your own never are).
  useEffect(() => {
    if (!story || !group) return;
    onSeen(story.id);
    if (!group.mine && !story.seen) void markStoryViewedAction(story.id);
    // Once per story shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || duration === null) return;
    if (paused) v.pause();
    else void v.play().catch(() => undefined);
  }, [paused, duration, story?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") (document.dir === "rtl" ? previous : next)();
      else if (e.key === "ArrowLeft") (document.dir === "rtl" ? next : previous)();
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [next, previous, onClose]);

  if (!group || !story) return null;
  const index = group.stories.indexOf(story);

  async function remove() {
    if (!story || !window.confirm(t("feed.storyDeleteConfirm"))) return;
    setPaused(true);
    const res = await deleteStoryAction(story.id);
    setPaused(false);
    if (!res?.ok) return toast.error(res?.error ?? t("msg.error"));
    toast.success(t("feed.storyDeleted"));
    setDuration(null);
    setGone((g) => new Set(g).add(story.id));
    if (index > 0 && index === group!.stories.length - 1) setStoryIndex(index - 1);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95" role="dialog" aria-modal aria-label={group.mine ? t("feed.yourStory") : group.user.name}>
      <div className="relative h-full max-h-[min(100dvh,900px)] w-full max-w-[min(100vw,calc(min(100dvh,900px)*9/16))] overflow-hidden bg-black sm:rounded-2xl">
        {story.mediaType === "VIDEO" ? (
          <video
            key={story.id}
            ref={videoRef}
            src={story.mediaUrl}
            poster={story.thumbnailUrl ?? undefined}
            playsInline
            autoPlay
            className="absolute inset-0 size-full object-contain"
            onLoadedMetadata={(e) => setDuration(Math.max(1, e.currentTarget.duration) * 1000)}
            onError={() => setDuration(PHOTO_MS)}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={story.id} src={story.mediaUrl} alt="" className="absolute inset-0 size-full object-contain" onLoad={() => setDuration(PHOTO_MS)} onError={() => setDuration(PHOTO_MS)} />
        )}

        {/* Tap: the start third goes back, the rest goes forward. */}
        <button type="button" className="absolute inset-y-0 start-0 w-1/3" onClick={previous} aria-label={t("feed.storyPrevious")} />
        <button type="button" className="absolute inset-y-0 end-0 w-2/3" onClick={next} aria-label={t("feed.storyNext")} />

        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-3 pb-10">
          <div className="flex gap-1">
            {group.stories.map((s, i) => (
              <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
                {i < index && <div className="h-full w-full bg-white" />}
                {i === index && duration !== null && (
                  <div
                    key={`${s.id}-${duration}`}
                    className="story-progress h-full bg-white"
                    style={{ animationDuration: `${duration}ms`, animationPlayState: paused ? "paused" : "running" }}
                    onAnimationEnd={next}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="pointer-events-auto mt-3 flex items-center gap-2.5">
            <Link href={group.user.username ? `/in/${group.user.username}` : "#"} className="flex min-w-0 flex-1 items-center gap-2.5">
              <Avatar name={group.user.name} src={group.user.image} size="sm" />
              <span className="truncate text-sm font-semibold text-white">{group.mine ? t("feed.yourStory") : group.user.name}</span>
              <span className="shrink-0 text-xs text-white/70" suppressHydrationWarning>
                {f.shortTimeAgo(story.createdAt)}
              </span>
            </Link>
            <button type="button" onClick={() => setPaused((p) => !p)} className="rounded-full p-1.5 text-white hover:bg-white/15" aria-label={paused ? t("feed.storyPlay") : t("feed.storyPause")}>
              {paused ? <Play className="size-5" /> : <Pause className="size-5" />}
            </button>
            {group.mine && (
              <button type="button" onClick={remove} className="rounded-full p-1.5 text-white hover:bg-white/15" aria-label={t("feed.storyDelete")}>
                <Trash2 className="size-5" />
              </button>
            )}
            <button type="button" onClick={onClose} className="rounded-full p-1.5 text-white hover:bg-white/15" aria-label={t("feed.storyClose")}>
              <X className="size-6" />
            </button>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 bg-gradient-to-t from-black/60 to-transparent p-4 pt-10">
          {story.text && <p className="rounded-2xl bg-black/55 px-4 py-2.5 text-center text-[15px] leading-relaxed text-white">{story.text}</p>}
          {group.mine && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/85 px-3.5 py-1.5 text-sm font-semibold text-white">
              <Eye className="size-4" /> {t("feed.storyViews", { n: story.viewCount ?? 0 })}
            </span>
          )}
        </div>
      </div>

      {/* Big screens: arrows beside the story. */}
      <button type="button" onClick={previous} className="absolute start-4 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 md:block" aria-label={t("feed.storyPrevious")}>
        <ChevronLeft className="size-6 rtl:rotate-180" />
      </button>
      <button type="button" onClick={next} className="absolute end-4 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 md:block" aria-label={t("feed.storyNext")}>
        <ChevronRight className="size-6 rtl:rotate-180" />
      </button>
    </div>
  );
}

// ── Add a story ──────────────────────────────────────────────────────────────────────────────────────────────────

function StoryComposer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [text, setText] = useState("");
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const clear = () => {
    if (photo) URL.revokeObjectURL(photo.url);
    if (video) URL.revokeObjectURL(video.url);
    setPhoto(null);
    setVideo(null);
  };

  async function pick(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      if (file.type.startsWith("video/") || /\.(mp4|mov)$/i.test(file.name)) {
        const picked = await inspectVideo(file, "story");
        clear();
        setVideo(picked);
      } else {
        const problem = checkUpload(file, "image", t);
        if (problem) return toast.error(problem);
        clear();
        setPhoto({ file, url: URL.createObjectURL(file) });
      }
    } catch (e) {
      toast.error(resolveMessage(t, e instanceof Error ? e.message : "@feed.videoUnreadable"));
    }
  }

  async function share() {
    if ((!photo && !video) || sharing) return;
    setSharing(true);
    const form = new FormData();
    if (text.trim()) form.set("text", text.trim());
    try {
      if (video) {
        setUploadPct(0);
        const urls = await uploadVideo(video, setUploadPct);
        form.set("videoUrl", urls.videoUrl);
        if (urls.thumbnailUrl) form.set("thumbnailUrl", urls.thumbnailUrl);
      } else if (photo) form.set("image", photo.file);
      const res = await createStoryAction(null, form);
      if (!res?.ok) throw new Error(res?.error ?? t("msg.error"));
      toast.success(t("feed.storyShared"));
      clear();
      setText("");
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(resolveMessage(t, e instanceof Error ? e.message : "@msg.error"));
    } finally {
      setUploadPct(null);
      setSharing(false);
    }
  }

  const preview = video?.url ?? photo?.url;
  return (
    <Dialog open={open} onOpenChange={(o) => !sharing && onOpenChange(o)} title={t("feed.newStory")}>
      <div className="space-y-4">
        <input ref={inputRef} type="file" accept={`${acceptFor("image")},${VIDEO_ACCEPT}`} className="sr-only" onChange={(e) => void pick(e.target)} />
        {preview ? (
          <div className="relative mx-auto aspect-[9/16] w-full max-w-64 overflow-hidden rounded-2xl bg-black">
            {video ? (
              <video src={video.url} autoPlay muted loop playsInline className="size-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="size-full object-cover" />
            )}
            {text.trim() && <p className="absolute inset-x-3 bottom-14 rounded-xl bg-black/55 p-2 text-center text-sm text-white">{text.trim()}</p>}
            <button type="button" onClick={() => inputRef.current?.click()} disabled={sharing} className="absolute bottom-2.5 end-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">
              <ImagePlus className="size-3.5" /> {t("feed.storyChange")}
            </button>
            {uploadPct !== null && (
              <div className="absolute inset-0 grid place-items-center bg-black/50 text-sm font-semibold text-white">{t("feed.uploadingVideo", { pct: uploadPct })}</div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mx-auto flex aspect-[9/16] w-full max-w-64 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border text-brand-soft-fg hover:border-brand/50"
          >
            <ImagePlus className="size-10" />
            <span className="text-sm font-semibold">{t("feed.storyChoose")}</span>
          </button>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={250}
          placeholder={t("feed.storyCaption")}
          className="min-h-20 w-full resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-fg-subtle">{t("feed.storyHint")}</span>
          <Button onClick={share} loading={sharing} disabled={!preview} pill>
            {t("feed.storyShare")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
