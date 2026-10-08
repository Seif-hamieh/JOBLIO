"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, m } from "motion/react";
import { Award, Briefcase, FolderGit2, Globe2, Heart, MessageCircle, MoreHorizontal, Repeat2, Send, Trash2, Users } from "lucide-react";
import type { FeedComment, FeedPost } from "@/server/services/feed";
import { addCommentAction, deleteCommentAction, deletePostAction, loadCommentsAction, sharePostAction, toggleLikeAction } from "@/server/actions/feed";
import { Avatar, CompanyLogo } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { toast } from "@/components/ui/toast";
import { RichText } from "@/components/feed/rich-text";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

const TYPE_BADGE = {
  ACHIEVEMENT: { label: "feed.typeAchievement", icon: Award, tone: "ember" as const },
  PROJECT: { label: "feed.typeProject", icon: FolderGit2, tone: "aurora" as const },
  JOB: { label: "feed.typeHiring", icon: Briefcase, tone: "mint" as const },
};

function LikeButton({ post }: { post: FeedPost }) {
  const { t, f } = useI18n();
  const [liked, setLiked] = useState(post.liked);
  const [count, setCount] = useState(post.likeCount);
  const [burst, setBurst] = useState(0);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          const next = !liked;
          setLiked(next);
          setCount((c) => c + (next ? 1 : -1));
          if (next) setBurst((b) => b + 1);
          const res = await toggleLikeAction(post.id);
          if (res?.ok && res.data) {
            setLiked(res.data.liked);
            setCount(res.data.count);
          } else {
            setLiked(!next);
            setCount((c) => c + (next ? -1 : 1));
            toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
          }
        })
      }
      aria-pressed={liked}
      className={cn("relative flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium transition hover:bg-surface-2", liked ? "text-[oklch(0.62_0.2_15)]" : "text-fg-muted")}
    >
      <span className="relative">
        <m.span key={burst} initial={burst ? { scale: 0.5 } : false} animate={{ scale: [0.5, 1.3, 1] }} transition={{ duration: 0.45 }} className="block">
          <Heart className={cn("size-[18px]", liked && "fill-current")} />
        </m.span>
        <AnimatePresence>
          {burst > 0 && liked && (
            <m.span key={`b${burst}`} className="pointer-events-none absolute inset-0" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.6 }}>
              {[...Array(6)].map((_, i) => (
                <m.span
                  key={i}
                  className="absolute left-1/2 top-1/2 size-1 rounded-full bg-[oklch(0.62_0.2_15)]"
                  initial={{ x: 0, y: 0 }}
                  animate={{ x: Math.cos((i / 6) * Math.PI * 2) * 16, y: Math.sin((i / 6) * Math.PI * 2) * 16 }}
                  transition={{ duration: 0.5 }}
                />
              ))}
            </m.span>
          )}
        </AnimatePresence>
      </span>
      {count > 0 ? f.compact(count) : t("feed.like")}
    </button>
  );
}

function Comments({ post, viewer, onAdded }: { post: FeedPost; viewer: { id: string; name: string; image: string | null }; onAdded: () => void }) {
  const { t, f } = useI18n();
  const [comments, setComments] = useState<FeedComment[] | null>(null);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    let alive = true;
    void loadCommentsAction(post.id).then((c) => alive && setComments(c));
    return () => {
      alive = false;
    };
  }, [post.id]);

  return (
    <div className="border-t border-border px-5 pb-4 pt-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          start(async () => {
            const res = await addCommentAction(post.id, text);
            if (res?.ok && res.data) {
              setComments((c) => [...(c ?? []), res.data!.comment]);
              setText("");
              onAdded();
            } else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
          });
        }}
        className="flex items-center gap-2"
      >
        <Avatar name={viewer.name} src={viewer.image} size="sm" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1500}
          placeholder={t("feed.addComment")}
          className="h-10 flex-1 rounded-full border border-border bg-surface-2 px-4 text-sm outline-none focus:border-brand focus:bg-surface"
        />
        <Button type="submit" size="icon-sm" variant="ghost" loading={pending} aria-label={t("feed.postComment")} disabled={!text.trim()}>
          <Send />
        </Button>
      </form>
      <ul className="mt-3 space-y-3">
        {comments === null && <li className="skeleton h-12" />}
        {comments?.map((c) => (
          <m.li key={c.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="group flex gap-2.5">
            <Link href={`/in/${c.author.username}`}>
              <Avatar name={c.author.name} src={c.author.image} size="sm" />
            </Link>
            <div className="min-w-0 flex-1 rounded-2xl bg-surface-2 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <Link href={`/in/${c.author.username}`} className="text-[13px] font-semibold hover:underline">
                  {c.author.name}
                </Link>
                <span className="text-[11px] text-fg-subtle">{f.shortTimeAgo(c.createdAt)}</span>
                {(c.author.id === viewer.id || post.authorId === viewer.id) && (
                  <button
                    onClick={async () => {
                      const res = await deleteCommentAction(c.id);
                      if (res?.ok) setComments((list) => list?.filter((x) => x.id !== c.id) ?? null);
                    }}
                    className="ms-auto hidden text-fg-subtle hover:text-danger-fg group-hover:block"
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
              <p dir="auto" className="mt-0.5 whitespace-pre-line break-words text-sm">{c.content}</p>
            </div>
          </m.li>
        ))}
      </ul>
    </div>
  );
}

export function PostCard({ post, viewer }: { post: FeedPost; viewer: { id: string; name: string; image: string | null } }) {
  const { t, f } = useI18n();
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareText, setShareText] = useState("");
  const [deleted, setDeleted] = useState(false);
  const [pending, start] = useTransition();
  const badge = post.type !== "UPDATE" ? TYPE_BADGE[post.type] : null;
  const asCompany = post.company;

  if (deleted) return null;

  return (
    <article className="surface overflow-hidden">
      <header className="flex items-start gap-3 px-5 pt-5">
        {asCompany ? (
          <Link href={`/companies/${asCompany.slug}`}>
            <CompanyLogo name={asCompany.name} src={asCompany.logoUrl} color={asCompany.brandColor} />
          </Link>
        ) : (
          <Link href={`/in/${post.author.username}`}>
            <Avatar name={post.author.name} src={post.author.image} size="md" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <Link href={asCompany ? `/companies/${asCompany.slug}` : `/in/${post.author.username}`} className="font-semibold hover:underline">
              {asCompany ? asCompany.name : post.author.name}
            </Link>
            {badge && (
              <Badge tone={badge.tone} size="xs">
                <badge.icon /> {t(badge.label)}
              </Badge>
            )}
          </div>
          <div className="truncate text-xs text-fg-muted">{asCompany ? t("feed.postedBy", { name: post.author.name }) : post.author.profile?.headline}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-fg-subtle">
            {f.shortTimeAgo(post.createdAt)} · {post.visibility === "PUBLIC" ? <Globe2 className="size-3" aria-label={t("feed.anyone")} /> : <Users className="size-3" aria-label={t("feed.connectionsOnly")} />}
          </div>
        </div>
        {post.authorId === viewer.id && (
          <Menu>
            <MenuTrigger className="rounded-full p-1.5 text-fg-subtle hover:bg-surface-2" aria-label={t("common.more")}>
              <MoreHorizontal className="size-4" />
            </MenuTrigger>
            <MenuContent>
              <MenuItem
                danger
                icon={<Trash2 />}
                onSelect={() =>
                  start(async () => {
                    const res = await deletePostAction(post.id);
                    if (res?.ok) {
                      setDeleted(true);
                      toast.success(t("feed.postDeleted"));
                    }
                  })
                }
              >
                {t("feed.deletePost")}
              </MenuItem>
            </MenuContent>
          </Menu>
        )}
      </header>

      {post.content && <RichText text={post.content} className="px-5 pt-3" />}

      {post.mediaUrls.length > 0 && (
        <div className={cn("mt-3 grid gap-0.5", post.mediaUrls.length > 1 && "grid-cols-2")}>
          {post.mediaUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" loading="lazy" className={cn("w-full object-cover", post.mediaUrls.length === 1 ? "max-h-[440px]" : "aspect-square", post.mediaUrls.length === 3 && i === 0 && "row-span-2 h-full")} />
          ))}
        </div>
      )}

      {post.job && (
        <Link href={`/jobs/${post.job.id}`} className="mx-5 mt-3 flex items-center gap-3 rounded-2xl border border-border bg-surface-2/60 p-3.5 transition hover:border-brand/40">
          <CompanyLogo name={post.job.company.name} src={post.job.company.logoUrl} color={post.job.company.brandColor} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{post.job.title}</div>
            <div className="truncate text-xs text-fg-muted">
              {post.job.company.name} · {post.job.workMode === "REMOTE" ? t("common.remote") : f.location(post.job.city, post.job.countryCode)} · {t(`enums.employmentType.${post.job.employmentType}`)}
              {post.job.workMode === "HYBRID" && ` · ${t("enums.workMode.HYBRID")}`}
            </div>
          </div>
          <span className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-brand-fg">{post.job.status === "OPEN" ? t("feed.viewJob") : t("feed.closed")}</span>
        </Link>
      )}

      {post.project && (
        <Link href={`/in/${post.project.profile.user.username}#projects`} className="mx-5 mt-3 block overflow-hidden rounded-2xl border border-border transition hover:border-brand/40">
          {post.project.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.project.imageUrl} alt="" className="h-40 w-full object-cover" loading="lazy" />
          )}
          <div className="p-3.5">
            <div className="font-semibold">{post.project.title}</div>
            {post.project.summary && <div className="text-sm text-fg-muted">{post.project.summary}</div>}
          </div>
        </Link>
      )}

      {post.sharedPost && (
        <div className="mx-5 mt-3 rounded-2xl border border-border p-4">
          <div className="flex items-center gap-2 text-sm">
            <Avatar name={post.sharedPost.author.name} src={post.sharedPost.author.image} size="xs" />
            <Link href={`/in/${post.sharedPost.author.username}`} className="font-semibold hover:underline">
              {post.sharedPost.company?.name ?? post.sharedPost.author.name}
            </Link>
            <span className="text-xs text-fg-subtle">{f.shortTimeAgo(post.sharedPost.createdAt)}</span>
          </div>
          <RichText text={post.sharedPost.content} clamp={200} className="mt-2 text-sm" />
        </div>
      )}

      {(post.likeCount > 0 || commentCount > 0 || post.shareCount > 0) && (
        <div className="flex justify-end gap-3 px-5 pt-3 text-xs text-fg-subtle">
          {commentCount > 0 && (
            <button onClick={() => setShowComments(true)} className="hover:underline">
              {t("feed.comments", { n: commentCount })}
            </button>
          )}
          {post.shareCount > 0 && (
            <span>
              {t("feed.shares", { n: post.shareCount })}
            </span>
          )}
        </div>
      )}

      <div className="mt-2 flex gap-1 border-t border-border px-3 py-1.5">
        <LikeButton post={post} />
        <button type="button" onClick={() => setShowComments((s) => !s)} className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium text-fg-muted transition hover:bg-surface-2" aria-expanded={showComments}>
          <MessageCircle className="size-[18px]" /> {t("feed.comment")}
        </button>
        <button type="button" onClick={() => setShareOpen(true)} className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium text-fg-muted transition hover:bg-surface-2">
          <Repeat2 className="size-[18px]" /> {t("feed.share")}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showComments && (
          <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <Comments post={post} viewer={viewer} onAdded={() => setCommentCount((c) => c + 1)} />
          </m.div>
        )}
      </AnimatePresence>

      <Dialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        title={t("feed.sharePost")}
        description={t("feed.sharePostSub")}
        footer={
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await sharePostAction(post.sharedPost?.id ?? post.id, shareText);
                if (res?.ok) {
                  toast.success(t("feed.sharedToFeed"));
                  setShareOpen(false);
                  setShareText("");
                } else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
              })
            }
          >
            {t("feed.share")}
          </Button>
        }
      >
        <Textarea value={shareText} onChange={(e) => setShareText(e.target.value)} maxLength={3000} placeholder={t("feed.whatThink")} />
      </Dialog>
    </article>
  );
}
