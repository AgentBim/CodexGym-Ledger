import { AdultAdminApp } from "@/components/adult-admin-app";

// "Today" is derived from the Barbados date, so render per request rather than at build time.
export const dynamic = "force-dynamic";

export default function HomePage() {
  return <AdultAdminApp />;
}
