import { LegalDocument } from "@/components/legal/legal-document";
import { legalMetadata } from "@/lib/legal/metadata";

export async function generateMetadata() {
  return legalMetadata("terms", "/legal/terms");
}

export default function Page() {
  return <LegalDocument id="terms" />;
}
