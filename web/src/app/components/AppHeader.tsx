"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Search,
  Home,
  User,
  LogIn,
  LogOut,
  ExternalLink,
  List,
  LayoutDashboard,
  X,
  MessageCircle,
  Briefcase,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
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

  const pathname = usePathname();
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
    <>
    {/* Menu mobile hors du header : sinon backdrop-filter sur .app-header casse position:fixed (overlay pas plein écran). */}
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-brand">
          <Link href="/" className="app-brand-link" onClick={closeMenu}>
            <Image
              src="/logo.png"
              alt="Alternance Hunter"
              className="app-brand-logo"
              width={36}
              height={36}
              priority
            />
            <span className="app-brand-text">Alternance Hunter</span>
          </Link>
        </div>
        <nav className="app-nav" aria-label="Navigation principale">
          <Link href="/" className={`app-nav-link${pathname === '/' ? ' app-nav-link-active' : ''}`}>
            <Home size={14} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />Accueil
          </Link>
          {isConnected ? (
            <>
              <Link href="/explorer" className={`app-nav-link${pathname?.startsWith('/explorer') ? ' app-nav-link-active' : ''}`}>
                <Search size={14} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />Explorer
              </Link>
              <Link href="/dashboard" className={`app-nav-link${pathname?.startsWith('/dashboard') ? ' app-nav-link-active' : ''}`}>
                <LayoutDashboard size={14} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />Dashboard
              </Link>
            </>
          ) : (
            <Link href="/login" className={`app-nav-link${pathname?.startsWith('/login') ? ' app-nav-link-active' : ''}`}>
              <LogIn size={14} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />Connexion
            </Link>
          )}
          <Link href="/support" className={`app-nav-link${pathname?.startsWith('/support') ? ' app-nav-link-active' : ''}`}>
            <MessageCircle size={14} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />Support
          </Link>
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
                    <User size={14} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Mon profil
                  </Link>
                  <Link
                    href="/stages"
                    className="app-header-profil-dropdown-item"
                    role="menuitem"
                    onClick={() => setProfilDropdownOpen(false)}
                  >
                    <Briefcase size={14} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Stages
                  </Link>
                  <Link
                    href="/profil#candidatures"
                    className="app-header-profil-dropdown-item"
                    role="menuitem"
                    onClick={() => setProfilDropdownOpen(false)}
                  >
                    <List size={14} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Suivi de candidatures
                  </Link>
                  <a
                    href="https://github.com/Mahdi-Chaouch/alternance-killer"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="app-header-profil-dropdown-item"
                    role="menuitem"
                    onClick={() => setProfilDropdownOpen(false)}
                  >
                    <ExternalLink size={14} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />GitHub
                  </a>
                  <button
                    type="button"
                    className="app-header-profil-dropdown-item app-header-profil-dropdown-item-signout"
                    role="menuitem"
                    onClick={() => void handleSignOut()}
                  >
                    <LogOut size={14} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Déconnexion
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <Link href="/login" className="app-header-button">
              <LogIn size={14} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Connexion
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
            aria-expanded={menuOpen}
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
            aria-expanded={menuOpen}
          >
            <span className="app-burger-bar" />
            <span className="app-burger-bar" />
            <span className="app-burger-bar" />
          </button>
        </div>
      </div>
    </header>
      <div
        id="app-mobile-menu"
        className={`app-mobile-menu ${menuOpen ? "app-mobile-menu-open" : ""}`}
        aria-hidden={!menuOpen}
      >
        <div className="app-mobile-menu-backdrop" onClick={closeMenu} aria-hidden="true" />
        <div className="app-mobile-menu-panel" role="dialog" aria-modal="true" aria-label="Menu de navigation">
          <div className="app-mobile-menu-header">
            <Link href="/" className="app-brand-link" onClick={closeMenu}>
              <Image src="/logo.png" alt="Alternance Hunter" className="app-brand-logo" width={28} height={28} priority />
              <span className="app-brand-text" style={{ fontSize: '0.85rem' }}>Alternance Hunter</span>
            </Link>
            <button type="button" className="app-mobile-menu-close" onClick={closeMenu} aria-label="Fermer le menu">
              <X size={20} />
            </button>
          </div>
          <nav className="app-mobile-nav" aria-label="Menu mobile">
            <Link href="/" className="app-mobile-nav-link" onClick={closeMenu}>
              <Home size={14} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Accueil
            </Link>
            {isConnected ? (
              <>
                <Link href="/explorer" className="app-mobile-nav-link" onClick={closeMenu}>
                  <Search size={14} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Explorer les entreprises
                </Link>
                <Link href="/dashboard" className="app-mobile-nav-link" onClick={closeMenu}>
                  <LayoutDashboard size={14} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Dashboard
                </Link>
                <Link href="/stages" className="app-mobile-nav-link" onClick={closeMenu}>
                  <Briefcase size={14} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Stages
                </Link>
                <Link href="/profil" className="app-mobile-nav-link" onClick={closeMenu}>
                  <User size={14} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Mon profil
                </Link>
                <Link href="/profil#candidatures" className="app-mobile-nav-link" onClick={closeMenu}>
                  <List size={14} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Suivi de candidatures
                </Link>
                <a
                  href="https://github.com/Mahdi-Chaouch/alternance-killer"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="app-mobile-nav-link"
                  onClick={closeMenu}
                >
                  <ExternalLink size={14} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />GitHub
                </a>
                <button
                  type="button"
                  className="app-mobile-nav-link app-mobile-nav-signout"
                  onClick={() => void handleSignOut()}
                >
                  <LogOut size={14} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Déconnexion
                </button>
              </>
            ) : (
              <Link href="/login" className="app-mobile-nav-link" onClick={closeMenu}>
                <LogIn size={14} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Connexion
              </Link>
            )}
            <Link href="/support" className="app-mobile-nav-link" onClick={closeMenu}>
              <MessageCircle size={14} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Support
            </Link>
          </nav>
        </div>
      </div>
    </>
  );
}
