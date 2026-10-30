import Link from "next/link";
import { Briefcase, Heart, MessageCircle } from "lucide-react";
import { getI18n } from "@/i18n/server";
import type { FeedPost } from "@/server/services/feed";
import { Avatar, CompanyLogo } from "@/components/ui/avatar";
import { RichText } from "@/components/feed/rich-text";
import { buttonClasses } from "@/components/ui/button";

/**
 * A public post for signed-out visitors and search engines: the whole text (never clamped, so it is all in the
 * HTML), its photos or video, the counts, and a sign-up prompt in place of the like and comment buttons.
 */
export async function PublicPost({ post }: { post: FeedPost }) {
  const { t, f } = await getI18n();
  const name = post.company?.name ?? post.author.name;
  const profile = post.company ? `/companies/${post.company.slug}` : post.author.username ? `/in/${post.author.username}` : null;

  return (
    <div className="space-y-4">
      <article className="surface overflow-hidden">
        <header className="flex items-center gap-3 px-5 pt-5">
          {post.company ? <CompanyLogo name={post.company.name} src={post.company.logoUrl} color={post.company.brandColor} /> : <Avatar name={post.author.name} src={post.author.image} size="md" />}
          <div className="min-w-0">
            {profile ? (
              <Link href={profile} className="font-semibold hover:underline">
                {name}
              </Link>
            ) : (
              <span className="font-semibold">{name}</span>
            )}
            <div className="truncate text-xs text-fg-muted">{post.author.profile?.headline}</div>
            <time dateTime={post.createdAt.toISOString()} className="text-[11px] text-fg-subtle">
              {f.date(post.createdAt, { day: "numeric", month: "short", year: "numeric" })}
            </time>
          </div>
        </header>

        {post.content && <RichText text={post.content} clamp={100_000} className="px-5 pt-3" />}

        {post.mediaType === "VIDEO" && post.mediaUrls[0] ? (
          <video src={post.mediaUrls[0]} poster={post.thumbnailUrl ?? undefined} controls playsInline preload="none" className="mt-3 max-h-[640px] w-full bg-black" />
        ) : (
          post.mediaUrls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" loading="lazy" className="mt-3 max-h-[640px] w-full bg-surface-2 object-contain" />
          ))
        )}

        {post.job && (
          <Link href={`/jobs/${post.job.id}`} className="mx-5 mt-3 flex items-center gap-3 rounded-2xl border border-border bg-surface-2/60 p-3.5 transition hover:border-brand/40">
            <Briefcase className="size-5 text-brand-soft-fg" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{post.job.title}</span>
              <span className="text-xs text-fg-muted">{post.job.company.name}</span>
            </span>
            <span className="text-sm font-medium text-brand-soft-fg">{t("feed.publicViewJob")}</span>
          </Link>
        )}

        <footer className="mt-3 flex gap-4 border-t border-border px-5 py-3 text-sm text-fg-muted">
          <span className="inline-flex items-center gap-1.5">
            <Heart className="size-4" /> {t("feed.publicLikes", { n: post.likeCount })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MessageCircle className="size-4" /> {t("feed.publicComments", { n: post.commentCount })}
          </span>
        </footer>
      </article>

      <div className="surface p-5 text-center">
        <h2 className="font-semibold">{t("feed.publicJoinTitle")}</h2>
        <p className="mt-1 text-sm text-fg-muted">{t("feed.publicJoinBody", { name })}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/register" className={buttonClasses({ pill: true })}>
            {t("feed.publicSignUp")}
          </Link>
          <Link href={`/login?next=/feed/${post.id}`} className={buttonClasses({ variant: "outline", pill: true })}>
            {t("feed.publicSignIn")}
          </Link>
        </div>
      </div>
    </div>
  );
}
