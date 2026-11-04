import type { Metadata } from "next";
import { Studio } from "@/components/studio/studio";
import { getContentType, isContentTypeId, type ContentTypeId, type FormValues } from "@/lib/payloads";

export const metadata: Metadata = {
  title: "QR studio — create a custom QR code",
  description: "Create a QR code for a link, Wi-Fi, contact, event, payment and more. Customise colours, shapes and logo, check that it scans, then download PNG, SVG, PDF or EPS.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CreatePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const typeParam = typeof params.type === "string" ? params.type : "url";
  const initialType: ContentTypeId = isContentTypeId(typeParam) ? typeParam : "url";
  // Only simple, known prefills are accepted from the URL.
  const prefill: FormValues = {};
  const url = typeof params.url === "string" ? params.url.slice(0, 2000) : "";
  if (initialType === "url" && url) prefill.url = url;
  const type = getContentType(initialType)!;
  return (
    <>
      <Studio key={initialType} initialType={initialType} prefill={prefill} />
      <noscript>
        <p className="p-6 text-center">QR Studio generates {type.label} codes in your browser and needs JavaScript enabled.</p>
      </noscript>
    </>
  );
}
