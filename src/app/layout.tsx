import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: { default: "QR Studio — design QR codes that scan", template: "%s · QR Studio" },
  description:
    "Create custom QR codes for links, Wi-Fi, contacts, events, payments and more. Live preview, colours, gradients, shapes, logos and PNG/SVG/PDF/EPS downloads — free and private, generated in your browser.",
  openGraph: { type: "website", siteName: "QR Studio" },
};

export const viewport: Viewport = { themeColor: "#1E1B4B", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-card bg-brand-600 px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
        >
          Skip to content
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
