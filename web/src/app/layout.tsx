import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FloatingActions } from "./components/FloatingActions";

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
          <header className="app-header">
            <div className="app-header-inner">
              <div className="app-brand">
                <Link href="/" className="app-brand-link">
                  <span className="app-brand-mark" aria-hidden="true">
                    AH
                  </span>
                  <span className="app-brand-text">Alternance Hunter</span>
                </Link>
              </div>
              <nav className="app-nav" aria-label="Navigation principale">
                <Link href="/" className="app-nav-link">
                  Accueil
                </Link>
                <Link href="/login" className="app-nav-link">
                  Connexion
                </Link>
                <a href="https://github.com/Mahdi-Chaouch/alternance-killer" target="_blank" rel="noreferrer noopener" className="app-nav-link">
                  GitHub
                </a>
              </nav>
              <div className="app-header-cta">
                <Link href="/login" className="app-header-button">
                  Connexion
                </Link>
              </div>
            </div>
          </header>
          <div className="app-main">{children}</div>
          <footer className="app-footer">
            <div className="app-footer-inner">
              <p className="app-footer-meta">
                © {new Date().getFullYear()} Alternance Hunter. Tous droits réservés.
              </p>
            </div>
          </footer>
          <FloatingActions />
        </div>
      </body>
    </html>
  );
}
