"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "alternance-ui-theme";
type Theme = "light" | "dark";

export function FloatingActions() {
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_KEY);
    const initial: Theme = saved === "dark" || saved === "light" ? saved : "light";
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    window.localStorage.setItem(THEME_KEY, next);
    document.documentElement.dataset.theme = next;
    window.dispatchEvent(new CustomEvent("alternance-theme-change", { detail: next }));
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <button
        type="button"
        onClick={toggleTheme}
        className="floating-theme"
        title={theme === "light" ? "Mode sombre" : "Mode clair"}
        aria-label={theme === "light" ? "Passer en mode sombre" : "Passer en mode clair"}
      >
        {theme === "light" ? "🌙" : "☀️"}
      </button>
      {showBackToTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="floating-back-to-top"
          title="Revenir en haut"
          aria-label="Revenir en haut de la page"
        >
          ↑
        </button>
      )}
    </>
  );
}
