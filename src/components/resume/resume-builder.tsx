"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Download, Plus, RotateCcw, Save, X } from "lucide-react";
import { resetResumeAction, saveResumeAction } from "@/server/actions/resume-builder";
import type { ResumeFields } from "@/server/services/resume-builder";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";

type Experience = ResumeFields["experience"][number];
type Education = ResumeFields["education"][number];

const newJob = (): Experience => ({ title: "", company: "", location: null, start: null, end: null, current: false, description: null });
const newSchool = (): Education => ({ school: "", degree: null, field: null, start: null, end: null, description: null });

/** The CV builder form: every part of the CV, saved together; "Download PDF" saves first, then downloads. */
export function ResumeBuilder({ initial, saved, updatedAt }: { initial: ResumeFields; saved: boolean; updatedAt: string | null }) {
  const { t, f } = useI18n();
  const router = useRouter();
  const [d, setD] = useState(initial);
  const [dirty, setDirty] = useState(!saved);
  const [lastSaved, setLastSaved] = useState(updatedAt);
  const [skill, setSkill] = useState("");
  const [pending, start] = useTransition();

  const set = <K extends keyof ResumeFields>(key: K, value: ResumeFields[K]) => {
    setD((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };
  const setItem = <K extends "experience" | "education" | "languages" | "links">(key: K, i: number, patch: Partial<ResumeFields[K][number]>) =>
    set(key, d[key].map((item, j) => (j === i ? { ...item, ...patch } : item)) as ResumeFields[K]);
  const removeItem = <K extends "experience" | "education" | "languages" | "links">(key: K, i: number) => set(key, d[key].filter((_, j) => j !== i) as ResumeFields[K]);
  const opt = (v: string) => v || null;

  async function save() {
    const res = await saveResumeAction(d);
    if (res?.ok) {
      setDirty(false);
      setLastSaved(res.data?.updatedAt ?? new Date().toISOString());
      return true;
    }
    toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
    return false;
  }

  function addSkill() {
    const s = skill.trim().slice(0, 60);
    if (s && !d.skills.includes(s) && d.skills.length < 60) set("skills", [...d.skills, s]);
    setSkill("");
  }

  return (
    <div className="space-y-6">
      <div className="surface sticky top-[calc(4rem+env(safe-area-inset-top))] z-30 flex flex-wrap items-center justify-between gap-3 p-3">
        <span className="text-sm text-fg-muted">
          {dirty ? (saved ? t("cvb.unsaved") : t("cvb.fromProfile")) : lastSaved && t("cvb.lastSaved", { date: f.date(new Date(lastSaved), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) })}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            pill
            loading={pending}
            onClick={() =>
              start(async () => {
                if (await save()) toast.success(t("msg.resumeSaved"));
              })
            }
          >
            <Save className="size-4" /> {t("cvb.save")}
          </Button>
          <Button
            pill
            disabled={pending}
            onClick={() =>
              start(async () => {
                if (dirty && !(await save())) return;
                // A file download, not a page: a plain link click lets the browser save it.
                const a = document.createElement("a");
                a.href = "/resume-builder/pdf";
                a.download = "";
                a.click();
              })
            }
          >
            <Download className="size-4" /> {t("cvb.download")}
          </Button>
        </div>
      </div>

      <Part title={t("cvb.personal")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label={t("cvb.fullName")}>
            <Input value={d.fullName} maxLength={120} onChange={(e) => set("fullName", e.target.value)} />
          </Labeled>
          <Labeled label={t("cvb.headline")}>
            <Input value={d.headline ?? ""} maxLength={160} placeholder={t("cvb.headlinePh")} onChange={(e) => set("headline", opt(e.target.value))} />
          </Labeled>
          <Labeled label={t("cvb.email")}>
            <Input type="email" dir="ltr" value={d.email ?? ""} maxLength={160} onChange={(e) => set("email", opt(e.target.value))} />
          </Labeled>
          <Labeled label={t("cvb.phone")}>
            <Input type="tel" dir="ltr" value={d.phone ?? ""} maxLength={40} onChange={(e) => set("phone", opt(e.target.value))} />
          </Labeled>
          <Labeled label={t("cvb.location")}>
            <Input value={d.location ?? ""} maxLength={120} onChange={(e) => set("location", opt(e.target.value))} />
          </Labeled>
        </div>
        <Labeled label={t("cvb.summary")}>
          <Textarea value={d.summary ?? ""} maxLength={3000} placeholder={t("cvb.summaryPh")} className="min-h-28" onChange={(e) => set("summary", opt(e.target.value))} />
        </Labeled>
      </Part>

      <Part title={t("cvb.experience")} add={{ label: t("cvb.addExperience"), onClick: () => set("experience", [...d.experience, newJob()]), disabled: d.experience.length >= 30 }}>
        {d.experience.map((e, i) => (
          <Item key={i} onRemove={() => removeItem("experience", i)} removeLabel={t("cvb.remove")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Labeled label={t("cvb.jobTitle")}>
                <Input value={e.title} maxLength={120} onChange={(ev) => setItem("experience", i, { title: ev.target.value })} />
              </Labeled>
              <Labeled label={t("cvb.company")}>
                <Input value={e.company} maxLength={120} onChange={(ev) => setItem("experience", i, { company: ev.target.value })} />
              </Labeled>
              <Labeled label={t("cvb.start")}>
                <Input value={e.start ?? ""} maxLength={30} placeholder={t("cvb.datePh")} onChange={(ev) => setItem("experience", i, { start: opt(ev.target.value) })} />
              </Labeled>
              <Labeled label={t("cvb.end")}>
                <Input value={e.current ? "" : (e.end ?? "")} maxLength={30} disabled={e.current} placeholder={t("cvb.datePh")} onChange={(ev) => setItem("experience", i, { end: opt(ev.target.value) })} />
              </Labeled>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={e.current} onChange={(ev) => setItem("experience", i, { current: ev.target.checked })} /> {t("cvb.current")}
            </label>
            <Labeled label={t("cvb.description")}>
              <Textarea value={e.description ?? ""} maxLength={3000} className="min-h-24" onChange={(ev) => setItem("experience", i, { description: opt(ev.target.value) })} />
            </Labeled>
          </Item>
        ))}
      </Part>

      <Part title={t("cvb.education")} add={{ label: t("cvb.addEducation"), onClick: () => set("education", [...d.education, newSchool()]), disabled: d.education.length >= 20 }}>
        {d.education.map((e, i) => (
          <Item key={i} onRemove={() => removeItem("education", i)} removeLabel={t("cvb.remove")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Labeled label={t("cvb.school")}>
                <Input value={e.school} maxLength={160} onChange={(ev) => setItem("education", i, { school: ev.target.value })} />
              </Labeled>
              <Labeled label={t("cvb.degree")}>
                <Input value={e.degree ?? ""} maxLength={120} onChange={(ev) => setItem("education", i, { degree: opt(ev.target.value) })} />
              </Labeled>
              <Labeled label={t("cvb.field")}>
                <Input value={e.field ?? ""} maxLength={120} onChange={(ev) => setItem("education", i, { field: opt(ev.target.value) })} />
              </Labeled>
              <div className="grid grid-cols-2 gap-3">
                <Labeled label={t("cvb.start")}>
                  <Input value={e.start ?? ""} maxLength={30} placeholder={t("cvb.datePh")} onChange={(ev) => setItem("education", i, { start: opt(ev.target.value) })} />
                </Labeled>
                <Labeled label={t("cvb.end")}>
                  <Input value={e.end ?? ""} maxLength={30} placeholder={t("cvb.datePh")} onChange={(ev) => setItem("education", i, { end: opt(ev.target.value) })} />
                </Labeled>
              </div>
            </div>
          </Item>
        ))}
      </Part>

      <Part title={t("cvb.skills")}>
        <div className="flex flex-wrap gap-2">
          {d.skills.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 py-1 pe-1.5 ps-3 text-sm">
              {s}
              <button type="button" aria-label={t("cvb.remove")} onClick={() => set("skills", d.skills.filter((x) => x !== s))} className="rounded-full p-0.5 text-fg-muted hover:text-fg">
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
        <Input
          value={skill}
          maxLength={60}
          placeholder={t("cvb.skillsPh")}
          onChange={(e) => setSkill(e.target.value)}
          onBlur={addSkill}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addSkill();
            }
          }}
        />
      </Part>

      <Part title={t("cvb.languages")} add={{ label: t("cvb.addLanguage"), onClick: () => set("languages", [...d.languages, { name: "", level: null }]), disabled: d.languages.length >= 20 }}>
        {d.languages.map((l, i) => (
          <div key={i} className="flex items-end gap-2">
            <Labeled label={t("cvb.language")} className="flex-1">
              <Input value={l.name} maxLength={60} onChange={(e) => setItem("languages", i, { name: e.target.value })} />
            </Labeled>
            <Labeled label={t("cvb.level")} className="flex-1">
              <Input value={l.level ?? ""} maxLength={60} onChange={(e) => setItem("languages", i, { level: opt(e.target.value) })} />
            </Labeled>
            <RemoveButton label={t("cvb.remove")} onClick={() => removeItem("languages", i)} />
          </div>
        ))}
      </Part>

      <Part title={t("cvb.links")} add={{ label: t("cvb.addLink"), onClick: () => set("links", [...d.links, { label: "", url: "" }]), disabled: d.links.length >= 10 }}>
        {d.links.map((l, i) => (
          <div key={i} className="flex items-end gap-2">
            <Labeled label={t("cvb.linkLabel")} className="w-40">
              <Input value={l.label} maxLength={60} onChange={(e) => setItem("links", i, { label: e.target.value })} />
            </Labeled>
            <Labeled label={t("cvb.linkUrl")} className="flex-1">
              <Input dir="ltr" value={l.url} maxLength={300} placeholder="https://" onChange={(e) => setItem("links", i, { url: e.target.value })} />
            </Labeled>
            <RemoveButton label={t("cvb.remove")} onClick={() => removeItem("links", i)} />
          </div>
        ))}
      </Part>

      <div className="flex justify-center pb-6">
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (!confirm(t("cvb.resetConfirm"))) return;
            start(async () => {
              await resetResumeAction();
              router.refresh();
              window.location.reload();
            });
          }}
        >
          <RotateCcw className="size-4" /> {t("cvb.reset")}
        </Button>
      </div>
    </div>
  );
}

function Part({ title, children, add }: { title: string; children: ReactNode; add?: { label: string; onClick: () => void; disabled?: boolean } }) {
  return (
    <section className="surface space-y-4 p-5">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {children}
      {add && (
        <Button type="button" variant="outline" size="sm" pill onClick={add.onClick} disabled={add.disabled}>
          <Plus className="size-4" /> {add.label}
        </Button>
      )}
    </section>
  );
}

function Item({ children, onRemove, removeLabel }: { children: ReactNode; onRemove: () => void; removeLabel: string }) {
  return (
    <div className="relative space-y-3 rounded-2xl border border-border p-4 pe-12">
      <div className="absolute end-2 top-2">
        <RemoveButton label={removeLabel} onClick={onRemove} />
      </div>
      {children}
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="grid size-10 shrink-0 place-items-center rounded-full text-fg-muted transition hover:bg-danger-soft hover:text-danger-fg">
      <X className="size-4" />
    </button>
  );
}

function Labeled({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block space-y-1.5 ${className ?? ""}`}>
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
