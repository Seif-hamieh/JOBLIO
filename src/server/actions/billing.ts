"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, withViewer, type ActionState } from "@/server/action";
import { LIMITS } from "@/server/rate-limit";
import { billingPortalUrl, setCancelAtPeriodEnd, startCheckout } from "@/server/billing";
import { PRODUCTS, type ProductCode } from "@/lib/billing/products";

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
    return url ? { ok: true, data: { url } } : fail("@msg.stripeOff");
  });
}
