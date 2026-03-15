"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

function getInitials(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toUpperCase();
  }
  return n.slice(0, 2).toUpperCase();
}

function getFirstName(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n) return "Profil";
  return n.split(/\s+/)[0] ?? n;
}

export function AppHeader() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profilDropdownOpen, setProfilDropdownOpen] = useState(false);
  const profilDropdownRef = useRef<HTMLDivElement>(null);

  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;
  const isConnected = Boolean(user?.email);

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

  useEffect(() => {
    if (!profilDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (profilDropdownRef.current && !profilDropdownRef.current.contains(e.target as Node)) {
        setProfilDropdownOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfilDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [profilDropdownOpen]);

  async function handleSignOut() {
    setProfilDropdownOpen(false);
    closeMenu();
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  const toggleProfilDropdown = () => setProfilDropdownOpen((o) => !o);

  const profilButtonContent = (
    <>
      {user?.image ? (
        <img
          src={user.image}
          alt=""
          className="app-header-profil-avatar-img"
          width={28}
          height={28}
        />
      ) : (
        <span className="app-header-profil-avatar" aria-hidden="true">
          {getInitials(user?.name)}
        </span>
      )}
      <span className="app-header-profil-name">{getFirstName(user?.name)}</span>
      <span className="app-header-profil-chevron" aria-hidden="true">▾</span>
    </>
  );

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
          {isConnected ? (
            <Link href="/profil" className="app-nav-link">
              👤 Profil
            </Link>
          ) : (
            <Link href="/login" className="app-nav-link">
              🔐 Connexion
            </Link>
          )}
          <a href="https://github.com/Mahdi-Chaouch/alternance-killer" target="_blank" rel="noreferrer noopener" className="app-nav-link">
            📦 GitHub
          </a>
        </nav>
        <div className="app-header-cta">
          {isPending ? (
            <span className="app-header-profil-button app-header-profil-button-loading" aria-hidden="true">
              <span className="app-header-profil-avatar">...</span>
              <span>Chargement</span>
            </span>
          ) : isConnected ? (
            <div className="app-header-profil-wrap" ref={profilDropdownRef}>
              {profilDropdownOpen ? (
                <button
                  type="button"
                  className="app-header-profil-button"
                  onClick={toggleProfilDropdown}
                  aria-expanded="true"
                  aria-haspopup="menu"
                  aria-label="Fermer le menu profil"
                >
                  {profilButtonContent}
                </button>
              ) : (
                <button
                  type="button"
                  className="app-header-profil-button"
                  onClick={toggleProfilDropdown}
                  aria-expanded="false"
                  aria-haspopup="menu"
                  aria-label="Ouvrir le menu profil"
                >
                  {profilButtonContent}
                </button>
              )}
              {profilDropdownOpen ? (
                <div
                  className="app-header-profil-dropdown"
                  role="menu"
                >
                  <Link
                    href="/profil"
                    className="app-header-profil-dropdown-item"
                    role="menuitem"
                    onClick={() => setProfilDropdownOpen(false)}
                  >
                    👤 Mon profil
                  </Link>
                  <Link
                    href="/profil#candidatures"
                    className="app-header-profil-dropdown-item"
                    role="menuitem"
                    onClick={() => setProfilDropdownOpen(false)}
                  >
                    📋 Suivi de candidatures
                  </Link>
                  <button
                    type="button"
                    className="app-header-profil-dropdown-item app-header-profil-dropdown-item-signout"
                    role="menuitem"
                    onClick={() => void handleSignOut()}
                  >
                    🚪 Déconnexion
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <Link href="/login" className="app-header-button">
              🔐 Connexion
            </Link>
          )}
        </div>
        <div className={`app-burger-wrap${menuOpen ? " is-open" : ""}`}>
          <button
            type="button"
            className="app-burger app-burger-closed"
            onClick={() => setMenuOpen(true)}
            aria-controls="app-mobile-menu"
            aria-label="Ouvrir le menu"
            aria-expanded="false"
          >
            <span className="app-burger-bar" />
            <span className="app-burger-bar" />
            <span className="app-burger-bar" />
          </button>
          <button
            type="button"
            className="app-burger app-burger-open"
            onClick={() => setMenuOpen(false)}
            aria-controls="app-mobile-menu"
            aria-label="Fermer le menu"
            aria-expanded="true"
          >
            <span className="app-burger-bar" />
            <span className="app-burger-bar" />
            <span className="app-burger-bar" />
          </button>
        </div>
      </div>
      <div
        id="app-mobile-menu"
        className={`app-mobile-menu ${menuOpen ? "app-mobile-menu-open" : ""}`}
      >
        <div className="app-mobile-menu-backdrop" onClick={closeMenu} />
        <div className="app-mobile-menu-panel">
          <nav className="app-mobile-nav" aria-label="Menu mobile">
            <Link href="/" className="app-mobile-nav-link" onClick={closeMenu}>
              🏠 Accueil
            </Link>
            {isConnected ? (
              <>
                <Link href="/profil" className="app-mobile-nav-link" onClick={closeMenu}>
                  👤 Mon profil
                </Link>
                <Link href="/profil#candidatures" className="app-mobile-nav-link" onClick={closeMenu}>
                  📋 Suivi de candidatures
                </Link>
                <button
                  type="button"
                  className="app-mobile-nav-link app-mobile-nav-signout"
                  onClick={() => void handleSignOut()}
                >
                  🚪 Déconnexion
                </button>
              </>
            ) : (
              <Link href="/login" className="app-mobile-nav-link" onClick={closeMenu}>
                🔐 Connexion
              </Link>
            )}
            <a
              href="https://github.com/Mahdi-Chaouch/alternance-killer"
              target="_blank"
              rel="noreferrer noopener"
              className="app-mobile-nav-link"
              onClick={closeMenu}
            >
              📦 GitHub
            </a>
            {!isConnected ? (
              <Link href="/login" className="app-mobile-nav-cta" onClick={closeMenu}>
                🔐 Connexion
              </Link>
            ) : null}
          </nav>
        </div>
      </div>
    </header>
  );
}
