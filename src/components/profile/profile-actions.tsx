"use client";

import { useI18n } from "@/i18n/client";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Bell, BellOff, Link2, MessageSquare, MoreHorizontal, Pencil, Globe } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { ConnectButton, type RelationState } from "@/components/network/connect-button";
import { toast } from "@/components/ui/toast";
import { copyText } from "@/lib/share";
import { toggleBlockAction, toggleFollowUserAction } from "@/server/actions/network";

export function ProfileActions({
  self,
  signedIn,
  user,
  relation,
  following,
  canMessage,
  portfolioUrl,
}: {
  self: boolean;
  signedIn: boolean;
  user: { id: string; name: string; username: string };
  relation: { state: RelationState; connectionId?: string };
  following: boolean;
  canMessage: boolean;
  portfolioUrl: string | null;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [isFollowing, setFollowing] = useOptimistic(following);
  const [, start] = useTransition();

  const copyLink = async () => {
    const url = `${window.location.origin}/in/${user.username}`;
    if (await copyText(url)) toast.success(t("profile.profileCopied"));
    else toast.error(t("common.copyFailed"), url);
  };

  if (self) {
    return (
      <div className="flex flex-wrap gap-2">
        <Link href="/profile/edit" className={buttonClasses({ pill: true })}>
          <Pencil /> {t("profile.editProfile")}
        </Link>
        {portfolioUrl && (
          <Link href={portfolioUrl} className={buttonClasses({ variant: "outline", pill: true })}>
            <Globe /> {t("profile.portfolio")}
          </Link>
        )}
        <Button variant="outline" pill onClick={copyLink}>
          <Link2 /> {t("common.share")}
        </Button>
      </div>
    );
  }
  if (!signedIn) {
    return (
      <div className="flex gap-2">
        <Link href={`/login?next=/in/${user.username}`} className={buttonClasses({ pill: true })}>
          {t("profile.signInConnect")}
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ConnectButton userId={user.id} name={user.name} state={relation.state} connectionId={relation.connectionId} size="md" />
      {canMessage && (
        <Link href={`/messages?to=${user.id}`} className={buttonClasses({ variant: "outline", pill: true })}>
          <MessageSquare /> {t("common.message")}
        </Link>
      )}
      <Button
        variant="ghost"
        pill
        onClick={() =>
          start(async () => {
            setFollowing(!isFollowing);
            const res = await toggleFollowUserAction(user.id);
            if (!res?.ok) toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
          })
        }
      >
        {isFollowing ? <BellOff /> : <Bell />}
        {isFollowing ? t("common.following") : t("common.follow")}
      </Button>
      <Menu>
        <MenuTrigger className="grid size-10 place-items-center rounded-full text-fg-muted hover:bg-surface-2" aria-label={t("common.more")}>
          <MoreHorizontal className="size-5" />
        </MenuTrigger>
        <MenuContent>
          <MenuItem icon={<Link2 />} onSelect={copyLink}>
            {t("profile.copyProfile")}
          </MenuItem>
          <MenuItem
            icon={<Ban />}
            danger
            onSelect={() =>
              start(async () => {
                const res = await toggleBlockAction(user.id);
                if (res?.ok) {
                  toast.success(res.message ?? t("common.saved"));
                  router.push("/network");
                } else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
              })
            }
          >
            {t("profile.block", { name: user.name.split(" ")[0]! })}
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}
