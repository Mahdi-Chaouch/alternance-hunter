"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import styles from "../page.module.css";

type InvitedRow = { email: string; created_at: string };
type Analytics = {
  total_runs: number;
  runs_by_day: { date: string; count: number }[];
  unique_users: number;
  invited_count: number;
};
type SupportTicket = {
  id: number;
  email: string;
  name: string;
  subject: string;
  message: string;
  ip: string;
  created_at: string;
  replied_at: string | null;
  replied_by: string | null;
};

export function AdminDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [emails, setEmails] = useState<InvitedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [replyTicket, setReplyTicket] = useState<SupportTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [replyExtraEmails, setReplyExtraEmails] = useState("");
  const [replying, setReplying] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [expandedTicket, setExpandedTicket] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [whitelistEnabled, setWhitelistEnabledState] = useState<boolean | null>(null);
  const [whitelistToggling, setWhitelistToggling] = useState(false);

  const fetchWaitlist = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/waitlist", { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data.detail as string) || "Erreur chargement liste");
        setEmails([]);
        return;
      }
      const data = (await res.json()) as { emails?: InvitedRow[] };
      setEmails(data.emails ?? []);
    } catch {
      setError("Erreur reseau");
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { whitelistEnabled?: boolean };
        setWhitelistEnabledState(data.whitelistEnabled ?? true);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const res = await fetch("/api/admin/support", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { tickets?: SupportTicket[] };
        setTickets(data.tickets ?? []);
      }
    } catch {
      setTickets([]);
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch("/api/admin/analytics", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as Analytics;
        setAnalytics(data);
      }
    } catch {
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => { fetchWaitlist(); }, [fetchWaitlist]);
  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);
  useEffect(() => { fetchTickets(); }, [fetchTickets]);
  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  async function handleToggleWhitelist() {
    if (whitelistEnabled === null) return;
    setWhitelistToggling(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ whitelistEnabled: !whitelistEnabled }),
      });
      if (res.ok) {
        setWhitelistEnabledState(!whitelistEnabled);
      }
    } catch {
      // ignore
    } finally {
      setWhitelistToggling(false);
    }
  }

  useEffect(() => {
    if (replyTicket) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [replyTicket]);

  function openReply(ticket: SupportTicket) {
    setReplyTicket(ticket);
    setReplyMessage("");
    setReplyExtraEmails("");
    setReplyError("");
  }

  function closeReply() {
    setReplyTicket(null);
  }

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyTicket) return;
    setReplying(true);
    setReplyError("");
    try {
      const res = await fetch(`/api/admin/support/${replyTicket.id}/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: replyMessage,
          to: replyTicket.email,
          extraEmails: replyExtraEmails,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReplyError((data as { detail?: string }).detail ?? "Erreur envoi");
        return;
      }
      closeReply();
      await fetchTickets();
    } catch {
      setReplyError("Erreur réseau");
    } finally {
      setReplying(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const email = addEmail.trim();
    if (!email) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/admin/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data.detail as string) || "Erreur ajout");
        return;
      }
      setAddEmail("");
      await fetchWaitlist();
    } catch {
      setError("Erreur reseau");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(email: string) {
    setDeleting(email);
    setError("");
    try {
      const res = await fetch("/api/admin/waitlist", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data.detail as string) || "Erreur suppression");
        return;
      }
      await fetchWaitlist();
    } catch {
      setError("Erreur reseau");
    } finally {
      setDeleting(null);
    }
  }

  const chartData =
    analytics?.runs_by_day?.map((d) => ({
      ...d,
      label: new Date(d.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
    })) ?? [];

  return (
    <>
      <section className={`${styles.panel} ${styles.adminSection}`}>
        <h2 className={styles.adminTitle}>Analytics</h2>
        {analyticsLoading ? (
          <p className={styles.sectionHint}>Chargement...</p>
        ) : analytics ? (
          <>
            <div className={styles.adminStatsGrid}>
              <div className={styles.adminStatCard}>
                <div className={styles.adminStatLabel}>Recherches lancees</div>
                <div className={styles.adminStatValue}>{analytics.total_runs}</div>
              </div>
              <div className={styles.adminStatCard}>
                <div className={styles.adminStatLabel}>Utilisateurs uniques</div>
                <div className={styles.adminStatValue}>{analytics.unique_users}</div>
              </div>
              <div className={styles.adminStatCard}>
                <div className={styles.adminStatLabel}>Emails invites</div>
                <div className={styles.adminStatValue}>{analytics.invited_count}</div>
              </div>
            </div>
            <div className={styles.adminChartLabel}>
              Recherches sur les 30 derniers jours
            </div>
            <div className={styles.adminChartContainer}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => [value, "Recherches"]}
                    labelFormatter={(label: string) => label}
                  />
                  <Bar dataKey="count" name="Recherches" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill="var(--primary)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <p className={styles.sectionHint}>Aucune donnee analytics.</p>
        )}
      </section>

      <section className={`${styles.panel} ${styles.adminSection}`}>
        <h2 className={styles.adminTitle}>Support</h2>
        <p className={styles.sectionHint}>Messages reçus depuis le formulaire de support.</p>
        {ticketsLoading ? (
          <p className={styles.sectionHint}>Chargement...</p>
        ) : tickets.length === 0 ? (
          <p className={`${styles.sectionHint} ${styles.adminHintMargin}`}>Aucun message reçu.</p>
        ) : (
          <div className={styles.adminTableWrap}>
            <table className={styles.adminTable}>
              <thead>
                <tr>
                  <th className={styles.adminTh}>Date</th>
                  <th className={styles.adminTh}>Email</th>
                  <th className={styles.adminTh}>Sujet</th>
                  <th className={styles.adminTh}>Statut</th>
                  <th className={styles.adminThRight} />
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td className={styles.adminTdMuted} style={{ whiteSpace: "nowrap", verticalAlign: "top" }}>
                      {new Date(t.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className={styles.adminTd} style={{ verticalAlign: "top" }}>{t.email}{t.name ? ` (${t.name})` : ""}</td>
                    <td style={{ verticalAlign: "top", paddingTop: "0.5rem" }}>
                      <div className={styles.adminTdMuted}>{t.subject || "—"}</div>
                      {expandedTicket === t.id && (
                        <div style={{ marginTop: "8px", background: "var(--input-bg)", borderRadius: "6px", padding: "10px 12px", fontSize: "0.85rem", whiteSpace: "pre-wrap", color: "var(--muted-text)", maxWidth: "360px" }}>
                          {t.message}
                        </div>
                      )}
                    </td>
                    <td className={styles.adminTd} style={{ verticalAlign: "top" }}>
                      {t.replied_at ? (
                        <span style={{ color: "var(--status-success-text)", fontSize: "0.82rem" }}>Répondu</span>
                      ) : (
                        <span style={{ color: "var(--status-running-text)", fontSize: "0.82rem" }}>En attente</span>
                      )}
                    </td>
                    <td className={styles.adminTd} style={{ verticalAlign: "top" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          className={`${styles.secondaryBtn} ${styles.adminBtnSmall}`}
                          onClick={() => setExpandedTicket(expandedTicket === t.id ? null : t.id)}
                        >
                          {expandedTicket === t.id ? "Masquer" : "Voir"}
                        </button>
                        <button
                          type="button"
                          className={`${styles.secondaryBtn} ${styles.adminBtnSmall}`}
                          onClick={() => openReply(t)}
                        >
                          Répondre
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <dialog
        ref={dialogRef}
        onClose={closeReply}
        style={{ background: "var(--panel-bg)", color: "var(--text)", border: "1px solid var(--panel-border)", borderRadius: "16px", padding: "28px", maxWidth: "520px", width: "90vw" }}
      >
        {replyTicket && (
          <form onSubmit={handleSendReply}>
            <h3 style={{ margin: "0 0 4px" }}>Répondre à {replyTicket.email}</h3>
            <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: "var(--muted-text)" }}>
              {replyTicket.subject ? `Sujet : ${replyTicket.subject}` : "Pas de sujet"}
            </p>
            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "6px" }}>Message</label>
            <textarea
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              rows={7}
              required
              disabled={replying}
              style={{ width: "100%", boxSizing: "border-box", background: "var(--input-bg)", color: "var(--text)", border: "1px solid var(--input-border)", borderRadius: "8px", padding: "10px 12px", fontSize: "0.9rem", resize: "vertical" }}
            />
            <label style={{ display: "block", fontSize: "0.85rem", margin: "12px 0 6px" }}>
              Envoyer aussi à (emails séparés par des virgules)
            </label>
            <input
              type="text"
              value={replyExtraEmails}
              onChange={(e) => setReplyExtraEmails(e.target.value)}
              placeholder="ex: team@example.com, autre@example.com"
              disabled={replying}
              className={styles.zoneFieldInput}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
            {replyError && <p style={{ color: "var(--danger)", fontSize: "0.85rem", margin: "8px 0 0" }}>{replyError}</p>}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "20px" }}>
              <button type="button" className={styles.secondaryBtn} onClick={closeReply} disabled={replying}>Annuler</button>
              <button type="submit" className={styles.secondaryBtn} disabled={replying || !replyMessage.trim()}>
                {replying ? "Envoi..." : "Envoyer"}
              </button>
            </div>
          </form>
        )}
      </dialog>

      <section className={`${styles.panel} ${styles.adminSection}`}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
          <h2 className={styles.adminTitle} style={{ margin: 0 }}>Liste d&apos;invites (waitlist)</h2>
          {whitelistEnabled !== null && (
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={handleToggleWhitelist}
              disabled={whitelistToggling}
              style={{ borderColor: whitelistEnabled ? "var(--danger)" : "var(--status-success-text)", color: whitelistEnabled ? "var(--danger)" : "var(--status-success-text)" }}
            >
              {whitelistToggling ? "..." : whitelistEnabled ? "Désactiver la whitelist" : "Activer la whitelist"}
            </button>
          )}
        </div>
        <p className={styles.sectionHint}>
          Emails autorises a utiliser l&apos;application. Ajoutez ou retirez des acces.
          {whitelistEnabled === false && (
            <span style={{ color: "var(--danger)", fontWeight: 600 }}> — Whitelist désactivée : tous les utilisateurs connectés ont accès.</span>
          )}
        </p>

        {error ? <p className={styles.adminError}>{error}</p> : null}

        <form onSubmit={handleAdd} className={styles.adminForm}>
          <input
            type="email"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            placeholder="email@exemple.fr"
            className={`${styles.zoneFieldInput} ${styles.adminEmailInput}`}
            disabled={adding}
          />
          <button type="submit" className={styles.secondaryBtn} disabled={adding}>
            {adding ? "Ajout..." : "Ajouter"}
          </button>
        </form>

        {loading ? (
          <p className={`${styles.sectionHint} ${styles.adminHintMargin}`}>Chargement...</p>
        ) : emails.length === 0 ? (
          <p className={`${styles.sectionHint} ${styles.adminHintMargin}`}>
            Aucun email dans la liste.
          </p>
        ) : (
          <div className={styles.adminTableWrap}>
            <table className={styles.adminTable}>
              <thead>
                <tr>
                  <th className={styles.adminTh}>Email</th>
                  <th className={styles.adminTh}>Ajoute le</th>
                  <th className={styles.adminThRight} />
                </tr>
              </thead>
              <tbody>
                {emails.map((row) => (
                  <tr key={row.email}>
                    <td className={styles.adminTd}>{row.email}</td>
                    <td className={styles.adminTdMuted}>
                      {row.created_at ? new Date(row.created_at).toLocaleDateString("fr-FR") : "-"}
                    </td>
                    <td className={styles.adminTd}>
                      <button
                        type="button"
                        className={`${styles.secondaryBtn} ${styles.adminBtnSmall}`}
                        onClick={() => handleRemove(row.email)}
                        disabled={deleting === row.email}
                      >
                        {deleting === row.email ? "..." : "Retirer"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
