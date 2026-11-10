import { LegalDocument } from "@/components/legal/legal-document";
import { legalMetadata } from "@/lib/legal/metadata";

export async function generateMetadata() {
  return legalMetadata("privacy", "/legal/privacy");
}

export default function Page() {
  return <LegalDocument id="privacy" />;
}
