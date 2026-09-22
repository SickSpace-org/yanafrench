// Next.js's Metadata API has no first-class field for structured data, so
// a raw <script type="application/ld+json"> is the documented App Router
// pattern (https://nextjs.org/docs/app/guides/json-ld) — this just avoids
// repeating the JSON.stringify/dangerouslySetInnerHTML boilerplate at
// every call site. Renders nothing visible.
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
