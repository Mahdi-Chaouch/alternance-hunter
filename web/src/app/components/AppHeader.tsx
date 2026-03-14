"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";

export function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [menuOpen, closeMenu]);

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-brand">
          <Link href="/" className="app-brand-link" onClick={closeMenu}>
            <span className="app-brand-mark" aria-hidden="true">
              AH
            </span>
            <span className="app-brand-text">Alternance Hunter</span>
          </Link>
        </div>
        <nav className="app-nav" aria-label="Navigation principale">
          <Link href="/" className="app-nav-link">
            🏠 Accueil
          </Link>
          <Link href="/login" className="app-nav-link">
            🔐 Connexion
          </Link>
          <a href="https://github.com/Mahdi-Chaouch/alternance-killer" target="_blank" rel="noreferrer noopener" className="app-nav-link">
            📦 GitHub
          </a>
        </nav>
        <div className="app-header-cta">
          <Link href="/login" className="app-header-button">
            🔐 Connexion
          </Link>
        </div>
        <button
          type="button"
          className="app-burger"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen ? "true" : "false"}
          aria-controls="app-mobile-menu"
          aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
        >
          <span className="app-burger-bar" />
          <span className="app-burger-bar" />
          <span className="app-burger-bar" />
        </button>
      </div>
      <div
        id="app-mobile-menu"
        className={`app-mobile-menu ${menuOpen ? "app-mobile-menu-open" : ""}`}
        aria-hidden={menuOpen ? "false" : "true"}
      >
        <div className="app-mobile-menu-backdrop" onClick={closeMenu} />
        <div className="app-mobile-menu-panel">
          <nav className="app-mobile-nav" aria-label="Menu mobile">
            <Link href="/" className="app-mobile-nav-link" onClick={closeMenu}>
              🏠 Accueil
            </Link>
            <Link href="/login" className="app-mobile-nav-link" onClick={closeMenu}>
              🔐 Connexion
            </Link>
            <a
              href="https://github.com/Mahdi-Chaouch/alternance-killer"
              target="_blank"
              rel="noreferrer noopener"
              className="app-mobile-nav-link"
              onClick={closeMenu}
            >
              📦 GitHub
            </a>
            <Link href="/login" className="app-mobile-nav-cta" onClick={closeMenu}>
              🔐 Connexion
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
