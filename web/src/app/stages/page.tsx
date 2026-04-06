"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, MapPin, Briefcase, CheckCircle, ExternalLink, Send } from "lucide-react";
import styles from "./stages.module.css";

type OffreStage = {
  id: string;
  intitule: string;
  entreprise?: { nom?: string };
  lieuTravail?: { libelle?: string };
  typeContratLibelle?: string;
  dateCreation?: string;
  description?: string;
  origineOffre?: { urlOrigine?: string };
  salaire?: { libelle?: string };
  contact?: { courriel?: string };
};

type Toast = { message: string; type: "success" | "error" } | null;

function parseTotalFromContentRange(cr: string): number | null {
  // format: "offres 0-19/847"
  const m = cr.match(/\/(\d+)$/);
  return m ? parseInt(m[1]!, 10) : null;
}

export default function StagesPage() {
  const [query, setQuery] = useState("");
  const [commune, setCommune] = useState("");
  const [offres, setOffres] = useState<OffreStage[]>([]);
  const [contentRange, setContentRange] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [uploadsHasCv, setUploadsHasCv] = useState(false);
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [draftedIds, setDraftedIds] = useState<Set<string>>(new Set());

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    fetch("/api/uploads")
      .then((r) => r.json())
      .then((d) => setUploadsHasCv(!!d.cv))
      .catch(() => {});
  }, []);

  const search = useCallback(async (pageIndex: number, q: string, com: string) => {
    setLoading(true);
    setNotConfigured(false);
    try {
      const range = `${pageIndex * 20}-${pageIndex * 20 + 19}`;
      const params = new URLSearchParams({ range });
      if (q.trim()) params.set("q", q.trim());
      if (com.trim()) params.set("commune", com.trim());
      const res = await fetch(`/api/stages?${params}`);
      const data = await res.json();
      if (!res.ok) {
        const detail: string = data?.detail ?? "Erreur serveur";
        if (detail.includes("non configurée")) {
          setNotConfigured(true);
        } else {
          showToast(detail, "error");
        }
        return;
      }
      const resultats: OffreStage[] = data.resultats ?? [];
      const stageOnly = resultats.filter((o) =>
        o.intitule.toLowerCase().includes("stage")
      );
      setOffres(stageOnly);
      setContentRange(data.content_range ?? "");
      setPage(pageIndex);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur réseau", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const handleSearch = () => search(0, query, commune);

  const handleDraft = useCallback(async (offre: OffreStage) => {
    if (!uploadsHasCv) {
      showToast("Uploadez votre CV dans Profil d'abord.", "error");
      return;
    }
    setDraftingId(offre.id);
    try {
      const res = await fetch("/api/recruiting/quick-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: offre.entreprise?.nom ?? offre.intitule,
          contact_email: offre.contact?.courriel ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail ?? "Erreur lors de la création du brouillon.", "error");
      } else {
        setDraftedIds((prev) => new Set([...prev, offre.id]));
        showToast(`Brouillon créé pour ${offre.entreprise?.nom ?? offre.intitule} !`, "success");
      }
    } catch {
      showToast("Erreur réseau.", "error");
    } finally {
      setDraftingId(null);
    }
  }, [uploadsHasCv, showToast]);

  const handleAjouter = useCallback(async (offre: OffreStage) => {
    setAddingId(offre.id);
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
        setAddedIds((prev) => new Set([...prev, offre.id]));
        showToast(`Ajouté au suivi : ${offre.entreprise?.nom ?? offre.intitule}`, "success");
      }
    } catch {
      showToast("Erreur réseau.", "error");
    } finally {
      setAddingId(null);
    }
  }, [showToast]);

  const total = parseTotalFromContentRange(contentRange);
  const totalPages = total !== null ? Math.ceil(total / 20) : 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          <Briefcase size={28} style={{ verticalAlign: "middle", marginRight: "0.5rem" }} />
          Recherche de stages
        </h1>
        <p className={styles.subtitle}>
          Offres de stage via France Travail — ajoutez-les à votre suivi de candidatures.
        </p>
      </header>

      {notConfigured && (
        <div className={styles.infoBanner}>
          L&apos;intégration France Travail n&apos;est pas encore configurée sur ce serveur.
          Contactez l&apos;administrateur pour activer cette fonctionnalité.
        </div>
      )}

      <div className={styles.searchBar}>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Mots-clés (ex: développeur, marketing…)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Code commune (ex: 75056 pour Paris)"
          value={commune}
          onChange={(e) => setCommune(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          style={{ maxWidth: 240 }}
        />
        <button className={styles.searchBtn} onClick={handleSearch} disabled={loading}>
          <Search size={16} /> Rechercher
        </button>
      </div>

      {loading && <div className={styles.loading}>Chargement des offres…</div>}

      {!loading && offres.length === 0 && !notConfigured && contentRange === "" && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}><Briefcase size={40} /></div>
          <p>Lance une recherche pour voir les offres de stage.</p>
        </div>
      )}

      {!loading && offres.length === 0 && contentRange !== "" && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}><Search size={40} /></div>
          <p>Aucune offre trouvée pour ces critères.</p>
        </div>
      )}

      {!loading && offres.length > 0 && (
        <>
          {total !== null && (
            <p className={styles.stats}>
              {total.toLocaleString("fr-FR")} offre{total > 1 ? "s" : ""} — page {page + 1}/{totalPages || 1}
            </p>
          )}
          <div className={styles.grid}>
            {offres.map((offre) => (
              <div key={offre.id} className={styles.card}>
                <h3 className={styles.cardName} title={offre.intitule}>
                  {offre.intitule}
                </h3>
                {offre.entreprise?.nom && (
                  <p className={styles.cardCompany}>{offre.entreprise.nom}</p>
                )}
                <div className={styles.cardMeta}>
                  {offre.lieuTravail?.libelle && (
                    <span className={`${styles.badge} ${styles.badgeGray}`}>
                      <MapPin size={11} /> {offre.lieuTravail.libelle}
                    </span>
                  )}
                  {offre.typeContratLibelle && (
                    <span className={styles.badge}>{offre.typeContratLibelle}</span>
                  )}
                  {offre.salaire?.libelle && (
                    <span className={`${styles.badge} ${styles.badgeGray}`}>{offre.salaire.libelle}</span>
                  )}
                </div>
                {offre.description && (
                  <p className={styles.cardDesc}>{offre.description}</p>
                )}
                <div className={styles.cardActions}>
                  <button
                    className={`${styles.candidaterBtn} ${addedIds.has(offre.id) ? styles.candidaterBtnDone : ""}`}
                    disabled={addingId === offre.id || addedIds.has(offre.id)}
                    onClick={() => handleAjouter(offre)}
                  >
                    {addedIds.has(offre.id) ? (
                      <><CheckCircle size={14} /> Ajouté</>
                    ) : addingId === offre.id ? (
                      "Ajout…"
                    ) : (
                      "Ajouter au suivi"
                    )}
                  </button>
                  <button
                    className={`${styles.candidaterBtn} ${draftedIds.has(offre.id) ? styles.candidaterBtnDone : ""}`}
                    disabled={draftingId === offre.id || draftedIds.has(offre.id)}
                    onClick={() => handleDraft(offre)}
                  >
                    {draftedIds.has(offre.id) ? (
                      <><CheckCircle size={14} /> Brouillon créé</>
                    ) : draftingId === offre.id ? (
                      "Création…"
                    ) : (
                      <><Send size={14} /> Brouillon</>
                    )}
                  </button>
                  <Link href={`/stages/${offre.id}`} className={styles.voirBtn}>
                    Voir <ExternalLink size={13} />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                disabled={page === 0}
                onClick={() => search(page - 1, query, commune)}
              >
                ← Précédent
              </button>
              <span className={styles.pageCurrent}>Page {page + 1} / {totalPages}</span>
              <button
                className={styles.pageBtn}
                disabled={page >= totalPages - 1}
                onClick={() => search(page + 1, query, commune)}
              >
                Suivant →
              </button>
            </div>
          )}
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
