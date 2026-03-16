"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import styles from "../login/login.module.css";

export default function SignupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const formData = new FormData(event.currentTarget);
      const email = (formData.get("email") ?? "").toString().trim();
      const password = (formData.get("password") ?? "").toString();
      const name = email ? email.split("@")[0] ?? "" : "";

      if (!email || !password) {
        setError("Merci de renseigner un email et un mot de passe.");
        return;
      }

      const { error: authError } = await authClient.signUp.email({
        email,
        name,
        password,
        callbackURL: "/dashboard",
      });

      if (authError?.message) {
        setError(authError.message);
      } else {
        setSuccessMessage(
          "Compte créé avec succès. Redirection vers le dashboard en cours..."
        );
      }
    } catch {
      setError("Impossible de créer le compte pour le moment.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.layout}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Alternance Hunter</p>
          <h1 className={styles.title}>📝 Crée ton compte Alternance Hunter</h1>
          <p className={styles.subtitle}>
            Inscris-toi avec ton email et un mot de passe pour accéder au
            dashboard et gérer tes candidatures, avec la possibilité
            d&apos;utiliser ensuite Google pour la génération de brouillons
            Gmail.
          </p>
        </div>

        <div className={styles.card} aria-label="Création de compte">
          <h2 className={styles.cardTitle}>Créer un compte</h2>
          <p className={styles.cardText}>
            Utilise une adresse email autorisée et choisis un mot de passe
            sécurisé. Tu pourras ensuite accéder directement au dashboard.
          </p>

          <form className={styles.form} onSubmit={onSubmit}>
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
                disabled={isLoading}
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
                autoComplete="new-password"
                className={styles.input}
                placeholder="Au moins 8 caractères"
                disabled={isLoading}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`${styles.button} ${
                isLoading ? styles.buttonDisabled : ""
              }`}
            >
              {isLoading ? "Création du compte..." : "Créer mon compte"}
            </button>
          </form>

          {error ? (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          ) : null}
          {successMessage ? (
            <p className={styles.cardHint}>{successMessage}</p>
          ) : (
            <p className={styles.cardHint}>
              Tu as déjà un compte ?{" "}
              <Link href="/login" className={styles.formLink}>
                Revenir à la connexion
              </Link>
              .
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

