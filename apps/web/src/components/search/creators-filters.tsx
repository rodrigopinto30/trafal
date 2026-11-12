import { FilterForm } from "@/components/search/filter-form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Link } from "@/i18n/link";
import { localizePath } from "@/i18n/path";
import { getLocale, getTranslations } from "@/i18n/server";
import { GENRE_IDS } from "@/lib/profile/catalog";
import { CREATORS_SORTS, creatorsHref, hasCreatorFilters, type CreatorsQuery } from "@/lib/validation/creators";
import { SEARCH_QUERY_MAX } from "@/lib/validation/search";

/** Search box, filters and order of the creators page, in one GET form whose view lives in the address. */
export async function CreatorsFilters({ query }: { query: CreatorsQuery }) {
  const [t, tGenres, locale] = await Promise.all([getTranslations("creators"), getTranslations("genres"), getLocale()]);

  return (
    <FilterForm kind="creators" label={t("filtersLabel")} action={localizePath(locale, "/creators")}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field id="creators-q" label={t("searchLabel")} className="sm:col-span-2 lg:col-span-1">
          {(control) => <Input {...control} name="q" type="search" defaultValue={query.q ?? ""} maxLength={SEARCH_QUERY_MAX} placeholder={t("searchPlaceholder")} autoComplete="off" />}
        </Field>
        <Field id="creators-genre" label={t("genre")}>
          {(control) => (
            <NativeSelect {...control} name="genre" defaultValue={query.genre ?? ""}>
              <option value="">{t("genreAll")}</option>
              {GENRE_IDS.map((id) => (
                <option key={id} value={id}>
                  {tGenres(id as Parameters<typeof tGenres>[0])}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field id="creators-sort" label={t("sort")}>
          {(control) => (
            <NativeSelect {...control} name="sort" defaultValue={query.sort}>
              {CREATORS_SORTS.map((sort) => (
                <option key={sort} value={sort}>
                  {t(`sorts.${sort}`)}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit">{t("apply")}</Button>
        {hasCreatorFilters(query) ? (
          <Button asChild variant="ghost">
            <Link href={creatorsHref({ ...query, genre: null, page: 1 })}>{t("clear")}</Link>
          </Button>
        ) : null}
      </div>
    </FilterForm>
  );
}
