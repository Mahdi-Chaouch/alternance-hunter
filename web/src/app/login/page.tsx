"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { GoogleLogo } from "@/app/components/GoogleLogo";
import styles from "./login.module.css";

export default function LoginPage() {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [error, setError] = useState("");

  async function onGoogleSignIn() {
    setError("");
    setIsGoogleLoading(true);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });

      if (result?.error?.message) {
        setError(result.error.message);
      }
    } catch {
      setError("Impossible de démarrer la connexion Google.");
    } finally {
      setIsGoogleLoading(false);
    }
  }

  async function onEmailSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsEmailLoading(true);

    try {
      const formData = new FormData(event.currentTarget);
      const email = (formData.get("email") ?? "").toString().trim();
      const password = (formData.get("password") ?? "").toString();

      if (!email || !password) {
        setError("Merci de renseigner votre email et votre mot de passe.");
        return;
      }

      const { error: authError } = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/dashboard",
      });

      if (authError?.message) {
        setError(authError.message);
      }
    } catch {
      setError("Impossible de se connecter avec cet email pour le moment.");
    } finally {
      setIsEmailLoading(false);
    }
  }

  const isAnyLoading = isGoogleLoading || isEmailLoading;

  return (
    <main className={styles.page}>
      <section className={styles.layout}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Alternance Hunter</p>
          <h1 className={styles.title}>
            🔐 Connecte-toi pour lancer le dashboard.
          </h1>
          <p className={styles.subtitle}>
            Tu peux te connecter avec ton compte Google ou avec ton email et un
            mot de passe, tout en gardant la génération de brouillons Gmail
            traçables avant envoi.
          </p>
          <ul className={styles.points}>
            <li>📋 Accès au pipeline complet de candidatures d&apos;alternance.</li>
            <li>✉️ Création de brouillons Gmail traçables avant tout envoi.</li>
            <li>📊 Dashboard temps réel pour suivre chaque exécution.</li>
          </ul>
          <p className={styles.helperText}>
            Tu peux toujours revenir à l&apos;accueil pour voir comment envoyer
            des mails avec l&apos;outil{" "}
            <Link href="/" className={styles.helperLink}>
              depuis la landing
            </Link>
            .
          </p>
        </div>

        <div className={styles.card} aria-label="Connexion au dashboard">
          <h2 className={styles.cardTitle}>🔐 Connexion requise</h2>
          <p className={styles.cardText}>
            Utilise ton compte Google autorisé ou tes identifiants email /
            mot de passe pour accéder au dashboard Alternance Hunter.
          </p>

          <button
            type="button"
            onClick={onGoogleSignIn}
            disabled={isAnyLoading}
            className={`${styles.button} ${
              isAnyLoading ? styles.buttonDisabled : ""
            }`}
          >
            {isGoogleLoading ? (
              "Connexion Google en cours..."
            ) : (
              <>
                <GoogleLogo size={20} />
                Se connecter avec Google
              </>
            )}
          </button>

          <hr className={styles.divider} />

          <form className={styles.form} onSubmit={onEmailSignIn}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                className={styles.input}
                placeholder="prenom.nom@email.com"
                disabled={isAnyLoading}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">
                Mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                className={styles.input}
                placeholder="Votre mot de passe"
                disabled={isAnyLoading}
                required
              />
            </div>

            <div className={styles.formActions}>
              <button
                type="submit"
                disabled={isAnyLoading}
                className={`${styles.button} ${
                  isAnyLoading ? styles.buttonDisabled : ""
                }`}
              >
                {isEmailLoading
                  ? "Connexion email en cours..."
                  : "Se connecter avec email"}
              </button>
              <div className={styles.links}>
                <Link href="/signup" className={styles.formLink}>
                  Créer un compte
                </Link>
                <Link href="/forgot-password" className={styles.formLink}>
                  Mot de passe oublié ?
                </Link>
              </div>
            </div>
          </form>

          {error ? (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          ) : null}

          <p className={styles.cardHint}>
            L&apos;application ne déclenche pas d&apos;envoi automatique : tous
            les emails sont générés comme brouillons dans Gmail pour relecture
            avant envoi.
          </p>
        </div>
      </section>
    </main>
  );
}
