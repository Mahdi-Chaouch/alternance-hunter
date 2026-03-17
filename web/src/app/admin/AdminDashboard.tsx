"use client";

import { useCallback, useEffect, useState } from "react";
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

export function AdminDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [emails, setEmails] = useState<InvitedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

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

  useEffect(() => {
    fetchWhitelist();
  }, [fetchWaitlist]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

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
        <h2 className={styles.adminTitle}>Liste d&apos;invites (waitlist)</h2>
        <p className={styles.sectionHint}>
          Emails autorises a utiliser l&apos;application. Ajoutez ou retirez des acces.
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
