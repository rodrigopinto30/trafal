"use client";

import { useActionState } from "react";
import { TopicGrid } from "@/components/profile/topic-grid";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useLocale, useTranslations } from "@/i18n/client";
import { initialFormState } from "@/lib/forms";
import { useSuccessToast } from "@/lib/use-success-toast";
import { updateProfileAction } from "@/lib/profile/actions";

type Props = {
  /** Países ya traducidos y ordenados. Se arman en el servidor: ver la nota en la página. */
  countries: { code: string; name: string }[];
  displayName: string;
  bio: string;
  city: string;
  country: string;
  favoriteGenres: string[];
};

/** Datos del perfil. La foto tiene su propio bloque (AvatarEditor) porque se guarda al instante, aparte de este formulario. */
export function EditProfileForm({ countries, ...initial }: Props) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(updateProfileAction, initialFormState);

  useSuccessToast(state);

  const values = state.values ?? {
    displayName: initial.displayName,
    bio: initial.bio,
    city: initial.city,
    country: initial.country,
    favoriteGenres: initial.favoriteGenres.join(","),
  };
  const selectedGenres = values.favoriteGenres ? values.favoriteGenres.split(",") : [];
  const genresError = state.fieldErrors?.favoriteGenres;

  return (
    <form action={formAction} noValidate className="grid gap-6">
      <input type="hidden" name="lang" value={locale} />
      {state.status === "error" && state.message ? <FormMessage>{state.message}</FormMessage> : null}

      <SettingsSection title={t("profile.aboutTitle")}>
        {/* En pantallas anchas: nombre, ciudad y país a la izquierda y la bio a la derecha, para no estirar campos cortos a 850 px. */}
        <div className="grid gap-6 md:grid-cols-2 md:gap-x-8">
          <div className="grid content-start gap-6">
            <Field id="displayName" label={t("profile.displayName")} error={state.fieldErrors?.displayName}>
              {(control) => <Input {...control} name="displayName" autoComplete="name" maxLength={50} required defaultValue={values.displayName} />}
            </Field>
            <Field id="city" label={t("profile.city")} error={state.fieldErrors?.city}>
              {(control) => <Input {...control} name="city" autoComplete="address-level2" maxLength={80} defaultValue={values.city} />}
            </Field>
            <Field id="country" label={t("profile.country")} error={state.fieldErrors?.country}>
              {(control) => (
                <NativeSelect {...control} name="country" autoComplete="country" defaultValue={values.country}>
                  <option value="">{t("profile.countryPlaceholder")}</option>
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          </div>

          <Field id="bio" label={t("profile.bio")} hint={t("profile.bioHint")} error={state.fieldErrors?.bio} className="content-start">
            {(control) => <Textarea {...control} name="bio" maxLength={280} rows={4} className="md:min-h-[216px]" defaultValue={values.bio} />}
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection title={t("profile.genresTitle")} description={t("profile.genresHint")}>
        <fieldset className="grid gap-3">
          <legend className="sr-only">{t("profile.genresTitle")}</legend>
          <TopicGrid key={values.favoriteGenres} initial={selectedGenres} />
          {genresError ? (
            <p role="alert" className="text-xs font-medium text-[#ff8fa5]">
              {genresError}
            </p>
          ) : null}
        </fieldset>
      </SettingsSection>

      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? tc("saving") : tc("save")}
        </Button>
      </div>
    </form>
  );
}
