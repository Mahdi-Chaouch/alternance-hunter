import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FloatingActions } from "./components/FloatingActions";
import { AppHeader } from "./components/AppHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alternance Hunter",
  description:
    "Automatisez vos candidatures d'alternance avec un pipeline Gmail suivi par un dashboard temps reel.",
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.dataset.theme = localStorage.getItem('alternance-ui-theme') === 'light' ? 'light' : 'dark';`,
          }}
        />
        <div className="app-shell">
          <AppHeader />
          <div className="app-main">{children}</div>
          <footer className="app-footer">
            <div className="app-footer-inner" style={{ flexWrap: 'wrap' }}>
              <p className="app-footer-meta">
                ©️ {new Date().getFullYear()} Alternance Hunter. Tous droits réservés.
              </p>
              <div style={{ display: 'flex', gap: '1.5rem', opacity: 0.8 }}>
                <Link href="/mentions-legales" className="app-nav-link" style={{ fontSize: '0.85rem' }}>Mentions Légales</Link>
                <Link href="/cgu" className="app-nav-link" style={{ fontSize: '0.85rem' }}>CGU</Link>
                <Link href="/confidentialite" className="app-nav-link" style={{ fontSize: '0.85rem' }}>Confidentialité</Link>
              </div>
            </div>
          </footer>
          <FloatingActions />
        </div>
      </body>
    </html>
  );
}
