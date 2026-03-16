"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import styles from "../login/login.module.css";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError(
        "Le lien de réinitialisation semble invalide ou incomplet. Merci de refaire une demande depuis la page \"Mot de passe oublié\"."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const password = (formData.get("password") ?? "").toString();
      const confirmPassword = (formData.get("confirmPassword") ?? "").toString();

      if (!password || !confirmPassword) {
        setError("Merci de renseigner et confirmer votre nouveau mot de passe.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Les deux mots de passe ne correspondent pas.");
        return;
      }

      if (password.length < 8) {
        setError(
          "Votre mot de passe doit contenir au minimum 8 caractères."
        );
        return;
      }

      const client = authClient as any;

      await client.emailAndPassword.resetPassword({
        token,
        password,
      });

      setSuccess(
        "Votre mot de passe a bien été mis à jour. Vous allez être redirigé(e) vers la page de connexion."
      );

      setTimeout(() => {
        router.push("/login");
      }, 2500);
    } catch {
      setError(
        "Impossible de réinitialiser votre mot de passe. Le lien a peut-être expiré ou a déjà été utilisé. Merci de refaire une demande depuis la page \"Mot de passe oublié\"."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasToken = Boolean(token);

  return (
    <main className={styles.page}>
      <section className={styles.layout}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Alternance Hunter</p>
          <h1 className={styles.title}>🔐 Définir un nouveau mot de passe</h1>
          <p className={styles.subtitle}>
            Choisis un nouveau mot de passe pour ton compte Alternance Hunter.
            Ce lien de réinitialisation est limité dans le temps pour des raisons
            de sécurité.
          </p>
          <p className={styles.helperText}>
            Si le lien ne fonctionne plus,{" "}
            <Link href="/forgot-password" className={styles.helperLink}>
              refais une demande de mot de passe oublié
            </Link>
            .
          </p>
        </div>

        <div className={styles.card} aria-label="Formulaire de nouveau mot de passe">
          <h2 className={styles.cardTitle}>🔐 Nouveau mot de passe</h2>
          <p className={styles.cardText}>
            Ton nouveau mot de passe doit contenir au minimum 8 caractères. Évite
            de réutiliser un mot de passe déjà utilisé ailleurs.
          </p>

          {!hasToken ? (
            <p role="alert" className={styles.error}>
              Le lien de réinitialisation fourni est invalide. Merci de refaire
              une demande depuis la page{" "}
              <Link href="/forgot-password" className={styles.formLink}>
                Mot de passe oublié
              </Link>
              .
            </p>
          ) : (
            <form className={styles.form} onSubmit={onSubmit}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="password">
                  Nouveau mot de passe
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  className={styles.input}
                  placeholder="Votre nouveau mot de passe"
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="confirmPassword">
                  Confirmer le mot de passe
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  className={styles.input}
                  placeholder="Retapez votre mot de passe"
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
                    ? "Mise à jour du mot de passe..."
                    : "Mettre à jour le mot de passe"}
                </button>
                <div className={styles.links}>
                  <Link href="/login" className={styles.formLink}>
                    Retour à la connexion
                  </Link>
                </div>
              </div>
            </form>
          )}

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

