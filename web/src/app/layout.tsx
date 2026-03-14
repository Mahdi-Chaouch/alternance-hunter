import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alternance Automation",
  description:
    "Automatisez vos candidatures d'alternance avec un pipeline Gmail suivi par un dashboard temps reel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <div className="app-shell">
          <header className="app-header">
            <div className="app-header-inner">
              <div className="app-brand">
                <Link href="/" className="app-brand-link">
                  <span className="app-brand-mark" aria-hidden="true">
                    AA
                  </span>
                  <span className="app-brand-text">Alternance Automation</span>
                </Link>
              </div>
              <nav className="app-nav" aria-label="Navigation principale">
                <Link href="/" className="app-nav-link">
                  Accueil
                </Link>
                <Link href="/dashboard?demo=1" className="app-nav-link">
                  Voir en démo
                </Link>
                <Link href="/login" className="app-nav-link">
                  Connexion
                </Link>
                <a href="https://github.com/Mahdi-Chaouch/alternance-killer" target="_blank" rel="noreferrer noopener" className="app-nav-link">
                  GitHub
                </a>
              </nav>
              <div className="app-header-cta">
                <Link href="/dashboard?demo=1" className="app-nav-link" style={{ marginRight: "0.75rem" }}>
                  Voir en démo
                </Link>
                <Link href="/dashboard" className="app-header-button">
                  Ouvrir le dashboard
                </Link>
              </div>
            </div>
          </header>
          <div className="app-main">{children}</div>
          <footer className="app-footer">
            <div className="app-footer-inner">
              <p className="app-footer-meta">
                © {new Date().getFullYear()} Alternance Automation. Tous droits réservés.
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
