import "server-only";
import type { z } from "zod";
import { db } from "@/server/db";
import { ActionError } from "@/server/action";
import { createCompanyForUser } from "@/server/services/companies";
import { refreshProfileDerived } from "@/server/services/profile";
import type { onboardingSchema } from "@/lib/validation/profile";

// The first-run setup (intent, headline, place, first skills, preferences, company), shared by the website's
// onboarding page and the mobile app. Input is validated with onboardingSchema first.

export async function completeOnboardingFor(member: { id: string; profileId: string; hasCompany: boolean }, data: z.output<typeof onboardingSchema>) {
  const hiring = data.intent !== "SEEKER";
  if (data.intent === "RECRUITER" && !member.hasCompany && !data.company) throw new ActionError("@msg.addCompany");

  // Only accept skills that exist in the taxonomy.
  const validSkills = await db.skill.findMany({ where: { id: { in: data.skills.map((s) => s.skillId) } }, select: { id: true } });
  const valid = new Set(validSkills.map((s) => s.id));
  const skills = data.skills.filter((s, i, arr) => valid.has(s.skillId) && arr.findIndex((x) => x.skillId === s.skillId) === i);

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: member.id }, data: { intent: data.intent, onboardedAt: new Date() } });
    const p = data.preferences;
    await tx.profile.update({
      where: { id: member.profileId },
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
      await tx.userSkill.deleteMany({ where: { profileId: member.profileId } });
      await tx.userSkill.createMany({
        data: skills.map((s, position) => ({ profileId: member.profileId, skillId: s.skillId, level: s.level, position, isTop: position < 3 })),
      });
    }
    if (hiring && data.company && !member.hasCompany) {
      await createCompanyForUser(member.id, data.company, tx);
    }
  });
  await refreshProfileDerived(member.profileId);
}
