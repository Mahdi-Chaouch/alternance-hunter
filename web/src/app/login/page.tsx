"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { GoogleLogo } from "@/app/components/GoogleLogo";
import styles from "./login.module.css";

export default function LoginPage() {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
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

  return (
    <main className={styles.page}>
      <section className={styles.layout}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Alternance Hunter</p>
          <h1 className={styles.title}>
            🔐 Connecte-toi pour lancer le dashboard.
          </h1>
          <p className={styles.subtitle}>
            Utilise ton compte Google pour accéder au dashboard et générer des
            brouillons Gmail traçables avant tout envoi.
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
            Connecte-toi uniquement avec le compte Google autorisé pour accéder
            à Alternance Hunter.
          </p>

          <button
            type="button"
            onClick={onGoogleSignIn}
            disabled={isGoogleLoading}
            className={`${styles.button} ${
              isGoogleLoading ? styles.buttonDisabled : ""
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
