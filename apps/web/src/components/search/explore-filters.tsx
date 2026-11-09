import { Button } from "@/components/ui/button";
import { FilterForm } from "@/components/search/filter-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Link } from "@/i18n/link";
import { localizePath } from "@/i18n/path";
import { getLocale, getTranslations } from "@/i18n/server";
import { ENGINE_IDS, GENRE_IDS } from "@/lib/profile/catalog";
import { EXPLORE_SORTS, exploreHref, hasFilters, type ExploreQuery } from "@/lib/validation/explore";

/**
 * Filters and order of the explore page: a GET form whose view stays in the address, with the text being searched kept as a
 * hidden field. Changing any filter starts again from the first page.
 */
export async function ExploreFilters({ query }: { query: ExploreQuery }) {
  const [t, tGenres, tEngines, locale] = await Promise.all([getTranslations("explore"), getTranslations("genres"), getTranslations("engines"), getLocale()]);
  const sorts = EXPLORE_SORTS.filter((sort) => sort !== "relevance" || query.q);

  return (
    <FilterForm kind="explore" label={t("filtersLabel")} action={localizePath(locale, "/explore")}>
      {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <Field id="explore-engine" label={t("engine")}>
          {(control) => (
            <NativeSelect {...control} name="engine" defaultValue={query.engine ?? ""}>
              <option value="">{t("engineAll")}</option>
              {ENGINE_IDS.map((id) => (
                <option key={id} value={id}>
                  {tEngines(id as Parameters<typeof tEngines>[0])}
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
        <div className="flex items-end gap-3 pb-3">
          <Checkbox id="explore-mobile" name="mobile" value="1" defaultChecked={query.mobile} />
          <Label htmlFor="explore-mobile" className="font-normal text-text-2">
            {t("mobileOnly")}
          </Label>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit">{t("apply")}</Button>
        {hasFilters(query) ? (
          <Button asChild variant="ghost">
            <Link href={exploreHref({ ...query, genre: null, engine: null, mobile: false, page: 1 })}>{t("clear")}</Link>
          </Button>
        ) : null}
      </div>
    </FilterForm>
  );
}
