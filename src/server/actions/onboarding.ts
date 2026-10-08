"use server";

import { db } from "@/server/db";
import { fail, parse, withViewer, type ActionState } from "@/server/action";
import { onboardingSchema, type OnboardingInput } from "@/lib/validation/profile";
import { createCompanyForUser } from "@/server/services/companies";
import { refreshProfileDerived } from "@/server/services/profile";

export async function completeOnboarding(input: OnboardingInput): Promise<ActionState> {
  return withViewer({ limit: { key: "onboarding", max: 10, windowMs: 60_000 } }, async (viewer) => {
    const parsed = parse(onboardingSchema, input);
    if (!parsed.success) return parsed.state;
    const data = parsed.data;

    const hiring = data.intent !== "SEEKER";
    if (data.intent === "RECRUITER" && !viewer.company && !data.company) {
      return fail("@msg.addCompany");
    }

    // Only accept skills that exist in the taxonomy.
    const validSkills = await db.skill.findMany({ where: { id: { in: data.skills.map((s) => s.skillId) } }, select: { id: true } });
    const valid = new Set(validSkills.map((s) => s.id));
    const skills = data.skills.filter((s, i, arr) => valid.has(s.skillId) && arr.findIndex((x) => x.skillId === s.skillId) === i);

    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: viewer.id }, data: { intent: data.intent, onboardedAt: new Date() } });
      const p = data.preferences;
      await tx.profile.update({
        where: { id: viewer.profileId },
        data: {
          headline: data.headline,
          city: data.city,
          countryCode: data.countryCode,
          ...(p && {
            openToWork: p.openToWork,
            availability: p.availability,
            desiredTitles: p.desiredTitles,
            preferredWorkModes: p.preferredWorkModes,
            preferredEmploymentTypes: p.preferredEmploymentTypes,
            preferredCities: p.preferredCities.map((c) => c.toLowerCase()),
            openToRelocate: p.openToRelocate,
            desiredSalaryMin: p.desiredSalaryMin,
            salaryCurrency: p.salaryCurrency,
            salaryPeriod: p.salaryPeriod,
            preferredIndustries: { set: p.industryIds.map((id) => ({ id })) },
          }),
        },
      });
      if (skills.length) {
        await tx.userSkill.deleteMany({ where: { profileId: viewer.profileId } });
        await tx.userSkill.createMany({
          data: skills.map((s, position) => ({ profileId: viewer.profileId, skillId: s.skillId, level: s.level, position, isTop: position < 3 })),
        });
      }
      if (hiring && data.company && !viewer.company) {
        await createCompanyForUser(viewer.id, data.company, tx);
      }
    });
    await refreshProfileDerived(viewer.profileId);
    return { ok: true };
  });
}
