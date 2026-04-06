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

  const faqs = [
    {
      q: "Pourquoi l'API France Travail ne retourne rien ?",
      a: "Vérifiez que FRANCE_TRAVAIL_CLIENT_ID, FRANCE_TRAVAIL_CLIENT_SECRET et FRANCE_TRAVAIL_SCOPE sont bien définis dans les variables d'environnement Render. Le scope doit contenir 'api_offresdemploiv2 o2dsoffre'. Redéployez après toute modification.",
    },
    {
      q: "Comment créer un brouillon Gmail depuis une offre France Travail ?",
      a: "Sur les pages /stages et /explorer (onglet France Travail), cliquez sur 'Brouillon'. Vous devez avoir uploadé votre CV dans votre Profil et connecté votre compte Gmail depuis le Dashboard.",
    },
    {
      q: "Pourquoi le bouton 'Candidater' est grisé dans l'Explorer ?",
      a: "Le bouton est désactivé si l'entreprise n'a aucun contact email détecté. Lancez d'abord une recherche depuis le Dashboard pour alimenter la base de données.",
    },
    {
      q: "Comment connecter mon Gmail ?",
      a: "Depuis le Dashboard, descendez jusqu'à la section 'Connexion Gmail' et cliquez sur 'Connecter Gmail'. Autorisez les permissions Gmail (lecture + composition) sur votre compte Google.",
    },
    {
      q: "Mes brouillons Gmail ne sont pas créés, que faire ?",
      a: "Vérifiez que votre CV est uploadé (Profil > Documents), que Gmail est connecté, et que votre template de lettre est déposé si vous utilisez le mode 'pipeline' ou 'generate'.",
    },
    {
      q: "Comment suivre mes candidatures ?",
      a: "Toutes vos candidatures (pipeline, Explorer, France Travail) apparaissent dans le Dashboard > Suivi. Vous pouvez mettre à jour leur statut (envoyé, relance, réponse positive/négative).",
    },
    {
      q: "La recherche tourne mais ne trouve rien, pourquoi ?",
      a: "Essayez une zone plus large (ex: 'Paris' au lieu d'une commune spécifique), augmentez le nombre de sites maximum, ou changez de secteur. La base de données partagée s'enrichit avec chaque recherche.",
    },
  ];

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

        <section className={styles.panel}>
          <h2 style={{ marginBottom: "1.2rem" }}>Questions fréquentes</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {faqs.map((faq, i) => (
              <details key={i} style={{ borderBottom: "1px solid rgba(139,92,246,0.15)", paddingBottom: "0.8rem" }}>
                <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.95rem", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  {faq.q}
                  <span style={{ color: "#8b5cf6", marginLeft: "0.5rem", fontSize: "1.1rem" }}>+</span>
                </summary>
                <p className={styles.panelHint} style={{ marginTop: "0.6rem", marginBottom: 0 }}>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

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

              <div className={`${styles.supportField} ${styles.supportMessageField}`}>
                <label className={styles.supportLabel} htmlFor="support-message">
                  Message <span aria-hidden="true">*</span>
                </label>
                <textarea
                  id="support-message"
                  className={styles.supportTextarea}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={20}
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
