"use client";

import { useState, useTransition } from "react";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { scheduleInterviewAction } from "@/server/actions/interviews";
import { INTERVIEW_TYPES, type InterviewType } from "@/lib/constants";
import { useI18n } from "@/i18n/client";

function defaultSlot() {
  const d = new Date(Date.now() + 2 * 86_400_000);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleInterviewButton({ applicationId, candidateName, onDone }: { applicationId: string; candidateName: string; onDone?: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ startsAt: defaultSlot(), durationMinutes: 45, type: "VIDEO" as InterviewType, meetingUrl: "", location: "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <CalendarPlus /> {t("recruiter.schedule")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("recruiter.interviewWith", { name: candidateName })}
        description={t("recruiter.interviewDesc")}
        footer={
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await scheduleInterviewAction({
                  applicationId,
                  // datetime-local is local time; send an absolute timestamp.
                  startsAt: new Date(v.startsAt).toISOString(),
                  durationMinutes: v.durationMinutes,
                  type: v.type,
                  meetingUrl: v.type === "VIDEO" ? v.meetingUrl : null,
                  location: v.type === "ONSITE" ? v.location : null,
                  notes: v.notes,
                });
                if (res?.ok) {
                  toast.success(res.message ?? t("common.saved"));
                  setOpen(false);
                  onDone?.();
                } else {
                  setErrors(res && !res.ok ? (res.fieldErrors ?? {}) : {});
                  toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
                }
              })
            }
          >
            {t("recruiter.sendInvite")}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("recruiter.dateTime")} error={errors.startsAt}>
            {(p) => <Input {...p} type="datetime-local" value={v.startsAt} onChange={(e) => setV({ ...v, startsAt: e.target.value })} />}
          </Field>
          <Field label={t("recruiter.duration")}>
            {(p) => (
              <Select {...p} value={v.durationMinutes} onChange={(e) => setV({ ...v, durationMinutes: Number(e.target.value) })}>
                {[30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>
                    {t("recruiter.minutes", { n: m })}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t("recruiter.format")} className="sm:col-span-2">
            {(p) => (
              <Select {...p} value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as InterviewType })}>
                {INTERVIEW_TYPES.map((it) => (
                  <option key={it} value={it}>
                    {t(`enums.interviewType.${it}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {v.type === "VIDEO" && (
            <Field label={t("recruiter.meetingLink")} optional className="sm:col-span-2" error={errors.meetingUrl}>
              {(p) => <Input {...p} type="url" value={v.meetingUrl} onChange={(e) => setV({ ...v, meetingUrl: e.target.value })} placeholder="https://" />}
            </Field>
          )}
          {v.type === "ONSITE" && (
            <Field label={t("recruiter.address")} className="sm:col-span-2">
              {(p) => <Input {...p} value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} maxLength={200} />}
            </Field>
          )}
          <Field label={t("recruiter.notesForCandidate")} optional className="sm:col-span-2">
            {(p) => <Textarea {...p} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} maxLength={1000} className="min-h-20" placeholder={t("recruiter.notesPh")} />}
          </Field>
        </div>
      </Dialog>
    </>
  );
}
