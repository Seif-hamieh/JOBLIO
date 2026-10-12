"use client";

import { useI18n } from "@/i18n/client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Newspaper } from "lucide-react";
import type { FeedPost } from "@/server/services/feed";
import { loadMoreFeedAction } from "@/server/actions/feed";
import { PostCard } from "@/components/feed/post-card";
import { EmptyState } from "@/components/ui/misc";
import { Spinner } from "@/components/ui/spinner";

/** Feed with infinite scroll (IntersectionObserver + cursor pagination). */
export function FeedList({
  initial,
  nextCursor: initialCursor,
  viewer,
  scope,
  emptyTitle,
  emptyDescription,
}: {
  initial: FeedPost[];
  nextCursor: string | null;
  viewer: { id: string; name: string; image: string | null };
  scope?: { authorId?: string; companyId?: string; networkOnly?: boolean };
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const { t } = useI18n();
  const [posts, setPosts] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [pending, start] = useTransition();
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPosts(initial);
    setCursor(initialCursor);
  }, [initial, initialCursor]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !pending && cursor) {
          start(async () => {
            const res = await loadMoreFeedAction(cursor, scope);
            setPosts((p) => [...p, ...res.posts.filter((n) => !p.some((x) => x.id === n.id))]);
            setCursor(res.nextCursor);
          });
        }
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, pending, scope]);

  if (posts.length === 0) return <EmptyState icon={<Newspaper />} title={emptyTitle ?? t("feed.quietTitle")} description={emptyDescription ?? t("feed.quietBody")} />;

  return (
    <div className="space-y-4">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} viewer={viewer} />
      ))}
      <div ref={sentinel} className="flex justify-center py-4 text-fg-subtle">
        {pending ? <Spinner /> : !cursor && <span className="text-xs">{t("common.caughtUp")}</span>}
      </div>
    </div>
  );
}
