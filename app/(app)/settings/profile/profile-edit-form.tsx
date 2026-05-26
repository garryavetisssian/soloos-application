"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CharCounter } from "@/components/profile/char-counter";
import { CompletenessBar } from "@/components/profile/completeness-bar";
import { FormField } from "@/components/profile/form-field";
import { LanguageEditor } from "@/components/profile/language-editor";
import { SalaryInput } from "@/components/profile/salary-input";
import { TagInput } from "@/components/profile/tag-input";
import { FormSection } from "@/components/onboarding/form-section";
import { saveProfileAction } from "@/app/onboarding/actions";
import {
  COVER_LETTER_MIN_COMPLETENESS,
  computeCompleteness,
  type ProfileFieldErrors,
  type ProfileFormState,
} from "@/lib/profile-form";
import type { Language } from "@/lib/types";

const SUMMARY_MAX = 1400;

interface Props {
  initial: ProfileFormState;
}

export function ProfileEditForm({ initial }: Props) {
  const router = useRouter();
  const [data, setData] = useState<ProfileFormState>(initial);
  const [errors, setErrors] = useState<ProfileFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, startSaving] = useTransition();

  function update<K extends keyof ProfileFormState>(
    key: K,
    value: ProfileFormState[K],
  ) {
    setData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function handleSave() {
    setError(null);
    startSaving(async () => {
      const result = await saveProfileAction(data);
      if (!result.ok) {
        setError(result.error);
        setErrors(result.fieldErrors ?? {});
        return;
      }
      setErrors({});
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  const completeness = useMemo(() => computeCompleteness(data), [data]);

  return (
    <div className="container max-w-3xl py-10">
      <div className="pb-6">
        <h1 className="text-h1 font-semibold tracking-tight text-foreground">
          Profile
        </h1>
        <p className="pt-1 text-small text-muted-foreground">
          Used by every AI feature in SoloOS. Update anytime.
        </p>
      </div>

      <div className="pb-8">
        <CompletenessBar
          value={completeness}
          threshold={COVER_LETTER_MIN_COMPLETENESS}
          hint={
            completeness < COVER_LETTER_MIN_COMPLETENESS
              ? `Cover letter generation unlocks at ${COVER_LETTER_MIN_COMPLETENESS}%.`
              : undefined
          }
        />
      </div>

      <div className="space-y-6">
        <FormSection title="Basic info">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              label="Full name"
              required
              error={errors.full_name}
              className="sm:col-span-2"
            >
              <Input
                value={data.full_name}
                onChange={(e) => update("full_name", e.target.value)}
                maxLength={80}
              />
            </FormField>
            <FormField
              label="Current role"
              required
              error={errors.current_role}
            >
              <Input
                value={data.current_role}
                onChange={(e) => update("current_role", e.target.value)}
                maxLength={80}
              />
            </FormField>
            <FormField label="Location" error={errors.location}>
              <Input
                value={data.location}
                onChange={(e) => update("location", e.target.value)}
                maxLength={80}
              />
            </FormField>
            <FormField label="Email" required error={errors.email}>
              <Input
                type="email"
                value={data.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </FormField>
            <FormField
              label="Preferred language"
              required
              error={errors.preferred_language}
            >
              <Select
                value={data.preferred_language}
                onChange={(e) =>
                  update("preferred_language", e.target.value as Language)
                }
              >
                <option value="en">English</option>
                <option value="ru">Russian</option>
                <option value="hy">Armenian</option>
              </Select>
            </FormField>
            <FormField label="LinkedIn URL" error={errors.linkedin_url}>
              <Input
                value={data.linkedin_url}
                onChange={(e) => update("linkedin_url", e.target.value)}
              />
            </FormField>
            <FormField label="Portfolio URL" error={errors.portfolio_url}>
              <Input
                value={data.portfolio_url}
                onChange={(e) => update("portfolio_url", e.target.value)}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Experience">
          <FormField
            label="Years of experience"
            required
            error={errors.years_of_experience}
            hint="0–50"
          >
            <Input
              inputMode="numeric"
              pattern="[0-9]*"
              value={data.years_of_experience}
              onChange={(e) =>
                update(
                  "years_of_experience",
                  e.target.value.replace(/[^\d]/g, "").slice(0, 2),
                )
              }
              className="max-w-[160px]"
            />
          </FormField>
          <FormField
            label="Professional summary"
            error={errors.professional_summary}
            meta={
              <CharCounter value={data.professional_summary} max={SUMMARY_MAX} />
            }
          >
            <Textarea
              rows={8}
              maxLength={SUMMARY_MAX}
              value={data.professional_summary}
              onChange={(e) => update("professional_summary", e.target.value)}
            />
          </FormField>
        </FormSection>

        <FormSection title="Skills">
          <FormField label="Skills" required error={errors.skills}>
            <TagInput
              value={data.skills}
              onChange={(next) => update("skills", next)}
              placeholder="Add skill…"
              max={20}
            />
          </FormField>
          <FormField label="Tools" error={errors.tools}>
            <TagInput
              value={data.tools}
              onChange={(next) => update("tools", next)}
              placeholder="Add tool…"
              max={20}
            />
          </FormField>
        </FormSection>

        <FormSection title="Languages">
          <FormField label="Languages" required error={errors.languages}>
            <LanguageEditor
              value={data.languages}
              onChange={(next) => update("languages", next)}
            />
          </FormField>
        </FormSection>

        <FormSection title="Goals">
          <FormField label="Target role" required error={errors.target_role}>
            <Input
              value={data.target_role}
              onChange={(e) => update("target_role", e.target.value)}
              maxLength={80}
            />
          </FormField>
          <FormField
            label="Target industries"
            error={errors.target_industries}
          >
            <TagInput
              value={data.target_industries}
              onChange={(next) => update("target_industries", next)}
              placeholder="Add industry…"
              max={10}
            />
          </FormField>
          <FormField label="Preferred work format">
            <Select
              value={data.preferred_work_format}
              onChange={(e) => update("preferred_work_format", e.target.value)}
            >
              <option value="">No preference</option>
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
              <option value="On-site">On-site</option>
              <option value="Flexible">Flexible</option>
            </Select>
          </FormField>
          <FormField label="Salary expectation">
            <SalaryInput
              value={data.salary}
              onChange={(next) => update("salary", next)}
            />
          </FormField>
        </FormSection>
      </div>

      <div className="mt-8 flex items-center gap-3 border-t border-border pt-6">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="animate-spin" />
              Saving…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
        {savedAt && !saving && (
          <span className="text-small text-success">Saved.</span>
        )}
        {error && (
          <span
            role="alert"
            className="whitespace-pre-wrap break-words text-small text-destructive"
          >
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
