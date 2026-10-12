"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { PreferencesFields, type Preferences } from "@/components/profile/preferences-fields";
import { removeProfileImageAction, updateBasicsAction, updatePreferencesAction, uploadProfileImageAction } from "@/server/actions/profile";
import { useI18n } from "@/i18n/client";
import { localizedCountries } from "@/i18n/countries";
import { acceptFor, checkUpload } from "@/lib/upload-check";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export type BasicsValue = {
  name: string;
  headline: string;
  about: string;
  pronouns: string;
  city: string;
  countryCode: string;
  website: string;
};

function useSave() {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string; fieldErrors?: Record<string, string[] | undefined> } | null>) =>
    start(async () => {
      const res = await fn();
      if (res?.ok) {
        setErrors({});
        toast.success(res.message ?? t("common.saved"));
        router.refresh();
      } else {
        setErrors(res?.fieldErrors ?? {});
        toast.error(res?.error ?? t("common.somethingWrong"));
      }
    });
  return { pending, errors, run };
}

export function ImageUploader({ kind, current, name }: { kind: "avatar" | "cover"; current: string | null; name: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const upload = (file: File) => {
    if (input.current) input.current.value = "";
    const problem = checkUpload(file, "image", t);
    if (problem) return toast.error(problem);
    start(async () => {
      const fd = new FormData();
      fd.set("kind", kind);
      fd.set("file", file);
      const res = await uploadProfileImageAction(fd).catch(() => null);
      if (res?.ok) {
        toast.success(res.message ?? t("common.saved"));
        router.refresh();
      } else toast.error(res && !res.ok ? res.error : t("msg.uploadFailed"));
    });
  };
  const [confirming, setConfirming] = useState(false);
  const remove = () =>
    start(async () => {
      const res = await removeProfileImageAction(kind).catch(() => null);
      setConfirming(false);
      if (res?.ok) {
        toast.success(res.message ?? t("common.saved"));
        router.refresh();
      } else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
    });
  const askRemove = () => setConfirming(true);

  return (
    <div className={kind === "cover" ? "relative" : "flex items-center gap-4"}>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={kind === "avatar" ? t("profileEdit.removePhotoTitle") : t("profileEdit.removeCoverTitle")}
        description={t("profileEdit.removeImageBody")}
        confirmLabel={t("common.remove")}
        onConfirm={remove}
        loading={pending}
      />
      <input ref={input} type="file" accept={acceptFor("image")} className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      {kind === "avatar" ? (
        <>
          <button type="button" onClick={() => input.current?.click()} className="group relative rounded-full" aria-label={t("profileEdit.changePhoto")}>
            <Avatar name={name} src={current} size="xl" />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
              <Camera className="size-5" />
            </span>
          </button>
          <div className="flex flex-col gap-1.5">
            <Button size="sm" variant="outline" loading={pending} onClick={() => input.current?.click()}>
              <Camera /> {current ? t("profileEdit.changePhoto") : t("profileEdit.uploadPhoto")}
            </Button>
            {current && (
              <Button size="sm" variant="ghost" onClick={askRemove} disabled={pending}>
                <Trash2 /> {t("common.remove")}
              </Button>
            )}
            <span className="text-xs text-fg-subtle">{t("profileEdit.imageHint")}</span>
          </div>
        </>
      ) : (
        <div
          className="flex h-32 items-end justify-end gap-2 rounded-2xl bg-gradient-to-br from-brand via-aurora to-mint bg-cover bg-center p-3 rtl:bg-gradient-to-bl"
          style={current ? { backgroundImage: `url(${current})` } : undefined}
        >
          <Button size="sm" variant="outline" loading={pending} onClick={() => input.current?.click()}>
            <ImagePlus /> {current ? t("profileEdit.changeCover") : t("profileEdit.addCover")}
          </Button>
          {current && (
            <Button size="sm" variant="outline" onClick={askRemove} disabled={pending} aria-label={t("common.remove")}>
              <Trash2 />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function BasicsForm({ initial, image, cover }: { initial: BasicsValue; image: string | null; cover: string | null }) {
  const [v, setV] = useState(initial);
  const { t, f } = useI18n();
  const { pending, errors, run } = useSave();
  const set = (k: keyof BasicsValue) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <div className="space-y-5">
      <ImageUploader kind="cover" current={cover} name={v.name} />
      <ImageUploader kind="avatar" current={image} name={v.name} />
      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <Field label={t("profileEdit.fullName")} error={errors.name}>
          {(p) => <Input {...p} value={v.name} onChange={set("name")} maxLength={80} />}
        </Field>
        <Field label={t("profileEdit.pronouns")} optional error={errors.pronouns}>
          {(p) => <Input {...p} value={v.pronouns} onChange={set("pronouns")} maxLength={30} placeholder="she/her" />}
        </Field>
      </div>
      <Field label={t("profileEdit.headline")} hint={t("profileEdit.headlineHint")} error={errors.headline}>
        {(p) => <Input {...p} value={v.headline} onChange={set("headline")} maxLength={160} />}
      </Field>
      <Field label={t("profileEdit.about")} hint={t("profileEdit.aboutHint", { n: v.about.length })} error={errors.about}>
        {(p) => <Textarea {...p} value={v.about} onChange={set("about")} maxLength={2600} className="min-h-40" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("onboarding.city")} error={errors.city}>
          {(p) => <Input {...p} value={v.city} onChange={set("city")} maxLength={60} />}
        </Field>
        <Field label={t("onboarding.country")} error={errors.countryCode}>
          {(p) => (
            <Select {...p} value={v.countryCode} onChange={set("countryCode")}>
              <option value="">{t("common.select")}</option>
              {localizedCountries(f).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label={t("profileEdit.website")} optional error={errors.website}>
        {(p) => <Input {...p} type="url" value={v.website} onChange={set("website")} placeholder="https://" />}
      </Field>
      <div className="flex justify-end">
        <Button loading={pending} onClick={() => run(() => updateBasicsAction({ ...v, countryCode: v.countryCode || null }))}>
          {t("profileEdit.saveBasics")}
        </Button>
      </div>
    </div>
  );
}

export function PreferencesForm({ initial, industries }: { initial: Preferences; industries: { id: string; name: string }[] }) {
  const [v, setV] = useState(initial);
  const { t } = useI18n();
  const { pending, run } = useSave();
  return (
    <div>
      <PreferencesFields value={v} onChange={setV} industries={industries} />
      <div className="mt-6 flex justify-end">
        <Button loading={pending} onClick={() => run(() => updatePreferencesAction(v))}>
          {t("profileEdit.savePrefs")}
        </Button>
      </div>
    </div>
  );
}
