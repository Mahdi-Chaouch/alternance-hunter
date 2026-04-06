"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import styles from "./support.module.css";

type ThemeMode = "light" | "dark";

const FAQS = [
  {
    q: "Comment connecter mon Gmail ?",
    a: "Depuis le Dashboard, descendez jusqu'à la section « Connexion Gmail » et cliquez sur « Connecter Gmail ». Autorisez les permissions Gmail (lecture + composition) sur votre compte Google.",
  },
  {
    q: "Pourquoi le bouton « Candidater » est grisé dans l'Explorer ?",
    a: "Le bouton est désactivé si l'entreprise n'a aucun contact email détecté. Lancez d'abord une recherche depuis le Dashboard pour alimenter la base de données.",
  },
  {
    q: "Comment créer un brouillon Gmail depuis une offre France Travail ?",
    a: "Sur les pages /stages et /explorer (onglet France Travail), cliquez sur « Brouillon ». Vous devez avoir uploadé votre CV dans votre Profil et connecté votre compte Gmail.",
  },
  {
    q: "Mes brouillons Gmail ne sont pas créés, que faire ?",
    a: "Vérifiez que votre CV est uploadé (Profil > Documents), que Gmail est connecté, et que votre template de lettre est déposé si vous utilisez le mode « pipeline » ou « generate ».",
  },
  {
    q: "Comment suivre mes candidatures ?",
    a: "Toutes vos candidatures (pipeline, Explorer, France Travail) apparaissent dans le Dashboard > Suivi. Vous pouvez mettre à jour leur statut (envoyé, relance, réponse positive/négative).",
  },
  {
    q: "La recherche tourne mais ne trouve rien, pourquoi ?",
    a: "Essayez une zone plus large (ex: « Paris » au lieu d'une commune spécifique), augmentez le nombre de sites maximum, ou changez de secteur. La base enrichit avec chaque recherche.",
  },
];

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
      <div className={styles.inner}>

        {/* ── LEFT: intro + FAQ ── */}
        <div className={styles.left}>
          <div>
            <span className={styles.badge}>Support</span>
            <h1 className={styles.heading} style={{ marginTop: "0.75rem" }}>
              Besoin d&apos;aide ?
            </h1>
            <p className={styles.subheading} style={{ marginTop: "0.6rem" }}>
              Notre équipe te répond en moins de 24h. Décris ton problème et on s&apos;occupe du reste.
            </p>
            <div className={styles.trust} style={{ marginTop: "1rem" }}>
              <span className={styles.trustItem}>
                <span className={styles.trustDot} style={{ background: "#6366f1" }} />
                Support humain
              </span>
              <span className={styles.trustItem}>
                <span className={styles.trustDot} style={{ background: "#10b981" }} />
                Réponse &lt; 24h
              </span>
            </div>
          </div>

          <div>
            <p style={{ fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#8b5cf6", marginBottom: "0.8rem" }}>
              Questions fréquentes
            </p>
            <div className={styles.faqList}>
              {FAQS.map((faq, i) => (
                <details key={i} className={styles.faqItem}>
                  <summary className={styles.faqSummary}>
                    {faq.q}
                    <span className={styles.faqIcon}>+</span>
                  </summary>
                  <p className={styles.faqAnswer}>{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: form card ── */}
        <div className={styles.right}>
          <div className={styles.card}>
            {status === "success" ? (
              <div className={styles.success} role="status">
                <div className={styles.successIcon}>✓</div>
                <p className={styles.successTitle}>Message envoyé !</p>
                <p className={styles.successSub}>Merci — nous vous répondrons sur l&apos;adresse indiquée.</p>
                <button type="button" className={styles.resetBtn} onClick={() => setStatus("idle")}>
                  Envoyer un autre message
                </button>
              </div>
            ) : (
              <>
                <p className={styles.cardTitle}>Contacte-nous</p>
                <p className={styles.cardSub}>Remplis ce formulaire et on revient vers toi rapidement.</p>
                <form className={styles.form} onSubmit={(e) => void onSubmit(e)} noValidate>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="support-email-field">
                      {sessionEmail ? "E-mail (compte connecté)" : <>E-mail <span aria-hidden="true">*</span></>}
                    </label>
                    <input
                      id="support-email-field"
                      type="email"
                      className={styles.input}
                      value={sessionEmail || email}
                      onChange={sessionEmail ? undefined : (e) => setEmail(e.target.value)}
                      readOnly={!!sessionEmail}
                      autoComplete="email"
                      required={!sessionEmail}
                      placeholder="vous@exemple.fr"
                      tabIndex={sessionEmail ? -1 : undefined}
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="support-subject">
                      Sujet <span className={styles.optional}>(optionnel)</span>
                    </label>
                    <input
                      id="support-subject"
                      type="text"
                      className={styles.input}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      maxLength={200}
                      placeholder="Ex. Problème de synchronisation Gmail"
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="support-message">
                      Message <span aria-hidden="true">*</span>
                    </label>
                    <textarea
                      id="support-message"
                      className={styles.textarea}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                      rows={6}
                      minLength={8}
                      maxLength={4000}
                      placeholder="Décris ta situation en quelques phrases…"
                    />
                    <p className={styles.hint}>{message.length} / 4000 caractères</p>
                  </div>

                  {errorText && (
                    <div className={styles.error} role="alert">{errorText}</div>
                  )}

                  <div className={styles.actions}>
                    <button type="submit" className={styles.submitBtn} disabled={status === "sending"}>
                      {status === "sending" ? "Envoi en cours…" : <>Envoyer le message →</>}
                    </button>
                    <Link href="/" className={styles.backLink}>
                      ← Retour
                    </Link>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
