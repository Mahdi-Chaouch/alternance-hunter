import Link from "next/link";
import { Zap, Target, Shield, Mail, ExternalLink } from "lucide-react";
import { GoogleLogo } from "@/app/components/GoogleLogo";
import { FadeInSection } from "@/app/components/FadeInSection";
import styles from "./landing.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        {/* HERO SECTION */}
        <section className={styles.hero}>
          <div className={styles.heroBackground} />
          <div className={styles.betaPill}>
            ● Beta gratuite · Aucune carte requise
          </div>
          <h1 className={styles.heroTitle}>
            Automatisez vos candidatures, <br />
            <span className={styles.textGradient}>gardez le contrôle absolu.</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Créez en quelques secondes des brouillons d'alternance ultra ciblés directement depuis Gmail.
            Vous validez chaque envoi : zéro spam, 100% de pertinence.
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

          {/* Product frame (placeholder statique) */}
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
                    Live logs & Terminal
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
              100% open source
            </div>
          </div>
        </section>

        {/* FEATURES SECTION */}
        <FadeInSection delay={0.1}>
          <section className={styles.section} id="features">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Conçu pour l'efficacité</h2>
              <p className={styles.sectionLead}>
                Fini les copier-coller interminables. Industrialisez votre recherche d'alternance.
              </p>
            </div>
            <div className={styles.benefitsGrid}>
              <article className={styles.card}>
                <div className={styles.cardIcon}><Zap size={40} strokeWidth={1.5} /></div>
                <h3 className={styles.cardTitle}>Gagnez un temps précieux</h3>
                <p className={styles.cardText}>
                  Centralisez votre profil et votre CV une seule fois. Lancez un run et obtenez 
                  des dizaines de brouillons en quelques secondes.
                </p>
              </article>
              <article className={styles.card}>
                <div className={styles.cardIcon}><Target size={40} strokeWidth={1.5} /></div>
                <h3 className={styles.cardTitle}>Personnalisation absolue</h3>
                <p className={styles.cardText}>
                  Variables dynamiques et ciblage intelligent. Chaque recruteur aura l'impression 
                  que l'email n'a été rédigé que pour lui.
                </p>
              </article>
              <article className={styles.card}>
                <div className={styles.cardIcon}><Shield size={40} strokeWidth={1.5} /></div>
                <h3 className={styles.cardTitle}>Contrôle Anti-Spam (Brouillons)</h3>
                <p className={styles.cardText}>
                  Notre philosophie : nous générons les brouillons, vous validez. Aucun email 
                  ne part sans votre approbation finale sur Gmail.
                </p>
              </article>
            </div>
          </section>
        </FadeInSection>

        {/* HOW IT WORKS */}
        <FadeInSection delay={0.1}>
          <section className={styles.section} id="how-it-works">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Comment ça marche ?</h2>
            </div>
            <div className={styles.stepsList}>
              <div className={styles.stepItem}>
                <div className={styles.stepBadge}>1</div>
                <div>
                  <h3 className={styles.stepTitle}>Connectez votre compte</h3>
                  <p className={styles.stepText}>Connexion sécurisée via l'API officielle Gmail pour créer des brouillons.</p>
                </div>
              </div>
              <div className={styles.stepItem}>
                <div className={styles.stepBadge}>2</div>
                <div>
                  <h3 className={styles.stepTitle}>Importez vos documents</h3>
                  <p className={styles.stepText}>Uploadez votre CV en PDF et rédigez votre template d'email avec des variables dynamiques.</p>
                </div>
              </div>
              <div className={styles.stepItem}>
                <div className={styles.stepBadge}>3</div>
                <div>
                  <h3 className={styles.stepTitle}>Lancez le bot</h3>
                  <p className={styles.stepText}>Les brouillons sont instantanément créés dans votre boîte mail.</p>
                </div>
              </div>
            </div>
          </section>
        </FadeInSection>

        {/* PRICING */}
        <FadeInSection delay={0.1}>
          <section className={styles.section} id="pricing">
            <div className={styles.pricingSectionCard}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Tarification simple</h2>
                <p className={styles.sectionLead}>
                  L'outil est actuellement un projet personnel. Profitez-en !
                </p>
              </div>
              <div className={`${styles.card} ${styles.pricingCard}`}>
              <span className={styles.pricingBadge}>Beta Accès Libre</span>
              <h3 className={styles.cardTitle}>Plan Étudiant</h3>
              <div className={styles.pricingPrice}>
                <span className={styles.pricingCurrency}>0€</span>
                <span className={styles.pricingPeriod}>/ mois</span>
              </div>
              <ul className={styles.pricingFeatures}>
                <li className={styles.pricingFeature}><span className={styles.pricingCheck}>✔</span> Accès complet au dashboard</li>
                <li className={styles.pricingFeature}><span className={styles.pricingCheck}>✔</span> Stockage CV & Templates</li>
                <li className={styles.pricingFeature}><span className={styles.pricingCheck}>✔</span> Création de brouillons illimitée (limite Google)</li>
                <li className={styles.pricingFeature}><span className={styles.pricingCheck}>✔</span> Live logs & Terminal</li>
              </ul>
              <Link href="/dashboard" className={styles.primaryBtn} style={{ width: '100%' }}>
                Commencer gratuitement
              </Link>
            </div>
            </div>
          </section>
        </FadeInSection>

        {/* FAQ */}
        <FadeInSection delay={0.1}>
          <section className={styles.section} id="faq">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Questions Fréquentes</h2>
            </div>
            <div className={styles.faqList}>
              <details className={styles.faqItem}>
                <summary className={styles.faqSummary}>Est-ce que l'application envoie les emails toute seule ?</summary>
                <div className={styles.faqContent}>
                  Non. Alternance Hunter ne fait que <b>créer des brouillons</b> dans votre boîte Gmail. 
                  C'est une volonté stricte de notre part pour vous garantir de ne jamais spammer d'entreprises par erreur et de relire avant d'appuyer sur "Envoyer".
                </div>
              </details>
              <details className={styles.faqItem}>
                <summary className={styles.faqSummary}>Mes données et mon mot de passe sont-ils en sécurité ?</summary>
                <div className={styles.faqContent}>
                  Totalement. Nous ne stockons ni ne voyons jamais votre mot de passe Gmail. Nous utilisons le système d'authentification officiel de Google (OAuth2). 
                  L'accès est restreint techniquement à la seule création de brouillons.
                </div>
              </details>
              <details className={styles.faqItem}>
                <summary className={styles.faqSummary}>Est-ce vraiment gratuit ?</summary>
                <div className={styles.faqContent}>
                  Dans sa version actuelle en beta, oui. C'est un outil créé par un étudiant en recherche d'alternance, pour d'autres personnes dans le besoin. L'hébergement est payé par le créateur.
                </div>
              </details>
            </div>
          </section>
        </FadeInSection>

        {/* ABOUT & CONTACT */}
        <FadeInSection delay={0.1}>
          <section className={styles.section} id="about">
            <div className={`${styles.card} ${styles.aboutLayout}`}>
              <div>
                <h2 className={styles.cardTitle}>Le Projet & Développeur</h2>
                <p className={`${styles.cardText} ${styles.aboutLeadText}`}>
                  Alternance Hunter est développé par <strong>Mahdi Chaouch</strong>. C'est une solution 
                  née d'un besoin réel lors de ma recherche d'alternance.
                </p>
                <p className={styles.cardText}>
                  L'infrastructure robuste s'appuie sur Vercel pour le frontend React/Next.js et Render 
                  pour l'orchestration backend, garantissant fluidité et fiabilité à chaque "Run".
                </p>
              </div>
              <div>
                <ul className={styles.contactLinks}>
                  <li><a href="mailto:mahdichaouch435@gmail.com" className={styles.contactLink}><Mail size={16} /> Envoyer un email</a></li>
                  <li><a href="https://www.linkedin.com/in/mahdi-chaouch-3a27263a0" className={styles.contactLink} target="_blank" rel="noreferrer noopener"><ExternalLink size={16} /> Profil LinkedIn</a></li>
                  <li><a href="https://github.com/Mahdi-Chaouch/alternance-hunter" className={styles.contactLink} target="_blank" rel="noreferrer noopener"><ExternalLink size={16} /> Code Source (GitHub)</a></li>
                </ul>
              </div>
            </div>
          </section>
        </FadeInSection>

      </main>
    </div>
  );
}
