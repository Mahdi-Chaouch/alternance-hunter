"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import styles from "../page.module.css";

type ThemeMode = "light" | "dark";

export default function SupportPage() {
  const { data: session } = authClient.useSession();
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [subject, setSubject] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("alternance-ui-theme");
    const initial: ThemeMode = saved === "dark" || saved === "light" ? saved : "light";
    setTheme(initial);
    const onThemeChange = (e: Event) => {
      const ev = e as CustomEvent<ThemeMode>;
      if (ev.detail === "dark" || ev.detail === "light") setTheme(ev.detail);
    };
    window.addEventListener("alternance-theme-change", onThemeChange);
    return () => window.removeEventListener("alternance-theme-change", onThemeChange);
  }, []);

  const sessionEmail = session?.user?.email?.trim() ?? "";

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setStatus("sending");
      setErrorText(null);
      try {
        const res = await fetch("/api/support", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: subject.trim() || undefined,
            message: message.trim(),
            email: sessionEmail ? undefined : email.trim() || undefined,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setStatus("error");
          setErrorText(typeof data.error === "string" ? data.error : "Envoi impossible.");
          return;
        }
        setStatus("success");
        setSubject("");
        setMessage("");
        if (!sessionEmail) setEmail("");
      } catch {
        setStatus("error");
        setErrorText("Erreur réseau. Réessayez.");
      }
    },
    [subject, message, email, sessionEmail],
  );

  return (
    <div className={`${styles.page} ${theme === "dark" ? styles.pageDark : ""}`}>
      <main className={styles.main}>
        <header className={styles.headerCard}>
          <div>
            <p className={styles.eyebrow}>Aide</p>
            <h1>Support</h1>
            <p className={styles.panelHint}>
              Décrivez votre question ou votre problème. Le message est transmis à l&apos;équipe via notre canal
              interne.
            </p>
          </div>
        </header>

        <section className={`${styles.panel} ${styles.supportPanel}`}>
          {status === "success" ? (
            <div className={styles.supportSuccess} role="status">
              <p className={styles.supportSuccessTitle}>Message envoyé</p>
              <p className={styles.panelHint}>Merci — nous vous répondrons sur l&apos;adresse indiquée.</p>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setStatus("idle")}
              >
                Envoyer un autre message
              </button>
            </div>
          ) : (
            <form className={styles.supportForm} onSubmit={(e) => void onSubmit(e)} noValidate>
              {sessionEmail ? (
                <div className={styles.supportField}>
                  <label className={styles.supportLabel} htmlFor="support-email-readonly">
                    E-mail (compte connecté)
                  </label>
                  <input
                    id="support-email-readonly"
                    type="email"
                    className={styles.supportInput}
                    value={sessionEmail}
                    readOnly
                    tabIndex={-1}
                    aria-readonly="true"
                  />
                </div>
              ) : (
                <div className={styles.supportField}>
                  <label className={styles.supportLabel} htmlFor="support-email">
                    E-mail <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="support-email"
                    type="email"
                    className={styles.supportInput}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    placeholder="vous@exemple.fr"
                  />
                </div>
              )}

              <div className={styles.supportField}>
                <label className={styles.supportLabel} htmlFor="support-subject">
                  Sujet <span className={styles.supportOptional}>(optionnel)</span>
                </label>
                <input
                  id="support-subject"
                  type="text"
                  className={styles.supportInput}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={200}
                  placeholder="Ex. Problème de synchronisation Gmail"
                />
              </div>

              <div className={styles.supportField}>
                <label className={styles.supportLabel} htmlFor="support-message">
                  Message <span aria-hidden="true">*</span>
                </label>
                <textarea
                  id="support-message"
                  className={styles.supportTextarea}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={8}
                  minLength={8}
                  maxLength={4000}
                  placeholder="Décrivez votre situation en quelques phrases…"
                />
                <p className={styles.supportHint}>{message.length} / 4000 caractères (minimum 8)</p>
              </div>

              {errorText ? (
                <div className={styles.candidatureSyncError} role="alert">
                  {errorText}
                </div>
              ) : null}

              <div className={styles.supportActions}>
                <button type="submit" className={styles.primaryBtn} disabled={status === "sending"}>
                  {status === "sending" ? "Envoi…" : "Envoyer"}
                </button>
                <Link href="/" className={`${styles.secondaryBtn} ${styles.supportBackLink}`}>
                  Retour à l&apos;accueil
                </Link>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
