"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { Award, Briefcase, GraduationCap, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import {
  deleteCertificateAction,
  deleteEducationAction,
  deleteExperienceAction,
  setLanguagesAction,
  setSocialLinksAction,
  upsertCertificateAction,
  upsertEducationAction,
  upsertExperienceAction,
} from "@/server/actions/profile";
import {
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  LANGUAGE_PROFICIENCIES,
  SOCIAL_PLATFORMS,
  WORK_MODES,
  type EducationLevel,
  type EmploymentType,
  type LanguageProficiency,
  type SocialPlatform,
  type WorkMode,
} from "@/lib/constants";
import { LANGUAGES } from "@/lib/geo";
import { useI18n } from "@/i18n/client";

type Result = { ok: boolean; message?: string; error?: string; fieldErrors?: Record<string, string[] | undefined> } | null;

const month = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 7) : "");

function useRun() {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const run = (fn: () => Promise<Result>, onOk?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res?.ok) {
        setErrors({});
        toast.success(res.message ?? t("common.saved"));
        onOk?.();
        router.refresh();
      } else {
        setErrors(res?.fieldErrors ?? {});
        toast.error(res?.error ?? t("common.somethingWrong"));
      }
    });
  return { pending, errors, run };
}

function Row({ icon, title, subtitle, meta, onEdit, onDelete }: { icon: React.ReactNode; title: string; subtitle?: string | null; meta?: string; onEdit: () => void; onDelete: () => void }) {
  const { t } = useI18n();
  return (
    <m.li layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="group flex items-start gap-3 rounded-2xl border border-border bg-surface p-3.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-fg-muted [&_svg]:size-5">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{title}</div>
        {subtitle && <div className="text-sm text-fg-muted">{subtitle}</div>}
        {meta && <div className="text-xs text-fg-subtle">{meta}</div>}
      </div>
      <div className="flex gap-1 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
        <Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label={`${t("common.edit")} ${title}`}>
          <Pencil />
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={onDelete} aria-label={`${t("common.delete")} ${title}`}>
          <Trash2 />
        </Button>
      </div>
    </m.li>
  );
}

// ── Experience ───────────────────────────────────────────────────────────

export type ExperienceItem = {
  id: string;
  title: string;
  companyName: string;
  employmentType: EmploymentType;
  workMode: WorkMode | null;
  location: string | null;
  startDate: Date;
  endDate: Date | null;
  isCurrent: boolean;
  description: string | null;
};

const emptyExp = { title: "", companyName: "", employmentType: "FULL_TIME" as EmploymentType, workMode: "" as WorkMode | "", location: "", startDate: "", endDate: "", isCurrent: false, description: "" };

export function ExperienceManager({ items }: { items: ExperienceItem[] }) {
  const { t, f } = useI18n();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [v, setV] = useState(emptyExp);
  const { pending, errors, run } = useRun();
  const edit = (e?: ExperienceItem) => {
    setEditId(e?.id);
    setV(
      e
        ? { title: e.title, companyName: e.companyName, employmentType: e.employmentType, workMode: e.workMode ?? "", location: e.location ?? "", startDate: month(e.startDate), endDate: month(e.endDate), isCurrent: e.isCurrent, description: e.description ?? "" }
        : emptyExp,
    );
    setOpen(true);
  };
  return (
    <div>
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {items.map((e) => (
            <Row
              key={e.id}
              icon={<Briefcase />}
              title={e.title}
              subtitle={`${e.companyName} · ${t(`enums.employmentType.${e.employmentType}`)}`}
              meta={`${f.date(e.startDate)} – ${e.isCurrent ? t("profile.present") : f.date(e.endDate)}`}
              onEdit={() => edit(e)}
              onDelete={() => run(() => deleteExperienceAction(e.id))}
            />
          ))}
        </AnimatePresence>
      </ul>
      <Button variant="soft" className="mt-3" onClick={() => edit()}>
        <Plus /> {t("profileEdit.addExperience")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={editId ? t("profileEdit.editExperience") : t("profileEdit.addExperience")}
        size="lg"
        footer={
          <Button loading={pending} onClick={() => run(() => upsertExperienceAction({ ...v, id: editId, workMode: v.workMode || null }), () => setOpen(false))}>
            {t("common.save")}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("profileEdit.jobTitle")} error={errors.title}>
            {(p) => <Input {...p} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={100} />}
          </Field>
          <Field label={t("profileEdit.company")} error={errors.companyName}>
            {(p) => <Input {...p} value={v.companyName} onChange={(e) => setV({ ...v, companyName: e.target.value })} maxLength={100} />}
          </Field>
          <Field label={t("profileEdit.employmentType")}>
            {(p) => (
              <Select {...p} value={v.employmentType} onChange={(e) => setV({ ...v, employmentType: e.target.value as EmploymentType })}>
                {EMPLOYMENT_TYPES.map((et) => (
                  <option key={et} value={et}>
                    {t(`enums.employmentType.${et}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t("profileEdit.workMode")} optional>
            {(p) => (
              <Select {...p} value={v.workMode} onChange={(e) => setV({ ...v, workMode: e.target.value as WorkMode | "" })}>
                <option value="">—</option>
                {WORK_MODES.map((wm) => (
                  <option key={wm} value={wm}>
                    {t(`enums.workMode.${wm}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t("profileEdit.start")} error={errors.startDate}>
            {(p) => <Input {...p} type="month" value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value })} />}
          </Field>
          <Field label={t("profileEdit.end")} error={errors.endDate}>
            {(p) => <Input {...p} type="month" value={v.endDate} disabled={v.isCurrent} onChange={(e) => setV({ ...v, endDate: e.target.value })} />}
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={v.isCurrent} onChange={(e) => setV({ ...v, isCurrent: e.target.checked, endDate: e.target.checked ? "" : v.endDate })} className="size-4 accent-[var(--brand)]" />
            {t("profileEdit.currentRole")}
          </label>
          <Field label={t("profileEdit.location")} optional className="sm:col-span-2">
            {(p) => <Input {...p} value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} maxLength={80} />}
          </Field>
          <Field label={t("profileEdit.description")} optional className="sm:col-span-2" error={errors.description}>
            {(p) => <Textarea {...p} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} maxLength={2000} placeholder={t("profileEdit.descriptionPh")} />}
          </Field>
        </div>
      </Dialog>
    </div>
  );
}

// ── Education ────────────────────────────────────────────────────────────

export type EducationItem = { id: string; school: string; degree: string | null; fieldOfStudy: string | null; level: EducationLevel; startDate: Date | null; endDate: Date | null; grade: string | null };
const emptyEdu = { school: "", degree: "", fieldOfStudy: "", level: "BACHELOR" as EducationLevel, startDate: "", endDate: "", grade: "" };

export function EducationManager({ items }: { items: EducationItem[] }) {
  const { t, f } = useI18n();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [v, setV] = useState(emptyEdu);
  const { pending, errors, run } = useRun();
  const edit = (e?: EducationItem) => {
    setEditId(e?.id);
    setV(e ? { school: e.school, degree: e.degree ?? "", fieldOfStudy: e.fieldOfStudy ?? "", level: e.level, startDate: month(e.startDate), endDate: month(e.endDate), grade: e.grade ?? "" } : emptyEdu);
    setOpen(true);
  };
  return (
    <div>
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {items.map((e) => (
            <Row
              key={e.id}
              icon={<GraduationCap />}
              title={e.school}
              subtitle={[e.degree, e.fieldOfStudy].filter(Boolean).join(", ") || t(`enums.educationLevel.${e.level}`)}
              meta={[e.startDate && f.date(e.startDate, { year: "numeric" }), e.endDate && f.date(e.endDate, { year: "numeric" })].filter(Boolean).join(" – ")}
              onEdit={() => edit(e)}
              onDelete={() => run(() => deleteEducationAction(e.id))}
            />
          ))}
        </AnimatePresence>
      </ul>
      <Button variant="soft" className="mt-3" onClick={() => edit()}>
        <Plus /> {t("profileEdit.addEducation")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={editId ? t("profileEdit.editEducation") : t("profileEdit.addEducation")}
        size="lg"
        footer={
          <Button loading={pending} onClick={() => run(() => upsertEducationAction({ ...v, id: editId }), () => setOpen(false))}>
            {t("common.save")}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("profileEdit.school")} className="sm:col-span-2" error={errors.school}>
            {(p) => <Input {...p} value={v.school} onChange={(e) => setV({ ...v, school: e.target.value })} maxLength={120} />}
          </Field>
          <Field label={t("profileEdit.degree")} optional>
            {(p) => <Input {...p} value={v.degree} onChange={(e) => setV({ ...v, degree: e.target.value })} maxLength={80} placeholder="BSc, MA…" />}
          </Field>
          <Field label={t("profileEdit.field")} optional>
            {(p) => <Input {...p} value={v.fieldOfStudy} onChange={(e) => setV({ ...v, fieldOfStudy: e.target.value })} maxLength={100} />}
          </Field>
          <Field label={t("profileEdit.level")} hint={t("profileEdit.levelHint")}>
            {(p) => (
              <Select {...p} value={v.level} onChange={(e) => setV({ ...v, level: e.target.value as EducationLevel })}>
                {EDUCATION_LEVELS.filter((l) => l !== "NONE").map((l) => (
                  <option key={l} value={l}>
                    {t(`enums.educationLevel.${l}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t("profileEdit.grade")} optional>
            {(p) => <Input {...p} value={v.grade} onChange={(e) => setV({ ...v, grade: e.target.value })} maxLength={40} />}
          </Field>
          <Field label={t("profileEdit.start")} optional>
            {(p) => <Input {...p} type="month" value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value })} />}
          </Field>
          <Field label={t("profileEdit.endExpected")} optional>
            {(p) => <Input {...p} type="month" value={v.endDate} onChange={(e) => setV({ ...v, endDate: e.target.value })} />}
          </Field>
        </div>
      </Dialog>
    </div>
  );
}

// ── Certificates ─────────────────────────────────────────────────────────

export type CertificateItem = { id: string; name: string; issuer: string; issueDate: Date | null; expiryDate: Date | null; credentialId: string | null; credentialUrl: string | null };
const emptyCert = { name: "", issuer: "", issueDate: "", expiryDate: "", credentialId: "", credentialUrl: "" };

export function CertificateManager({ items }: { items: CertificateItem[] }) {
  const { t, f } = useI18n();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [v, setV] = useState(emptyCert);
  const { pending, errors, run } = useRun();
  const edit = (c?: CertificateItem) => {
    setEditId(c?.id);
    setV(c ? { name: c.name, issuer: c.issuer, issueDate: month(c.issueDate), expiryDate: month(c.expiryDate), credentialId: c.credentialId ?? "", credentialUrl: c.credentialUrl ?? "" } : emptyCert);
    setOpen(true);
  };
  return (
    <div>
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {items.map((c) => (
            <Row key={c.id} icon={<Award />} title={c.name} subtitle={c.issuer} meta={c.issueDate ? t("profile.issued", { date: f.date(c.issueDate) }) : undefined} onEdit={() => edit(c)} onDelete={() => run(() => deleteCertificateAction(c.id))} />
          ))}
        </AnimatePresence>
      </ul>
      <Button variant="soft" className="mt-3" onClick={() => edit()}>
        <Plus /> {t("profileEdit.addCert")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={editId ? t("profileEdit.editCert") : t("profileEdit.addCert")}
        footer={
          <Button loading={pending} onClick={() => run(() => upsertCertificateAction({ ...v, id: editId }), () => setOpen(false))}>
            {t("common.save")}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("profileEdit.certName")} className="sm:col-span-2" error={errors.name}>
            {(p) => <Input {...p} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={120} />}
          </Field>
          <Field label={t("profileEdit.issuer")} className="sm:col-span-2" error={errors.issuer}>
            {(p) => <Input {...p} value={v.issuer} onChange={(e) => setV({ ...v, issuer: e.target.value })} maxLength={120} />}
          </Field>
          <Field label={t("profileEdit.issued")} optional>
            {(p) => <Input {...p} type="month" value={v.issueDate} onChange={(e) => setV({ ...v, issueDate: e.target.value })} />}
          </Field>
          <Field label={t("profileEdit.expires")} optional>
            {(p) => <Input {...p} type="month" value={v.expiryDate} onChange={(e) => setV({ ...v, expiryDate: e.target.value })} />}
          </Field>
          <Field label={t("profileEdit.credentialId")} optional>
            {(p) => <Input {...p} value={v.credentialId} onChange={(e) => setV({ ...v, credentialId: e.target.value })} maxLength={80} />}
          </Field>
          <Field label={t("profileEdit.credentialUrl")} optional error={errors.credentialUrl}>
            {(p) => <Input {...p} type="url" value={v.credentialUrl} onChange={(e) => setV({ ...v, credentialUrl: e.target.value })} placeholder="https://" />}
          </Field>
        </div>
      </Dialog>
    </div>
  );
}

// ── Languages ────────────────────────────────────────────────────────────

export function LanguagesForm({ initial }: { initial: { languageCode: string; proficiency: LanguageProficiency }[] }) {
  const { t, f } = useI18n();
  const [list, setList] = useState(initial);
  const [code, setCode] = useState("");
  const { pending, run } = useRun();
  return (
    <div>
      <ul className="space-y-2">
        {list.map((l, i) => (
          <li key={l.languageCode} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-2">
            <span className="flex-1 text-sm font-medium">{f.language(l.languageCode)}</span>
            <select
              value={l.proficiency}
              onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, proficiency: e.target.value as LanguageProficiency } : x)))}
              className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
              aria-label={f.language(l.languageCode)}
            >
              {LANGUAGE_PROFICIENCIES.map((p) => (
                <option key={p} value={p}>
                  {t(`enums.proficiency.${p}`)}
                </option>
              ))}
            </select>
            <button onClick={() => setList(list.filter((_, j) => j !== i))} className="rounded-full p-1 text-fg-subtle hover:bg-surface-2" aria-label={t("common.remove")}>
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <Select value={code} onChange={(e) => setCode(e.target.value)} aria-label={t("profileEdit.addLanguage")}>
          <option value="">{t("profileEdit.addLanguage")}</option>
          {LANGUAGES.filter((l) => !list.some((x) => x.languageCode === l.code)).map((l) => ({ code: l.code, name: f.language(l.code) })).sort((a, b) => a.name.localeCompare(b.name, f.locale)).map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </Select>
        <Button
          variant="soft"
          disabled={!code}
          onClick={() => {
            setList([...list, { languageCode: code, proficiency: "PROFESSIONAL" }]);
            setCode("");
          }}
        >
          <Plus /> {t("common.add")}
        </Button>
      </div>
      <div className="mt-4 flex justify-end">
        <Button loading={pending} onClick={() => run(() => setLanguagesAction(list))}>
          {t("profileEdit.saveLanguages")}
        </Button>
      </div>
    </div>
  );
}

// ── Social links ─────────────────────────────────────────────────────────

export function LinksForm({ initial }: { initial: { platform: string; url: string }[] }) {
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(initial.map((l) => [l.platform, l.url])));
  const { t } = useI18n();
  const { pending, errors, run } = useRun();
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {SOCIAL_PLATFORMS.map((p) => (
          <Field key={p} label={t(`enums.social.${p}`)} optional>
            {(fp) => <Input {...fp} type="url" value={values[p] ?? ""} onChange={(e) => setValues({ ...values, [p]: e.target.value })} placeholder="https://" />}
          </Field>
        ))}
      </div>
      {Object.keys(errors).length > 0 && <p className="mt-2 text-xs text-danger-fg">{t("profileEdit.linksError")}</p>}
      <div className="mt-4 flex justify-end">
        <Button
          loading={pending}
          onClick={() =>
            run(() =>
              setSocialLinksAction(
                Object.entries(values)
                  .filter(([, url]) => url.trim())
                  .map(([platform, url]) => ({ platform: platform as SocialPlatform, url: url.trim() })),
              ),
            )
          }
        >
          {t("profileEdit.saveLinks")}
        </Button>
      </div>
    </div>
  );
}
