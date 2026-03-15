"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import styles from "../page.module.css";

type ThemeMode = "light" | "dark";

type ProfileData = {
  first_name: string;
  last_name: string;
  linkedin_url?: string;
  portfolio_url?: string;
};

type AnalyticsData = {
  total_targets: number;
  contacts_valides: number;
  taux_contacts_valides: number;
  drafts_crees: number;
  taux_drafts_crees: number;
  candidatures_sent: number;
  reponses_positives: number;
  reponses_negatives: number;
  taux_conversion_reponse: number;
};

export default function ProfilPage() {
  const router = useRouter();
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [email, setEmail] = useState<string>("");
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("alternance-ui-theme");
    const initial: ThemeMode = saved === "dark" || saved === "light" ? saved : "light";
    setTheme(initial);
    const onThemeChange = (e: Event) => {
      const ev = e as CustomEvent<ThemeMode>;
      if (ev.detail === "dark" || ev.detail === "light") setTheme(ev.detail);
    };
    window.addEventListener("alternance-theme-change", onThemeChange);
    return () => window.removeEventListener("alternance-theme-change", onThemeChange);
  }, []);

  useEffect(() => {
    if (!session?.user?.email) {
      if (!isSessionPending) {
        router.replace("/login");
      }
      return;
    }

    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setAccessDenied(false);
      try {
        const [profileRes, analyticsRes] = await Promise.all([
          fetch("/api/profile", { cache: "no-store" }),
          fetch("/api/analytics", { cache: "no-store" }),
        ]);

        if (cancelled) return;

        if (profileRes.status === 403) {
          setAccessDenied(true);
          setProfileData(null);
          setEmail("");
          return;
        }
        if (profileRes.status === 401) {
          router.replace("/login");
          return;
        }
        if (profileRes.ok) {
          const profileJson = (await profileRes.json()) as {
            profile?: ProfileData;
            email?: string;
          };
          setProfileData(profileJson.profile ?? null);
          setEmail(profileJson.email ?? session?.user?.email ?? "");
        }

        if (analyticsRes.ok) {
          const analyticsJson = (await analyticsRes.json()) as AnalyticsData;
          if (
            typeof analyticsJson?.total_targets === "number" ||
            typeof analyticsJson?.drafts_crees === "number"
          ) {
            setAnalyticsData(analyticsJson);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchData();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.email, isSessionPending, router]);

  if (isSessionPending || (!session?.user && !accessDenied)) {
    return (
      <div className={`${styles.page} ${theme === "dark" ? styles.pageDark : ""}`}>
        <main className={styles.main}>
          <section className={styles.panel}>
            <h2>Chargement...</h2>
            <p className={styles.panelHint}>Vérification de la session et chargement de votre profil.</p>
          </section>
        </main>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className={`${styles.page} ${theme === "dark" ? styles.pageDark : ""}`}>
        <main className={styles.main}>
          <section className={styles.panel}>
            <h2>Accès refusé</h2>
            <p className={styles.panelHint} role="alert">
              Votre compte n&apos;est pas autorisé pour ce dashboard. Contactez l&apos;administrateur.
            </p>
            <Link href="/" className={styles.secondaryBtn} style={{ display: "inline-block", marginTop: "0.5rem" }}>
              Retour à l&apos;accueil
            </Link>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className={`${styles.page} ${theme === "dark" ? styles.pageDark : ""}`}>
      <main className={styles.main}>
        <header className={styles.headerCard}>
          <div>
            <p className={styles.eyebrow}>Alternance Hunter</p>
            <h1>Mon profil</h1>
            <p className={styles.panelHint}>
              Vos informations personnelles, statistiques et accès rapides au dashboard.
            </p>
          </div>
        </header>

        <section className={styles.panel}>
          <h2>Informations personnelles</h2>
          {loading ? (
            <p className={styles.panelHint}>Chargement...</p>
          ) : (
            <>
              <dl className={styles.profilDefList}>
                <dt>Prénom</dt>
                <dd>{profileData?.first_name || "—"}</dd>
                <dt>Nom</dt>
                <dd>{profileData?.last_name || "—"}</dd>
                <dt>Email</dt>
                <dd>{email || "—"}</dd>
                {profileData?.linkedin_url ? (
                  <>
                    <dt>LinkedIn</dt>
                    <dd>
                      <a
                        href={profileData.linkedin_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className={styles.contactLink}
                      >
                        {profileData.linkedin_url}
                      </a>
                    </dd>
                  </>
                ) : null}
                {profileData?.portfolio_url ? (
                  <>
                    <dt>Portfolio</dt>
                    <dd>
                      <a
                        href={profileData.portfolio_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className={styles.contactLink}
                      >
                        {profileData.portfolio_url}
                      </a>
                    </dd>
                  </>
                ) : null}
              </dl>
              <p className={styles.sectionHint}>
                Pour modifier vos informations, utilisez le formulaire « Profil expéditeur » sur le dashboard.
              </p>
              <Link href="/dashboard#step-profil" className={styles.secondaryBtn} style={{ display: "inline-block" }}>
                Modifier dans le dashboard
              </Link>
            </>
          )}
        </section>

        <section className={styles.panel}>
          <h2>Statistiques personnelles</h2>
          <p className={styles.sectionHint}>
            Vue d&apos;ensemble de vos candidatures et de votre activité (après synchronisation des brouillons).
          </p>
          {loading ? (
            <p className={styles.panelHint}>Chargement...</p>
          ) : analyticsData ? (
            <div
              className={styles.metaGrid}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: "1rem",
                marginTop: "0.75rem",
              }}
            >
              <div className={styles.stepCard} style={{ padding: "0.75rem" }}>
                <div style={{ fontSize: "0.85rem", color: "var(--muted-text)" }}>Cibles totales</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{analyticsData.total_targets}</div>
              </div>
              <div className={styles.stepCard} style={{ padding: "0.75rem" }}>
                <div style={{ fontSize: "0.85rem", color: "var(--muted-text)" }}>Brouillons créés</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{analyticsData.drafts_crees}</div>
                <div style={{ fontSize: "0.8rem" }}>{analyticsData.taux_drafts_crees} %</div>
              </div>
              <div className={styles.stepCard} style={{ padding: "0.75rem" }}>
                <div style={{ fontSize: "0.85rem", color: "var(--muted-text)" }}>Envoyés / relances</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{analyticsData.candidatures_sent}</div>
              </div>
              <div className={styles.stepCard} style={{ padding: "0.75rem" }}>
                <div style={{ fontSize: "0.85rem", color: "var(--muted-text)" }}>Réponses positives</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--status-success-text)" }}>
                  {analyticsData.reponses_positives}
                </div>
              </div>
              <div className={styles.stepCard} style={{ padding: "0.75rem" }}>
                <div style={{ fontSize: "0.85rem", color: "var(--muted-text)" }}>Conversion réponse</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{analyticsData.taux_conversion_reponse} %</div>
              </div>
            </div>
          ) : (
            <p className={styles.emptyState}>
              Aucune donnée pour le moment. Lancez une recherche depuis le dashboard puis synchronisez les candidatures.
            </p>
          )}
        </section>

        <section className={styles.panel}>
          <h2>Liens utiles</h2>
          <p className={styles.sectionHint}>
            Accès rapide au tableau de bord, au suivi des candidatures et aux documents.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <Link href="/dashboard" className={styles.primaryBtn} style={{ display: "inline-block", textDecoration: "none" }}>
              Tableau de bord
            </Link>
            <Link
              href="/dashboard#candidatures"
              className={styles.secondaryBtn}
              style={{ display: "inline-block", textDecoration: "none" }}
            >
              Suivi de candidatures
            </Link>
            <Link
              href="/dashboard#step-documents"
              className={styles.secondaryBtn}
              style={{ display: "inline-block", textDecoration: "none" }}
            >
              Documents & templates
            </Link>
            <Link
              href="/dashboard#analytics"
              className={styles.secondaryBtn}
              style={{ display: "inline-block", textDecoration: "none" }}
            >
              Analyse produit
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
