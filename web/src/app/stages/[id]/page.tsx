"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Briefcase, CheckCircle, ExternalLink } from "lucide-react";
import styles from "../stages.module.css";

type OffreDetail = {
  id: string;
  intitule: string;
  entreprise?: { nom?: string; description?: string };
  lieuTravail?: { libelle?: string };
  typeContratLibelle?: string;
  dateCreation?: string;
  description?: string;
  origineOffre?: { urlOrigine?: string };
  salaire?: { libelle?: string };
  dureeTravailLibelleConverti?: string;
};

export default function StageDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [offre, setOffre] = useState<OffreDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    fetch(`/api/stages/${encodeURIComponent(params.id)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.detail ?? "Erreur serveur");
        } else {
          setOffre(data);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur réseau"))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleAjouter = useCallback(async () => {
    if (!offre) return;
    setAdding(true);
    try {
      const res = await fetch("/api/candidatures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: offre.entreprise?.nom ?? offre.intitule,
          email: `ft:${offre.id}`,
          status: "draft_created",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail ?? "Erreur lors de l'ajout.", "error");
      } else {
        setAdded(true);
        showToast("Ajouté au suivi de candidatures !", "success");
      }
    } catch {
      showToast("Erreur réseau.", "error");
    } finally {
      setAdding(false);
    }
  }, [offre, showToast]);

  return (
    <div className={styles.page} style={{ maxWidth: 760 }}>
      <button
        className={styles.voirBtn}
        onClick={() => router.back()}
        style={{ marginBottom: "1.5rem", display: "inline-flex" }}
      >
        <ArrowLeft size={14} /> Retour
      </button>

      {loading && <div className={styles.loading}>Chargement de l&apos;offre…</div>}

      {error && (
        <div className={styles.infoBanner} style={{ color: "#991b1b" }}>
          {error}
        </div>
      )}

      {offre && (
        <>
          <h1 className={styles.title} style={{ fontSize: "1.6rem" }}>{offre.intitule}</h1>

          {offre.entreprise?.nom && (
            <p className={styles.cardCompany} style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>
              {offre.entreprise.nom}
            </p>
          )}

          <div className={styles.cardMeta} style={{ marginBottom: "1.25rem" }}>
            {offre.lieuTravail?.libelle && (
              <span className={`${styles.badge} ${styles.badgeGray}`}>
                <MapPin size={12} /> {offre.lieuTravail.libelle}
              </span>
            )}
            {offre.typeContratLibelle && (
              <span className={styles.badge}>
                <Briefcase size={12} /> {offre.typeContratLibelle}
              </span>
            )}
            {offre.salaire?.libelle && (
              <span className={`${styles.badge} ${styles.badgeGray}`}>{offre.salaire.libelle}</span>
            )}
            {offre.dureeTravailLibelleConverti && (
              <span className={`${styles.badge} ${styles.badgeGray}`}>{offre.dureeTravailLibelleConverti}</span>
            )}
          </div>

          {offre.description && (
            <div
              style={{
                fontSize: "0.93rem",
                lineHeight: 1.65,
                color: "var(--color-fg)",
                marginBottom: "1.5rem",
                whiteSpace: "pre-wrap",
              }}
            >
              {offre.description}
            </div>
          )}

          {offre.entreprise?.description && (
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                À propos de l&apos;entreprise
              </h2>
              <p style={{ fontSize: "0.9rem", color: "var(--subtle-text, #6b7280)", lineHeight: 1.5 }}>
                {offre.entreprise.description}
              </p>
            </div>
          )}

          <div className={styles.cardActions} style={{ maxWidth: 400 }}>
            <button
              className={`${styles.candidaterBtn} ${added ? styles.candidaterBtnDone : ""}`}
              disabled={adding || added}
              onClick={handleAjouter}
            >
              {added ? (
                <><CheckCircle size={15} /> Ajouté au suivi</>
              ) : adding ? (
                "Ajout…"
              ) : (
                "Ajouter au suivi"
              )}
            </button>
            {offre.origineOffre?.urlOrigine && (
              <a
                href={offre.origineOffre.urlOrigine}
                target="_blank"
                rel="noreferrer noopener"
                className={styles.voirBtn}
              >
                France Travail <ExternalLink size={13} />
              </a>
            )}
          </div>
        </>
      )}

      {toast && (
        <div className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : styles.toastError}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
