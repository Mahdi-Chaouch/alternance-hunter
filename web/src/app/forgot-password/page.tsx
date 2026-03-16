"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import styles from "../login/login.module.css";

export default function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const email = (formData.get("email") ?? "").toString().trim();

      if (!email) {
        setError("Merci de renseigner votre adresse email.");
        return;
      }

      const client = authClient as any;

      await client.emailAndPassword.requestPasswordReset({
        email,
      });

      setSuccess(
        "Si un compte existe pour cette adresse, un email de réinitialisation vient d'être envoyé. Pense à vérifier tes spams."
      );
    } catch {
      setError(
        "Impossible de traiter la demande de réinitialisation pour le moment. Réessaie dans quelques instants."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.layout}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Alternance Hunter</p>
          <h1 className={styles.title}>🔑 Mot de passe oublié</h1>
          <p className={styles.subtitle}>
            Indique l&apos;adresse email utilisée pour ton compte Alternance
            Hunter. Si un compte existe, tu recevras un lien pour définir un
            nouveau mot de passe.
          </p>
          <p className={styles.helperText}>
            Pour revenir à la connexion classique,{" "}
            <Link href="/login" className={styles.helperLink}>
              retourne à la page de login
            </Link>
            .
          </p>
        </div>

        <div className={styles.card} aria-label="Demande de réinitialisation de mot de passe">
          <h2 className={styles.cardTitle}>🔑 Réinitialiser ton mot de passe</h2>
          <p className={styles.cardText}>
            Entre l&apos;email de ton compte Alternance Hunter pour recevoir un
            lien sécurisé de réinitialisation. Pour des raisons de sécurité, le
            message reste le même qu&apos;un compte existe ou non.
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
                disabled={isSubmitting}
                required
              />
            </div>

            <div className={styles.formActions}>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`${styles.button} ${
                  isSubmitting ? styles.buttonDisabled : ""
                }`}
              >
                {isSubmitting
                  ? "Envoi du lien en cours..."
                  : "Envoyer le lien de réinitialisation"}
              </button>
              <div className={styles.links}>
                <Link href="/login" className={styles.formLink}>
                  Retour à la connexion
                </Link>
              </div>
            </div>
          </form>

          {error ? (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          ) : null}

          {success ? (
            <p role="status" className={styles.cardHint}>
              {success}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

