import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adult Gym Admin",
  description: "Attendance and payment tracking for adult gymnastics classes.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#102a43",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Reading the nonce (set by the proxy per request) both forces this route to
  // render dynamically instead of being statically prerendered without a nonce,
  // and lets Next.js apply it to its own inline hydration scripts. See
  // https://nextjs.org/docs/app/guides/content-security-policy
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const nonce = (await headers()).get("x-nonce");

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

