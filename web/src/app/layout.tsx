import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { LayoutWrapper } from "./LayoutWrapper";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const SITE_URL = "https://alternance-hunter.com";
const SITE_DESCRIPTION =
  "Automatisez vos candidatures d'alternance : pipeline de recherche d'entreprises, génération de lettres de motivation et création de brouillons Gmail en un clic.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Alternance Hunter",
    template: "%s — Alternance Hunter",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: "Alternance Hunter",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: "Alternance Hunter",
    images: [{ url: "/logo.png", width: 192, height: 192, alt: "Alternance Hunter" }],
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Alternance Hunter",
    description: SITE_DESCRIPTION,
    images: ["/logo.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon", sizes: "any" },
      { url: "/logo.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/logo.png",
    shortcut: "/favicon.ico",
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={nunito.variable}>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.dataset.theme = localStorage.getItem('alternance-ui-theme') === 'light' ? 'light' : 'dark';`,
          }}
        />
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}
