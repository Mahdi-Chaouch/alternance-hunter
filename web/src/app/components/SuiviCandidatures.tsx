"use client";

import { useCallback } from "react";
import Link from "next/link";
import styles from "../page.module.css";

const CANDIDATURE_STATUSES = [
  "draft_created",
  "sent",
  "relance",
  "reponse_positive",
  "reponse_negative",
  "no_reponse",
] as const;

export type CandidatureStatus = (typeof CANDIDATURE_STATUSES)[number];

export const CANDIDATURE_LABELS: Record<CandidatureStatus, string> = {
  draft_created: "Brouillon créé",
  sent: "Envoyé",
  relance: "Relance",
  reponse_positive: "Réponse positive",
  reponse_negative: "Réponse négative",
  no_reponse: "Sans réponse",
};

export type CandidatureItem = {
  id: number;
  run_id: string | null;
  company: string;
  email: string;
  status: string;
  draft_id: string | null;
  created_at: string;
  updated_at: string;
};

function getCandidatureBadgeClass(status: string): string {
  const s = status as CandidatureStatus;
  const base = styles.statusBadge;
  switch (s) {
    case "draft_created":
      return `${base} ${styles.badgeCandidatureDraft}`;
    case "sent":
    case "relance":
      return `${base} ${styles.badgeCandidatureSent}`;
    case "reponse_positive":
      return `${base} ${styles.badgeCandidaturePositive}`;
    case "reponse_negative":
      return `${base} ${styles.badgeCandidatureNegative}`;
    case "no_reponse":
      return `${base} ${styles.badgeCandidatureNoReponse}`;
    default:
      return `${base} ${styles.badgeNeutral}`;
  }
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(d);
}

type SuiviCandidaturesProps = {
  candidaturesList: CandidatureItem[];
  candidatureStatusFilter: string;
  setCandidatureStatusFilter: (value: string) => void;
  isRefreshingCandidatures: boolean;
  isSyncingCandidatures: boolean;
  refreshCandidatures: () => void | Promise<void>;
  syncCandidatures: (runId?: string) => void | Promise<void>;
  updateCandidatureStatus: (id: number, newStatus: string) => void | Promise<void>;
  isGranted: boolean;
  activeRunId?: string | null;
  syncMessage?: string | null;
  syncError?: string | null;
  isAnalyzingInbox?: boolean;
  analyzeInbox?: () => void | Promise<void>;
  analyzeMessage?: string | null;
  analyzeError?: string | null;
  countsByStatus?: Record<string, number> | null;
};

export function SuiviCandidatures({
  candidaturesList,
  candidatureStatusFilter,
  setCandidatureStatusFilter,
  isRefreshingCandidatures,
  isSyncingCandidatures,
  refreshCandidatures,
  syncCandidatures,
  updateCandidatureStatus,
  isGranted,
  activeRunId = null,
  syncMessage = null,
  syncError = null,
  isAnalyzingInbox = false,
  analyzeInbox,
  analyzeMessage = null,
  analyzeError = null,
  countsByStatus = null,
}: SuiviCandidaturesProps) {
  const onSync = useCallback(
    () => void syncCandidatures(activeRunId ?? undefined),
    [syncCandidatures, activeRunId],
  );

  return (
    <section className={styles.panel} id="candidatures">
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.candidaturesTitle}>Suivi des candidatures</h2>
          <p className={styles.candidaturesSubtitle}>
            Importez vos brouillons Gmail et suivez les statuts (brouillon → envoyé → relance → réponse).
          </p>
        </div>
        <div className={styles.panelHeaderActions}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={onSync}
            disabled={isSyncingCandidatures || !isGranted}
          >
            {isSyncingCandidatures ? "Synchronisation…" : "Importer depuis les brouillons"}
          </button>
          {analyzeInbox ? (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => void analyzeInbox()}
              disabled={isAnalyzingInbox || !isGranted}
            >
              {isAnalyzingInbox ? "Analyse…" : "Analyser les réponses reçues"}
            </button>
          ) : null}
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => void refreshCandidatures()}
            disabled={isRefreshingCandidatures}
          >
            {isRefreshingCandidatures ? "Chargement…" : "Rafraîchir"}
          </button>
        </div>
      </div>

      {syncError ? (
        <div className={styles.candidatureSyncError} role="alert">
          {syncError}
        </div>
      ) : syncMessage ? (
        <div className={styles.candidatureSyncMessage} role="status">
          {syncMessage}
        </div>
      ) : null}
      {analyzeError ? (
        <div className={styles.candidatureSyncError} role="alert">
          {analyzeError}
        </div>
      ) : analyzeMessage ? (
        <div className={styles.candidatureSyncMessage} role="status">
          {analyzeMessage}
        </div>
      ) : null}

      <div className={styles.candidaturePillsWrap}>
        <span className={styles.candidaturePillsLabel}>Filtrer par statut</span>
        <div className={styles.candidaturePills} role="group" aria-label="Filtrer par statut">
          <button
            type="button"
            className={candidatureStatusFilter === "" ? styles.candidaturePillActive : styles.candidaturePill}
            onClick={() => setCandidatureStatusFilter("")}
          >
            Tous {countsByStatus && typeof countsByStatus.total === "number" ? `(${countsByStatus.total})` : ""}
          </button>
          {CANDIDATURE_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={candidatureStatusFilter === s ? styles.candidaturePillActive : styles.candidaturePill}
              onClick={() => setCandidatureStatusFilter(s)}
            >
              {CANDIDATURE_LABELS[s]}
              {countsByStatus && typeof countsByStatus[s] === "number" ? ` (${countsByStatus[s]})` : ""}
            </button>
          ))}
        </div>
      </div>

      {candidaturesList.length === 0 ? (
        <div className={styles.candidatureEmptyBlock}>
          <p className={styles.candidatureEmptyTitle}>Aucune candidature pour le moment</p>
          <p className={styles.candidatureEmptyText}>
            Lancez une recherche pour générer des brouillons Gmail, puis importez-les ici pour suivre vos envois et
            réponses.
          </p>
          <div className={styles.candidatureEmptyActions}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={onSync}
              disabled={isSyncingCandidatures || !isGranted}
            >
              {isSyncingCandidatures ? "Synchronisation…" : "Importer depuis les brouillons"}
            </button>
            <Link href="/dashboard#step-config" className={`${styles.secondaryBtn} ${styles.candidatureEmptyLink}`}>
              Lancer une recherche
            </Link>
          </div>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.runTable}>
            <thead>
              <tr>
                <th>Entreprise</th>
                <th>Email</th>
                <th>Statut</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {candidaturesList.map((c) => (
                <tr key={c.id} className={styles.tableRow}>
                  <td className={styles.candidatureCellCompany}>{c.company}</td>
                  <td className={styles.candidatureCellEmail}>{c.email}</td>
                  <td>
                    <span className={getCandidatureBadgeClass(c.status)}>
                      {CANDIDATURE_LABELS[c.status as CandidatureStatus] ?? c.status}
                    </span>
                  </td>
                  <td className={styles.candidatureCellDate}>{formatDate(c.updated_at ?? c.created_at)}</td>
                  <td>
                    <select
                      aria-label={`Changer le statut de la candidature ${c.company}`}
                      value={c.status}
                      onChange={(e) => updateCandidatureStatus(c.id, e.target.value)}
                      className={styles.candidatureStatusSelect}
                    >
                      {CANDIDATURE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {CANDIDATURE_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
