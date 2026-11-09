import { serializeStructuredData } from "@/lib/seo/structured-data";

/** Structured data for search engines. The text goes through `serializeStructuredData`, which keeps anything a person wrote from closing the tag. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(data) }} />;
}
