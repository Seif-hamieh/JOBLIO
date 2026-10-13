"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Crown, ImagePlus, Lock, Trash2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { TagInput } from "@/components/ui/tag-input";
import { toast } from "@/components/ui/toast";
import { CompanyLogo } from "@/components/ui/avatar";
import { MediaThumb, type MediaItem } from "@/components/companies/gallery";
import { addCompanyVideoAction, deleteCompanyMediaAction, updateCompanyAction, uploadCompanyImageAction } from "@/server/actions/companies";
import { COMPANY_SIZES, type CompanySize } from "@/lib/constants";
import { useI18n } from "@/i18n/client";
import { acceptFor, checkUpload } from "@/lib/upload-check";
import { parseVideoUrl } from "@/lib/video";
import { localizedCountries } from "@/i18n/countries";
import { industryName } from "@/i18n/translate";

export type CompanyEditorValue = {
  name: string;
  tagline: string;
  about: string;
  website: string;
  industryId: string;
  size: CompanySize;
  foundedYear: number | null;
  city: string;
  countryCode: string;
  benefits: string[];
  values: string[];
  cultureText: string;
  brandColor: string;
};

export function CompanyEditor({
  companyId,
  initial,
  industries,
  premium,
  logoUrl,
  coverUrl,
  media,
  canManage,
}: {
  companyId: string;
  initial: CompanyEditorValue;
  industries: { id: string; name: string }[];
  premium: boolean;
  logoUrl: string | null;
  coverUrl: string | null;
  media: MediaItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { t, f } = useI18n();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();
  const [uploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const kindRef = useRef<"logo" | "cover" | "media">("logo");
  const set = <K extends keyof CompanyEditorValue>(k: K, val: CompanyEditorValue[K]) => setV((x) => ({ ...x, [k]: val }));

  const upload = (file: File) => {
    if (fileRef.current) fileRef.current.value = "";
    const problem = checkUpload(file, "image", t);
    if (problem) return toast.error(problem);
    startUpload(async () => {
      const fd = new FormData();
      fd.set("kind", kindRef.current);
      fd.set("file", file);
      const res = await uploadCompanyImageAction(fd).catch(() => null);
      if (res?.ok) {
        toast.success(res.message ?? t("common.saved"));
        router.refresh();
      } else toast.error(res && !res.ok ? res.error : t("msg.uploadFailed"));
    });
  };
  const [videoUrl, setVideoUrl] = useState("");
  const [videoError, setVideoError] = useState<string | null>(null);
  const [addingVideo, startVideo] = useTransition();
  const addVideo = () => {
    if (!videoUrl.trim()) return;
    // Say what's wrong right under the field (a toast alone is easy to miss).
    if (!parseVideoUrl(videoUrl)) return setVideoError(t("msg.videoInvalid"));
    startVideo(async () => {
      const res = await addCompanyVideoAction({ url: videoUrl }).catch(() => null);
      if (res?.ok) {
        setVideoUrl("");
        setVideoError(null);
        toast.success(res.message ?? t("common.saved"));
        router.refresh();
      } else setVideoError(res && !res.ok ? res.error : t("common.somethingWrong"));
    });
  };
  const pick = (kind: "logo" | "cover" | "media") => {
    kindRef.current = kind;
    fileRef.current?.click();
  };

  if (!canManage) return <p className="text-sm text-fg-muted">{t("companyDash.onlyAdmins")}</p>;

  return (
    <div className="space-y-6">
      <input ref={fileRef} type="file" accept={acceptFor("image")} className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <div className="relative h-36 overflow-hidden rounded-2xl bg-gradient-to-r from-brand to-aurora bg-cover bg-center rtl:bg-gradient-to-l" style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}>
        <Button size="sm" variant="outline" className="absolute bottom-3 end-3" loading={uploading} onClick={() => pick("cover")}>
          <ImagePlus /> {t("companyDash.cover")}
        </Button>
      </div>
      <div className="flex items-center gap-4">
        <CompanyLogo name={v.name} src={logoUrl} color={v.brandColor || null} size="xl" />
        <Button size="sm" variant="outline" loading={uploading} onClick={() => pick("logo")}>
          <ImagePlus /> {t("companyDash.uploadLogo")}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("onboarding.companyName")} error={errors.name}>
          {(p) => <Input {...p} value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={80} />}
        </Field>
        <Field label={t("onboarding.website")} optional error={errors.website}>
          {(p) => <Input {...p} type="url" value={v.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" />}
        </Field>
      </div>
      <Field label={t("recruiter.tagline")} optional>
        {(p) => <Input {...p} value={v.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={160} />}
      </Field>
      <Field label={t("companies.about")} optional>
        {(p) => <Textarea {...p} value={v.about} onChange={(e) => set("about", e.target.value)} maxLength={4000} className="min-h-36" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("onboarding.industry")}>
          {(p) => (
            <Select {...p} value={v.industryId} onChange={(e) => set("industryId", e.target.value)}>
              <option value="">{t("common.select")}</option>
              {industries.map((i) => (
                <option key={i.id} value={i.id}>
                  {industryName(t, i.name)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("onboarding.size")}>
          {(p) => (
            <Select {...p} value={v.size} onChange={(e) => set("size", e.target.value as CompanySize)}>
              {COMPANY_SIZES.map((s) => (
                <option key={s} value={s}>
                  {t(`enums.companySize.${s}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("companyDash.founded")} optional>
          {(p) => <Input {...p} type="number" min={1800} max={2100} value={v.foundedYear ?? ""} onChange={(e) => set("foundedYear", e.target.value ? Number(e.target.value) : null)} />}
        </Field>
        <Field label={t("onboarding.city")} optional>
          {(p) => <Input {...p} value={v.city} onChange={(e) => set("city", e.target.value)} maxLength={60} />}
        </Field>
        <Field label={t("onboarding.country")} optional>
          {(p) => (
            <Select {...p} value={v.countryCode} onChange={(e) => set("countryCode", e.target.value)}>
              <option value="">{t("common.select")}</option>
              {localizedCountries(f).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={<span className="inline-flex items-center gap-1">{t("companyDash.brandColor")} {!premium && <Lock className="size-3" />}</span>} hint={premium ? t("companyDash.brandHint") : t("companyDash.premiumPage")}>
          {(p) => (
            <div className="flex gap-2">
              <input type="color" value={v.brandColor || "#5b46e5"} disabled={!premium} onChange={(e) => set("brandColor", e.target.value)} className="h-11 w-14 cursor-pointer rounded-xl border border-border bg-surface disabled:cursor-not-allowed disabled:opacity-50" aria-label={t("companyDash.brandColor")} />
              <Input {...p} value={v.brandColor} disabled={!premium} onChange={(e) => set("brandColor", e.target.value)} placeholder="#5b46e5" maxLength={7} />
            </div>
          )}
        </Field>
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-surface-2/40 p-5">
        <h3 className="font-display font-semibold">{t("companies.lifeAt", { company: v.name || "…" })}</h3>
        <Field label={t("companyDash.culture")} optional>
          {(p) => <Textarea {...p} value={v.cultureText} onChange={(e) => set("cultureText", e.target.value)} maxLength={3000} placeholder={t("companyDash.culturePh")} />}
        </Field>
        <Field label={t("companyDash.values")} hint={t("companyDash.valuesHint")}>
          {(p) => <TagInput id={p.id} value={v.values} onChange={(x) => set("values", x)} max={10} maxLength={40} />}
        </Field>
        <Field label={t("companies.benefits")} hint={t("companyDash.benefitsHint")}>
          {(p) => <TagInput id={p.id} value={v.benefits} onChange={(x) => set("benefits", x)} max={20} />}
        </Field>
        <div>
          <div className="mb-2 flex items-center justify-between text-[13px] font-medium">
            <span>{t("companyDash.photos", { n: media.length, max: premium ? 30 : 6 })}</span>
            <Button size="xs" variant="soft" loading={uploading} onClick={() => pick("media")}>
              <ImagePlus /> {t("companyDash.addPhoto")}
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {media.map((m) => (
              <div key={m.id} className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-3">
                <MediaThumb item={m} />
                <button
                  type="button"
                  onClick={() =>
                    start(async () => {
                      await deleteCompanyMediaAction(m.id);
                      router.refresh();
                    })
                  }
                  className="absolute end-1.5 top-1.5 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
                  aria-label={t("common.remove")}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              type="url"
              value={videoUrl}
              onChange={(e) => {
                setVideoUrl(e.target.value);
                setVideoError(null);
              }}
              aria-invalid={!!videoError || undefined}
              aria-describedby="company-video-help"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addVideo();
                }
              }}
              placeholder={t("companyDash.videoPh")}
              aria-label={t("companyDash.addVideo")}
              dir="ltr"
            />
            <Button variant="soft" loading={addingVideo} disabled={!videoUrl.trim()} onClick={addVideo} className="shrink-0">
              <Video /> {t("companyDash.addVideo")}
            </Button>
          </div>
          {videoError ? (
            <p id="company-video-help" role="alert" className="mt-1.5 text-xs font-medium text-danger-fg">
              {videoError}
            </p>
          ) : (
            <p id="company-video-help" className="mt-1.5 text-xs text-fg-subtle">
              {t("companyDash.videoHint")}
            </p>
          )}
          {!premium && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-ember-fg">
              <Crown className="size-3" /> {t("companyDash.premiumPhotos")}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await updateCompanyAction(companyId, { ...v, industryId: v.industryId || null, countryCode: v.countryCode || null, brandColor: v.brandColor || null });
              if (res?.ok) {
                toast.success(res.message ?? t("common.saved"));
                router.refresh();
              } else {
                setErrors(res && !res.ok ? (res.fieldErrors ?? {}) : {});
                toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
              }
            })
          }
        >
          {t("companyDash.savePage")}
        </Button>
      </div>
    </div>
  );
}
