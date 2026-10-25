"use server";

import { parse, withViewer, type ActionState } from "@/server/action";
import { onboardingSchema, type OnboardingInput } from "@/lib/validation/profile";
import { completeOnboardingFor } from "@/server/services/onboarding";

export async function completeOnboarding(input: OnboardingInput): Promise<ActionState> {
  return withViewer({ limit: { key: "onboarding", max: 10, windowMs: 60_000 } }, async (viewer) => {
    const parsed = parse(onboardingSchema, input);
    if (!parsed.success) return parsed.state;
    // The rules live in services/onboarding (shared with the mobile app); a refusal there becomes the action's error.
    await completeOnboardingFor({ id: viewer.id, profileId: viewer.profileId, hasCompany: !!viewer.company }, parsed.data);
    return { ok: true };
  });
}
