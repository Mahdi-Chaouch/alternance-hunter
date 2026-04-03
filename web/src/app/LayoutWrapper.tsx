"use client";
import { usePathname } from "next/navigation";
import { AppHeader } from "./components/AppHeader";
import { FloatingActions } from "./components/FloatingActions";
import Link from "next/link";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="app-main">{children}</div>
      {!isDashboard && (
        <footer className="app-footer">
            <div className="app-footer-inner" style={{ flexWrap: 'wrap' }}>
              <p className="app-footer-meta">
                ©️ {new Date().getFullYear()} Alternance Hunter. Tous droits réservés.
              </p>
              <div style={{ display: 'flex', gap: '1.5rem', opacity: 0.8, flexWrap: 'wrap' }}>
                <Link href="/support" className="app-nav-link" style={{ fontSize: '0.85rem' }}>Support</Link>
                <Link href="/mentions-legales" className="app-nav-link" style={{ fontSize: '0.85rem' }}>Mentions Légales</Link>
                <Link href="/cgu" className="app-nav-link" style={{ fontSize: '0.85rem' }}>CGU</Link>
                <Link href="/confidentialite" className="app-nav-link" style={{ fontSize: '0.85rem' }}>Confidentialité</Link>
              </div>
            </div>
        </footer>
      )}
      <FloatingActions />
    </div>
  );
}
