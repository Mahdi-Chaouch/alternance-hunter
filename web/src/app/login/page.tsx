"use client";

import { useState } from "react";
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
      <section className={styles.card}>
        <h1 className={styles.title}>Connexion requise</h1>
        <p>Connectez-vous avec votre compte Google invite pour acceder au dashboard.</p>
        <button
          type="button"
          onClick={onSignIn}
          disabled={isLoading}
          className={`${styles.button} ${isLoading ? styles.buttonDisabled : ""}`}
        >
          {isLoading ? "Connexion..." : "Se connecter avec Google"}
        </button>
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
