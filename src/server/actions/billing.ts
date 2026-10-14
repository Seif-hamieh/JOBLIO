"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, fail, withViewer, type ActionState } from "@/server/action";
import { LIMITS } from "@/server/rate-limit";
import { db } from "@/server/db";
import { billingPortalUrl, setCancelAtPeriodEnd, startCheckout } from "@/server/billing";
import { FREE_BOOST_DAYS, FREE_BOOST_INTERVAL_DAYS, isEligibleForFreeBoost } from "@/server/services/subscriptions";
import { PRODUCTS, type ProductCode } from "@/lib/billing/products";
import { getI18n } from "@/i18n/server";
import { k } from "@/i18n/message";

const productCode = z.enum(Object.keys(PRODUCTS) as [ProductCode, ...ProductCode[]]);

export async function checkoutAction(product: string, targetId?: string | null): Promise<ActionState<{ url: string }>> {
  return withViewer<{ url: string }>({ limit: LIMITS.checkout }, async (viewer) => {
    const code = productCode.parse(product);
    const url = await startCheckout(viewer, code, targetId ? z.string().max(40).parse(targetId) : null);
    revalidatePath("/settings/billing");
    return { ok: true, data: { url } };
  });
}

export async function cancelSubscriptionAction(subscriptionId: string, cancel: boolean): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    await setCancelAtPeriodEnd(viewer, z.string().max(40).parse(subscriptionId), !!cancel);
    revalidatePath("/settings/billing");
    return { ok: true, message: cancel ? "@msg.planEnds" : "@msg.planRenews" };
  });
}

export async function billingPortalAction(): Promise<ActionState<{ url: string }>> {
  return withViewer<{ url: string }>({ limit: LIMITS.checkout }, async (viewer) => {
    const url = await billingPortalUrl(viewer);
    return url ? { ok: true, data: { url } } : fail("@msg.paymentsOff");
  });
}

/** Job Seeker Pro: claim the monthly free 7-day Profile Boost. */
export async function claimFreeBoost(): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    const check = await isEligibleForFreeBoost(viewer.id);
    if (!check.eligible) {
      if (check.reason === "too_soon" && check.nextEligibleAt) {
        const { f } = await getI18n();
        return fail(k("profileEdit.freeBoostTooSoon", { date: f.date(check.nextEligibleAt, { month: "long", day: "numeric" }) }));
      }
      return fail(check.reason === "already_active" ? "@msg.freeBoostActive" : "@msg.freeBoostProOnly");
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + FREE_BOOST_DAYS * 86_400_000);
    const cutoff = new Date(now.getTime() - FREE_BOOST_INTERVAL_DAYS * 86_400_000);
    await db.$transaction(async (tx) => {
      // Claim first, with a single conditional UPDATE: a second, simultaneous click finds nothing to claim.
      const claimed = await tx.user.updateMany({
        where: { id: viewer.id, OR: [{ lastFreeBoostClaimedAt: null }, { lastFreeBoostClaimedAt: { lte: cutoff } }] },
        data: { lastFreeBoostClaimedAt: now },
      });
      if (!claimed.count) throw new ActionError("@msg.freeBoostActive");
      await tx.profileBoost.create({ data: { userId: viewer.id, product: "PROFILE_BOOST", startsAt: now, endsAt } });
      await tx.profile.update({ where: { userId: viewer.id }, data: { featuredUntil: endsAt } });
    });

    revalidatePath("/profile/views");
    revalidatePath("/premium");
    return { ok: true, message: "@profileEdit.freeBoostClaimed" };
  });
}
