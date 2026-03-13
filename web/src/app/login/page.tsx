"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import styles from "./login.module.css";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSignIn() {
    setError("");
    setIsLoading(true);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });

      if (result?.error?.message) {
        setError(result.error.message);
      }
    } catch {
      setError("Impossible de demarrer la connexion Google.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.layout}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Alternance Automation</p>
          <h1 className={styles.title}>
            Connecte ton compte Google pour lancer le dashboard.
          </h1>
          <p className={styles.subtitle}>
            L&apos;authentification se fait via Google pour te permettre de générer et suivre
            tes brouillons de candidatures directement dans Gmail, avec des logs détaillés.
          </p>
          <ul className={styles.points}>
            <li>Accès au pipeline complet de candidatures d&apos;alternance.</li>
            <li>Création de brouillons Gmail traçables avant tout envoi.</li>
            <li>Dashboard temps réel pour suivre chaque exécution.</li>
          </ul>
          <p className={styles.helperText}>
            Tu peux toujours revenir à l&apos;accueil pour revoir le fonctionnement de
            l&apos;outil{" "}
            <Link href="/" className={styles.helperLink}>
              depuis la landing
            </Link>
            .
          </p>
        </div>

        <div className={styles.card} aria-label="Connexion au dashboard">
          <h2 className={styles.cardTitle}>Connexion requise</h2>
          <p className={styles.cardText}>
            Utilise ton compte Google autorisé pour accéder au dashboard Alternance Automation.
          </p>
          <button
            type="button"
            onClick={onSignIn}
            disabled={isLoading}
            className={`${styles.button} ${isLoading ? styles.buttonDisabled : ""}`}
          >
            {isLoading ? "Connexion en cours..." : "Se connecter avec Google"}
          </button>
          {error ? (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          ) : null}
          <p className={styles.cardHint}>
            L&apos;application ne déclenche pas d&apos;envoi automatique : tous les emails sont
            générés comme brouillons dans Gmail pour relecture avant envoi.
          </p>
        </div>
      </section>
    </main>
  );
}
