"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Mail, CheckCircle } from "lucide-react";
import styles from "../login/login.module.css";

export default function VerifyEmailPage() {
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError((data.detail as string) || "Impossible de vérifier ce code.");
        return;
      }

      setSuccess("Ton email est vérifié. Tu peux maintenant te connecter.");
      setCode("");
    } catch {
      setError("Erreur réseau pendant la vérification. Réessaie dans un instant.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.layout}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Alternance Hunter</p>
          <h1 className={styles.title}><Mail size={28} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />Vérifie ton adresse email</h1>
          <p className={styles.subtitle}>
            Colle le code de vérification que tu as reçu par email pour activer
            ton compte Alternance Hunter.
          </p>
          <p className={styles.helperText}>
            Tu n&apos;as pas reçu le mail ? Vérifie tes spams ou{" "}
            <Link href="/login" className={styles.helperLink}>
              retourne à la connexion
            </Link>{" "}
            pour renvoyer un email de vérification en te reconnectant.
          </p>
        </div>

        <div className={styles.card} aria-label="Vérification de compte">
          <h2 className={styles.cardTitle}>Entrer ton code</h2>
          <p className={styles.cardText}>
            Copie le code indiqué dans l&apos;email de confirmation. Le code est
            sensible aux caractères, pense à bien tout sélectionner.
          </p>

          <form className={styles.form} onSubmit={onSubmit}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="code">
                Code de vérification
              </label>
              <textarea
                id="code"
                name="code"
                rows={3}
                className={styles.input}
                placeholder="Colle ici le code reçu par email"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`${styles.button} ${
                isSubmitting ? styles.buttonDisabled : ""
              }`}
            >
              {isSubmitting ? "Vérification en cours..." : "Vérifier mon compte"}
            </button>
          </form>

          {error ? (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          ) : null}

          {success ? (
            <p role="status" className={styles.cardHint}>
              <CheckCircle size={16} />{success}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

