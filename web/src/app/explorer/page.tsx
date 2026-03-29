"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Building2, MapPin, Users, Send, X, Upload, CheckCircle, DatabaseZap } from "lucide-react";
import { SECTOR_LABELS, SECTOR_ORDER } from "@/data/sectors-specialties";
import { COMMUNES_FRANCE } from "@/data/communes-france";
import styles from "./explorer.module.css";

const PAGE_SIZE = 50;

type Company = {
  id: number;
  name: string;
  website: string | null;
  domain: string;
  sector: string | null;
  location: string | null;
  contact_count: number;
  last_seen_at: string | null;
};

type Toast = { message: string; type: "success" | "error" } | null;

export default function ExplorerPage() {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const [zone, setZone] = useState("");
  const [zoneInput, setZoneInput] = useState("");
  const [zoneSuggestions, setZoneSuggestions] = useState<string[]>([]);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  const [needsMigration, setNeedsMigration] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [uploadsStatus, setUploadsStatus] = useState<{ cv: boolean; template: boolean } | null>(null);
  const [pendingCompany, setPendingCompany] = useState<Company | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [doneIds, setDoneIds] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<Toast>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const cvRef = useRef<HTMLInputElement>(null);
  const templateRef = useRef<HTMLInputElement>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show toast and auto-dismiss
  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Check upload status once on mount
  useEffect(() => {
    fetch("/api/uploads")
      .then((r) => r.json())
      .then((data) => {
        setUploadsStatus({
          cv: !!data.cv,
          template: !!data.template,
        });
      })
      .catch(() => setUploadsStatus({ cv: false, template: false }));
  }, []);

  // Zone autocomplete
  useEffect(() => {
    if (!zoneInput.trim() || zoneInput.length < 2) {
      setZoneSuggestions([]);
      return;
    }
    const lower = zoneInput.toLowerCase();
    const matches = COMMUNES_FRANCE.filter((c) => c.toLowerCase().startsWith(lower)).slice(0, 8);
    setZoneSuggestions(matches);
  }, [zoneInput]);

  const search = useCallback(
    async (pageIndex: number, q: string, sec: string, z: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(pageIndex * PAGE_SIZE) });
        if (q.trim()) params.set("q", q.trim());
        if (sec) params.set("sector", sec);
        if (z.trim()) params.set("zone", z.trim());
        const res = await fetch(`/api/recruiting/companies?${params}`);
        const data = await res.json();
        if (!res.ok) {
          const detail: string = data?.detail ?? "Erreur serveur";
          const isMigration = detail.includes("column") || detail.includes("does not exist") || detail.includes("user_key") || detail.includes("sector") || detail.includes("location");
          if (isMigration) {
            setNeedsMigration(true);
          } else {
            showToast(detail, "error");
          }
          return;
        }
        setNeedsMigration(false);
        setCompanies(data.items ?? []);
        setTotal(data.total ?? 0);
        setPage(pageIndex);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur réseau";
        showToast(msg.includes("fetch") ? "Backend inaccessible (Render en veille ?)" : msg, "error");
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  // Initial load
  useEffect(() => {
    search(0, "", "", "");
  }, [search]);

  // Debounced search on query/sector/zone change
  const triggerSearch = useCallback(
    (q: string, sec: string, z: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        search(0, q, sec, z);
      }, 300);
    },
    [search],
  );

  // Handle candidature click
  const handleCandidater = useCallback(
    async (company: Company) => {
      if (!uploadsStatus) return;
      if (!uploadsStatus.cv) {
        setPendingCompany(company);
        setShowUploadModal(true);
        return;
      }
      setSendingId(company.id);
      try {
        const res = await fetch("/api/recruiting/quick-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company_name: company.name, contact_email: "" }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.detail ?? "Erreur lors de la création du brouillon.", "error");
        } else {
          setDoneIds((prev) => new Set([...prev, company.id]));
          showToast(`Brouillon créé pour ${company.name} !`, "success");
        }
      } catch {
        showToast("Erreur réseau. Réessaie.", "error");
      } finally {
        setSendingId(null);
      }
    },
    [uploadsStatus, showToast],
  );

  // Upload files then retry candidature
  const handleUploadAndCandidater = useCallback(async () => {
    if (!cvRef.current?.files?.[0]) {
      showToast("Sélectionne un CV (PDF).", "error");
      return;
    }
    const formData = new FormData();
    formData.append("cv", cvRef.current.files[0]);
    if (templateRef.current?.files?.[0]) {
      formData.append("template", templateRef.current.files[0]);
    }
    try {
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.detail ?? "Échec de l'upload.", "error");
        return;
      }
      setUploadsStatus({ cv: true, template: !!templateRef.current?.files?.[0] });
      setShowUploadModal(false);
      if (pendingCompany) {
        const company = pendingCompany;
        setPendingCompany(null);
        await handleCandidater(company);
      }
    } catch {
      showToast("Erreur réseau lors de l'upload.", "error");
    }
  }, [pendingCompany, showToast, handleCandidater]);

  const runMigration = useCallback(async () => {
    setMigrating(true);
    try {
      const res = await fetch("/api/admin/migrate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail ?? "Migration échouée.", "error");
      } else {
        showToast("Migration réussie ! Chargement des entreprises…", "success");
        setNeedsMigration(false);
        setTimeout(() => search(0, query, sector, zone), 800);
      }
    } catch {
      showToast("Erreur réseau pendant la migration.", "error");
    } finally {
      setMigrating(false);
    }
  }, [showToast, search, query, sector, zone]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          <Building2 size={28} style={{ verticalAlign: "middle", marginRight: "0.5rem" }} />
          Explorer les entreprises
        </h1>
        <p className={styles.subtitle}>
          Base partagée — {total > 0 ? `${total.toLocaleString("fr-FR")} entreprises` : "…"} enrichie par tous les utilisateurs.
        </p>
      </header>

      {/* Migration banner */}
      {needsMigration && (
        <div className={styles.migrationBanner}>
          <DatabaseZap size={20} className={styles.migrationIcon} />
          <div className={styles.migrationText}>
            <strong className={styles.migrationTitle}>Mise à jour de la base de données requise.</strong>
            <p className={styles.migrationDesc}>
              La base partagée doit être migrée une seule fois. Clique sur le bouton pour lancer la migration automatiquement.
            </p>
          </div>
          <button
            type="button"
            className={`${styles.searchBtn} ${styles.migrationBtn}`}
            onClick={runMigration}
            disabled={migrating}
          >
            <DatabaseZap size={15} />
            {migrating ? "Migration en cours…" : "Lancer la migration"}
          </button>
        </div>
      )}

      {/* Search bar */}
      <div className={styles.searchBar}>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Rechercher par nom ou domaine…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            triggerSearch(e.target.value, sector, zone);
          }}
        />
        <select
          className={styles.selectInput}
          value={sector}
          onChange={(e) => {
            setSector(e.target.value);
            triggerSearch(query, e.target.value, zone);
          }}
        >
          <option value="">Tous secteurs</option>
          {SECTOR_ORDER.filter((s) => s !== "all").map((s) => (
            <option key={s} value={s}>
              {SECTOR_LABELS[s]}
            </option>
          ))}
        </select>

        {/* Zone with autocomplete */}
        <div style={{ position: "relative" }}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Zone / ville…"
            value={zoneInput}
            onChange={(e) => {
              setZoneInput(e.target.value);
              if (!e.target.value.trim()) {
                setZone("");
                triggerSearch(query, sector, "");
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setZone(zoneInput);
                setZoneSuggestions([]);
                triggerSearch(query, sector, zoneInput);
              }
            }}
          />
          {zoneSuggestions.length > 0 && (
            <ul
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: "var(--card-bg, #fff)",
                border: "1.5px solid rgba(139,92,246,0.3)",
                borderRadius: "8px",
                marginTop: "4px",
                listStyle: "none",
                padding: "0.25rem 0",
                zIndex: 100,
                boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
              }}
            >
              {zoneSuggestions.map((s) => (
                <li
                  key={s}
                  onClick={() => {
                    setZoneInput(s);
                    setZone(s);
                    setZoneSuggestions([]);
                    triggerSearch(query, sector, s);
                  }}
                  style={{ padding: "0.45rem 1rem", cursor: "pointer", fontSize: "0.9rem" }}
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          className={styles.searchBtn}
          onClick={() => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            search(0, query, sector, zone || zoneInput);
          }}
        >
          <Search size={16} /> Rechercher
        </button>
      </div>

      {loading && <div className={styles.loading}>Chargement…</div>}

      {!loading && companies.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}><Building2 size={40} /></div>
          <p>Aucune entreprise trouvée.</p>
          <p style={{ fontSize: "0.85rem" }}>
            Lance d&apos;abord une <Link href="/dashboard">recherche depuis le dashboard</Link> pour alimenter la base.
          </p>
        </div>
      )}

      {!loading && companies.length > 0 && (
        <>
          <p className={styles.stats}>
            {total.toLocaleString("fr-FR")} entreprise{total > 1 ? "s" : ""} — page {page + 1}/{totalPages || 1}
          </p>
          <div className={styles.grid}>
            {companies.map((company) => (
              <div key={company.id} className={styles.card}>
                <h3 className={styles.cardName} title={company.name}>
                  {company.name}
                </h3>
                <a
                  href={company.website ? `https://${company.domain}` : undefined}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={styles.cardDomain}
                >
                  {company.domain}
                </a>
                <div className={styles.cardMeta}>
                  {company.sector && (
                    <span className={styles.badge}>
                      {SECTOR_LABELS[company.sector as keyof typeof SECTOR_LABELS] ?? company.sector}
                    </span>
                  )}
                  {company.location && (
                    <span className={`${styles.badge} ${styles.badgeGray}`}>
                      <MapPin size={11} /> {company.location}
                    </span>
                  )}
                  {company.contact_count > 0 && (
                    <span className={`${styles.badge} ${styles.badgeGray}`}>
                      <Users size={11} /> {company.contact_count} contact{company.contact_count > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <button
                  className={`${styles.candidaterBtn} ${doneIds.has(company.id) ? styles.candidaterBtnDone : ""}`}
                  disabled={sendingId === company.id || doneIds.has(company.id) || company.contact_count === 0}
                  onClick={() => handleCandidater(company)}
                  title={company.contact_count === 0 ? "Aucun contact disponible pour cette entreprise" : ""}
                >
                  {doneIds.has(company.id) ? (
                    <><CheckCircle size={15} /> Brouillon créé</>
                  ) : sendingId === company.id ? (
                    "Création…"
                  ) : company.contact_count === 0 ? (
                    "Pas de contact"
                  ) : (
                    <><Send size={15} /> Candidater</>
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                disabled={page === 0}
                onClick={() => search(page - 1, query, sector, zone)}
              >
                ← Précédent
              </button>
              <span className={styles.pageCurrent}>
                Page {page + 1} / {totalPages}
              </span>
              <button
                className={styles.pageBtn}
                disabled={page >= totalPages - 1}
                onClick={() => search(page + 1, query, sector, zone)}
              >
                Suivant →
              </button>
            </div>
          )}
        </>
      )}

      {/* Upload modal */}
      {showUploadModal && (
        <div className={styles.modalOverlay} onClick={() => setShowUploadModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>
              <Upload size={20} style={{ verticalAlign: "middle", marginRight: "0.4rem" }} />
              Documents requis
            </h2>
            <p className={styles.modalSubtitle}>
              Pour créer un brouillon, importez votre CV (obligatoire) et votre template de lettre de motivation
              (optionnel).
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <label style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                CV (PDF)*
                <input ref={cvRef} type="file" accept=".pdf" style={{ display: "block", marginTop: "0.3rem" }} />
              </label>
              <label style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                Template LM (.docx, optionnel)
                <input ref={templateRef} type="file" accept=".docx,.doc" style={{ display: "block", marginTop: "0.3rem" }} />
              </label>
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.btnSecondary}
                onClick={() => {
                  setShowUploadModal(false);
                  setPendingCompany(null);
                }}
              >
                <X size={14} style={{ verticalAlign: "middle" }} /> Annuler
              </button>
              <button className={styles.btnPrimary} onClick={handleUploadAndCandidater}>
                <Upload size={14} style={{ verticalAlign: "middle", marginRight: "0.3rem" }} />
                Importer et candidater
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : styles.toastError}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
