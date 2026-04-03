import Link from "next/link";
import { Zap, Target, Shield, Mail, ExternalLink, BarChart3 } from "lucide-react";
import { GoogleLogo } from "@/app/components/GoogleLogo";
import { FadeInSection } from "@/app/components/FadeInSection";
import styles from "./landing.module.css";

export default function Home() {
  return (
    <div className={`${styles.page} landing-home`}>
      <main className={styles.main}>

        {/* ── HERO ── */}
        <section className={styles.hero}>
          <div className={styles.heroBg} aria-hidden="true">
            <div className={`${styles.orb} ${styles.orbA}`} />
            <div className={`${styles.orb} ${styles.orbB}`} />
            <div className={`${styles.orb} ${styles.orbC}`} />
          </div>

          <div className={styles.betaPill}>
            <span className={styles.betaDot} />
            Beta gratuite · Aucune carte requise
          </div>

          <h1 className={styles.heroTitle}>
            Automatisez vos candidatures,{" "}
            <br />
            <span className={styles.textGradient}>gardez le contrôle absolu.</span>
          </h1>

          <p className={styles.heroSubtitle}>
            Créez en quelques secondes des brouillons d&apos;alternance ultra ciblés
            directement depuis Gmail. Vous validez chaque envoi&nbsp;: zéro spam,
            100&nbsp;% de pertinence.
          </p>

          <div className={styles.heroActions}>
            <Link href="/login" className={styles.primaryBtn}>
              <GoogleLogo size={20} />
              Continuer avec Google
            </Link>
            <a
              href="https://github.com/Mahdi-Chaouch/alternance-killer"
              target="_blank"
              rel="noreferrer noopener"
              className={styles.secondaryBtn}
            >
              Voir le code source
            </a>
          </div>

          {/* Product mock frame */}
          <div className={styles.heroProductFrame} aria-hidden="true">
            <div className={styles.frameTopbar}>
              <div className={styles.frameDots}>
                <span className={`${styles.frameDot} ${styles.frameDotRed}`} />
                <span className={`${styles.frameDot} ${styles.frameDotYellow}`} />
                <span className={`${styles.frameDot} ${styles.frameDotGreen}`} />
              </div>
              <div className={styles.frameUrl}>alternance-hunter.com/dashboard</div>
            </div>
            <div className={styles.frameBody}>
              <aside className={styles.frameSidebar}>
                <div className={styles.frameSidebarItem} />
                <div className={styles.frameSidebarItem} />
                <div className={styles.frameSidebarItem} />
                <div className={styles.frameSidebarSpacer} />
                <div className={styles.frameSidebarChip} />
              </aside>
              <section className={styles.frameMain}>
                <div className={styles.frameStatsRow}>
                  <div className={styles.frameStatCard} />
                  <div className={styles.frameStatCard} />
                  <div className={styles.frameStatCard} />
                </div>
                <div className={styles.frameTerminal}>
                  <div className={styles.frameTerminalHeader}>
                    <span className={styles.frameTerminalHeaderDot} />
                    Live logs &amp; Terminal
                  </div>
                  <div className={styles.frameTerminalLines}>
                    <div className={styles.frameLine} />
                    <div className={styles.frameLine} />
                    <div className={styles.frameLine} />
                    <div className={styles.frameLine} />
                    <div className={styles.frameLineShort} />
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div className={styles.heroTrustRow}>
            <div className={styles.heroTrustItem}>
              <span className={styles.heroTrustCheck}>✓</span>
              Aucun email envoyé sans validation
            </div>
            <div className={styles.heroTrustItem}>
              <span className={styles.heroTrustCheck}>✓</span>
              OAuth Google officiel
            </div>
            <div className={styles.heroTrustItem}>
              <span className={styles.heroTrustCheck}>✓</span>
              100&nbsp;% open source
            </div>
          </div>
        </section>

        {/* ── STATS STRIP ── */}
        <FadeInSection delay={0.05}>
          <div className={styles.statsStrip}>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>100&nbsp;%</span>
              <span className={styles.statLabel}>Contrôle utilisateur</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>0€</span>
              <span className={styles.statLabel}>Coût pendant la Beta</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>&lt;30s</span>
              <span className={styles.statLabel}>Brouillons générés</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>∞</span>
              <span className={styles.statLabel}>Candidatures</span>
            </div>
          </div>
        </FadeInSection>

        {/* ── FEATURES ── */}
        <FadeInSection delay={0.1}>
          <section className={styles.section} id="features">
            <div className={styles.sectionHeader}>
              <p className={styles.eyebrow}>Fonctionnalités</p>
              <h2 className={styles.sectionTitle}>Conçu pour l&apos;efficacité</h2>
              <p className={styles.sectionLead}>
                Fini les copier-coller interminables. Industrialisez votre
                recherche d&apos;alternance.
              </p>
            </div>
            <div className={styles.benefitsGrid}>
              <article className={styles.card}>
                <div className={styles.cardIcon}><Zap size={24} strokeWidth={1.75} /></div>
                <h3 className={styles.cardTitle}>Gagnez un temps précieux</h3>
                <p className={styles.cardText}>
                  Centralisez votre profil et votre CV une seule fois. Lancez un run
                  et obtenez des dizaines de brouillons en quelques secondes.
                </p>
              </article>
              <article className={styles.card}>
                <div className={styles.cardIcon}><Target size={24} strokeWidth={1.75} /></div>
                <h3 className={styles.cardTitle}>Personnalisation absolue</h3>
                <p className={styles.cardText}>
                  Variables dynamiques et ciblage intelligent. Chaque recruteur aura
                  l&apos;impression que l&apos;email n&apos;a été rédigé que pour lui.
                </p>
              </article>
              <article className={styles.card}>
                <div className={styles.cardIcon}><Shield size={24} strokeWidth={1.75} /></div>
                <h3 className={styles.cardTitle}>Contrôle Anti-Spam</h3>
                <p className={styles.cardText}>
                  Notre philosophie&nbsp;: nous générons les brouillons, vous validez.
                  Aucun email ne part sans votre approbation finale sur Gmail.
                </p>
              </article>
              <article className={styles.card}>
                <div className={styles.cardIcon}><BarChart3 size={24} strokeWidth={1.75} /></div>
                <h3 className={styles.cardTitle}>Suivi en temps réel</h3>
                <p className={styles.cardText}>
                  Dashboard live avec logs et terminal intégré. Suivez chaque étape
                  du pipeline de candidature en temps réel.
                </p>
              </article>
            </div>
          </section>
        </FadeInSection>

        {/* ── HOW IT WORKS ── */}
        <FadeInSection delay={0.1}>
          <section className={styles.section} id="how-it-works">
            <div className={styles.sectionHeader}>
              <p className={styles.eyebrow}>Processus</p>
              <h2 className={styles.sectionTitle}>Comment ça marche&nbsp;?</h2>
            </div>
            <div className={styles.stepsList}>
              <div className={styles.stepItem}>
                <div className={styles.stepBadge}>1</div>
                <div>
                  <h3 className={styles.stepTitle}>Connectez votre compte</h3>
                  <p className={styles.stepText}>
                    Connexion sécurisée via l&apos;API officielle Gmail pour créer des
                    brouillons — zéro mot de passe stocké.
                  </p>
                </div>
              </div>
              <div className={styles.stepItem}>
                <div className={styles.stepBadge}>2</div>
                <div>
                  <h3 className={styles.stepTitle}>Importez vos documents</h3>
                  <p className={styles.stepText}>
                    Uploadez votre CV en PDF et rédigez votre template d&apos;email avec
                    des variables dynamiques.
                  </p>
                </div>
              </div>
              <div className={styles.stepItem}>
                <div className={styles.stepBadge}>3</div>
                <div>
                  <h3 className={styles.stepTitle}>Lancez le bot</h3>
                  <p className={styles.stepText}>
                    Les brouillons sont instantanément créés dans votre boîte mail.
                    Relisez, ajustez, envoyez.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </FadeInSection>

        {/* ── PRICING ── */}
        <FadeInSection delay={0.1}>
          <section className={styles.section} id="pricing">
            <div className={styles.pricingSectionCard}>
              <div className={styles.sectionHeader}>
                <p className={styles.eyebrow}>Tarification</p>
                <h2 className={styles.sectionTitle}>Simple et transparent</h2>
                <p className={styles.sectionLead}>
                  L&apos;outil est actuellement un projet personnel. Profitez-en&nbsp;!
                </p>
              </div>
              <div className={`${styles.card} ${styles.pricingCard}`}>
                <span className={styles.pricingBadge}>Beta Accès Libre</span>
                <h3 className={styles.cardTitle}>Plan Étudiant</h3>
                <div className={styles.pricingPrice}>
                  <span className={styles.pricingCurrency}>0€</span>
                  <span className={styles.pricingPeriod}>&nbsp;/ mois</span>
                </div>
                <ul className={styles.pricingFeatures}>
                  <li className={styles.pricingFeature}>
                    <span className={styles.pricingCheck}>✔</span>
                    Accès complet au dashboard
                  </li>
                  <li className={styles.pricingFeature}>
                    <span className={styles.pricingCheck}>✔</span>
                    Stockage CV &amp; Templates
                  </li>
                  <li className={styles.pricingFeature}>
                    <span className={styles.pricingCheck}>✔</span>
                    Création de brouillons illimitée (limite Google)
                  </li>
                  <li className={styles.pricingFeature}>
                    <span className={styles.pricingCheck}>✔</span>
                    Live logs &amp; Terminal
                  </li>
                </ul>
                <Link href="/dashboard" className={styles.ctaBtn}>
                  Commencer gratuitement
                </Link>
              </div>
            </div>
          </section>
        </FadeInSection>

        {/* ── FAQ ── */}
        <FadeInSection delay={0.1}>
          <section className={styles.section} id="faq">
            <div className={styles.sectionHeader}>
              <p className={styles.eyebrow}>FAQ</p>
              <h2 className={styles.sectionTitle}>Questions fréquentes</h2>
            </div>
            <div className={styles.faqList}>
              <details className={styles.faqItem}>
                <summary className={styles.faqSummary}>
                  Est-ce que l&apos;application envoie les emails toute seule&nbsp;?
                </summary>
                <div className={styles.faqContent}>
                  Non. Alternance Hunter ne fait que <strong>créer des brouillons</strong>{" "}
                  dans votre boîte Gmail. C&apos;est une volonté stricte de notre part
                  pour vous garantir de ne jamais spammer d&apos;entreprises par erreur
                  et de relire avant d&apos;appuyer sur «&nbsp;Envoyer&nbsp;».
                </div>
              </details>
              <details className={styles.faqItem}>
                <summary className={styles.faqSummary}>
                  Mes données et mon mot de passe sont-ils en sécurité&nbsp;?
                </summary>
                <div className={styles.faqContent}>
                  Totalement. Nous ne stockons ni ne voyons jamais votre mot de passe
                  Gmail. Nous utilisons le système d&apos;authentification officiel de
                  Google (OAuth2). L&apos;accès est restreint techniquement à la seule
                  création de brouillons.
                </div>
              </details>
              <details className={styles.faqItem}>
                <summary className={styles.faqSummary}>
                  Est-ce vraiment gratuit&nbsp;?
                </summary>
                <div className={styles.faqContent}>
                  Dans sa version actuelle en beta, oui. C&apos;est un outil créé par un
                  étudiant en recherche d&apos;alternance, pour d&apos;autres personnes dans
                  le besoin. L&apos;hébergement est payé par le créateur.
                </div>
              </details>
            </div>
          </section>
        </FadeInSection>

        {/* ── CTA BANNER ── */}
        <FadeInSection delay={0.1}>
          <div className={styles.ctaBanner}>
            <div className={`${styles.ctaBannerOrb} ${styles.ctaBannerOrbA}`} aria-hidden="true" />
            <div className={`${styles.ctaBannerOrb} ${styles.ctaBannerOrbB}`} aria-hidden="true" />
            <div className={styles.ctaBannerContent}>
              <h2 className={styles.ctaBannerTitle}>
                Prêt à décrocher votre{" "}
                <span className={styles.textGradient}>alternance&nbsp;?</span>
              </h2>
              <p className={styles.ctaBannerLead}>
                Rejoignez les étudiants qui automatisent leur prospection et
                multiplient leurs chances d&apos;obtenir un entretien.
              </p>
              <div className={styles.ctaBannerActions}>
                <Link href="/login" className={styles.ctaBtn}>
                  <GoogleLogo size={20} />
                  Commencer gratuitement
                </Link>
                <Link href="/dashboard" className={styles.secondaryBtn}>
                  Voir le dashboard
                </Link>
              </div>
            </div>
          </div>
        </FadeInSection>

        {/* ── ABOUT & CONTACT ── */}
        <FadeInSection delay={0.1}>
          <section className={styles.section} id="about">
            <div className={`${styles.card} ${styles.aboutLayout}`}>
              <div>
                <h2 className={styles.cardTitle}>Le Projet &amp; Développeur</h2>
                <p className={`${styles.cardText} ${styles.aboutLeadText}`}>
                  Alternance Hunter est développé par{" "}
                  <strong>Mahdi Chaouch</strong>. C&apos;est une solution née d&apos;un
                  besoin réel lors de ma recherche d&apos;alternance.
                </p>
                <p className={styles.cardText}>
                  L&apos;infrastructure robuste s&apos;appuie sur Vercel pour le frontend
                  React/Next.js et Render pour l&apos;orchestration backend, garantissant
                  fluidité et fiabilité à chaque «&nbsp;Run&nbsp;».
                </p>
              </div>
              <div>
                <ul className={styles.contactLinks}>
                  <li>
                    <a
                      href="mailto:mahdichaouch435@gmail.com"
                      className={styles.contactLink}
                    >
                      <Mail size={16} />
                      Envoyer un email
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://www.linkedin.com/in/mahdi-chaouch-3a27263a0"
                      className={styles.contactLink}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <ExternalLink size={16} />
                      Profil LinkedIn
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://github.com/Mahdi-Chaouch/alternance-hunter"
                      className={styles.contactLink}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <ExternalLink size={16} />
                      Code Source (GitHub)
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </section>
        </FadeInSection>

      </main>
    </div>
  );
}
