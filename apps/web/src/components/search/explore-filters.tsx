import { Button } from "@/components/ui/button";
import { FilterForm } from "@/components/search/filter-form";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Link } from "@/i18n/link";
import { localizePath } from "@/i18n/path";
import { getLocale, getTranslations } from "@/i18n/server";
import { GENRE_IDS } from "@/lib/profile/catalog";
import { EXPLORE_SORTS, exploreHref, hasFilters, type ExploreQuery } from "@/lib/validation/explore";

/**
 * Filters and order of the games on the home: a GET form whose view stays in the address, with the text being searched kept as a
 * hidden field. Changing any filter starts again from the first page.
 */
export async function ExploreFilters({ query }: { query: ExploreQuery }) {
  const [t, tGenres, locale] = await Promise.all([getTranslations("explore"), getTranslations("genres"), getLocale()]);
  const sorts = EXPLORE_SORTS.filter((sort) => sort !== "relevance" || query.q);

  return (
    <FilterForm kind="explore" label={t("filtersLabel")} action={localizePath(locale, "/")}>
      {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="explore-genre" label={t("genre")}>
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
        <Field id="explore-sort" label={t("sort")}>
          {(control) => (
            <NativeSelect {...control} name="sort" defaultValue={query.sort}>
              {sorts.map((sort) => (
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
        {hasFilters(query) ? (
          <Button asChild variant="ghost">
            <Link href={exploreHref({ ...query, genre: null, page: 1 })}>{t("clear")}</Link>
          </Button>
        ) : null}
      </div>
    </FilterForm>
  );
}
