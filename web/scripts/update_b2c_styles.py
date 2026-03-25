import re
import os

print("Starting Global UI Revamp (Night/Purple, Nunito, LayoutWrapper)...")

# 1. layout.tsx
layout_content = """import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { LayoutWrapper } from "./LayoutWrapper";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
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
"""
with open("layout.tsx", "w", encoding="utf-8") as f:
    f.write(layout_content)

# 2. LayoutWrapper.tsx
wrapper_content = """"use client";
import { usePathname } from "next/navigation";
import { AppHeader } from "./components/AppHeader";
import { FloatingActions } from "./components/FloatingActions";
import Link from "next/link";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");

  return (
    <div className="app-shell">
      {!isDashboard && <AppHeader />}
      <div className="app-main">{children}</div>
      {!isDashboard && (
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
      )}
      <FloatingActions />
    </div>
  );
}
"""
with open("LayoutWrapper.tsx", "w", encoding="utf-8") as f:
    f.write(wrapper_content)

# 3. globals.css (Colors & Font)
with open("globals.css", "r", encoding="utf-8") as f:
    css_content = f.read()

css_content = css_content.replace("--font-geist-sans", "--font-nunito")
css_content = css_content.replace("--color-accent: #01B2B2;", "--color-accent: #8b5cf6;")
css_content = css_content.replace("--color-accent-soft: rgba(1, 178, 178, 0.12);", "--color-accent-soft: rgba(139, 92, 246, 0.12);")
css_content = css_content.replace("--color-accent-strong: #81DC4D;", "--color-accent-strong: #d946ef;")

css_content = css_content.replace("--color-bg: #020617;", "--color-bg: #0f172a;")
css_content = css_content.replace("--color-bg-elevated: #020617;", "--color-bg-elevated: #0f172a;")

css_content = css_content.replace("#01B2B2", "#8b5cf6") # Cyan to Purple
css_content = css_content.replace("#81DC4D", "#d946ef") # Green to Magenta/Pink

# RGB replacements
css_content = css_content.replace("1, 178, 178", "139, 92, 246") # Cyan
css_content = css_content.replace("129, 220, 77", "217, 70, 239") # Light Green to Pink

with open("globals.css", "w", encoding="utf-8") as f:
    f.write(css_content)

# 4. landing.module.css
with open("landing.module.css", "r", encoding="utf-8") as f:
    landing_css = f.read()
    
landing_css = landing_css.replace("#01B2B2", "#8b5cf6")
landing_css = landing_css.replace("#009B9B", "#7c3aed")
landing_css = landing_css.replace("#81DC4D", "#d946ef")
landing_css = landing_css.replace("1, 178, 178", "139, 92, 246")
# rounded edges
landing_css = landing_css.replace("border-radius: 16px;", "border-radius: 24px;")
landing_css = landing_css.replace("border-radius: 20px;", "border-radius: 24px;")

with open("landing.module.css", "w", encoding="utf-8") as f:
    f.write(landing_css)

# 5. page.module.css (Dashboard)
with open("page.module.css", "r", encoding="utf-8") as f:
    dashboard_css = f.read()

dashboard_css = dashboard_css.replace("#01B2B2", "#8b5cf6")
dashboard_css = dashboard_css.replace("#009B9B", "#7c3aed")
dashboard_css = dashboard_css.replace("#81DC4D", "#d946ef")
dashboard_css = dashboard_css.replace("1, 178, 178", "139, 92, 246")

# Deep night mode in page.module.css
dashboard_css = dashboard_css.replace("--bg: #030712;", "--bg: #0f172a;")
dashboard_css = dashboard_css.replace("--panel-bg: #0b1220;", "--panel-bg: #1e293b;")

# Rounded shapes
dashboard_css = dashboard_css.replace("border-radius: 14px;", "border-radius: 24px;")
dashboard_css = dashboard_css.replace("border-radius: 16px;", "border-radius: 24px;")
dashboard_css = dashboard_css.replace("border-radius: 18px;", "border-radius: 24px;")
dashboard_css = dashboard_css.replace("border-radius: 20px;", "border-radius: 24px;")

# Fix shadows to match the pop color lightly
dashboard_css = dashboard_css.replace("box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);", "box-shadow: 0 15px 50px rgba(139, 92, 246, 0.08);")

with open("page.module.css", "w", encoding="utf-8") as f:
    f.write(dashboard_css)

# 6. login/login.module.css
with open("login/login.module.css", "r", encoding="utf-8") as f:
    login_css = f.read()

login_css = login_css.replace("#01B2B2", "#8b5cf6")
login_css = login_css.replace("#81DC4D", "#d946ef")
login_css = login_css.replace("1, 178, 178", "139, 92, 246")
login_css = login_css.replace("129, 220, 77", "217, 70, 239")
login_css = login_css.replace("border-radius: 16px;", "border-radius: 24px;")

with open("login/login.module.css", "w", encoding="utf-8") as f:
    f.write(login_css)

print("Global Revamp Completed: Colors, Fonts, Wrappers applied.")
