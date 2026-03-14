import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>Alternance Hunter</p>
            <h1 className={styles.heroTitle}>
              Automatise tes candidatures d&apos;alternance, garde le contrôle.
            </h1>
            <p className={styles.heroSubtitle}>
              Prépare ton profil, importe tes documents, configure ton ciblage et laisse le
              pipeline générer et suivre tes candidatures dans Gmail avec des logs détaillés.
            </p>
            <div className={styles.heroActions}>
              <Link href="/dashboard" className={styles.primaryBtn}>
                Ouvrir le dashboard
              </Link>
              <Link href="/dashboard?demo=1" className={styles.secondaryBtn}>
                Voir le dashboard en démo
              </Link>
              <Link href="/login" className={styles.secondaryBtn}>
                Se connecter avec Google
              </Link>
              <Link
                href="https://github.com/Mahdi-Chaouch/alternance-killer"
                target="_blank"
                rel="noreferrer noopener"
                className={styles.ghostLink}
              >
                Voir le code sur GitHub
              </Link>
            </div>
            <p className={styles.heroMeta}>
              Pensé pour les étudiants dev qui veulent industrialiser leurs candidatures, sans
              perdre la personnalisation.
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Ce que fait l&apos;app</h2>
            <p className={styles.sectionLead}>
              Alternance Hunter automatise la partie répétitive de tes candidatures tout en gardant
              un contrôle fin sur le contenu envoyé.
            </p>
          </div>
          <div className={styles.benefitsGrid}>
            <article className={styles.card}>
              <h3 className={styles.cardTitle}>Gagne un temps précieux</h3>
              <p className={styles.cardText}>
                Centralise ton profil, ton CV, ta lettre et ton template d&apos;email pour lancer
                des dizaines de brouillons Gmail en quelques minutes.
              </p>
            </article>
            <article className={styles.card}>
              <h3 className={styles.cardTitle}>Personnalisation maîtrisée</h3>
              <p className={styles.cardText}>
                Ajoute des variables dynamiques et des filtres de ciblage pour adapter tes messages
                à chaque entreprise ou offre.
              </p>
            </article>
            <article className={styles.card}>
              <h3 className={styles.cardTitle}>Logs & suivi détaillés</h3>
              <p className={styles.cardText}>
                Suis chaque exécution dans un dashboard dédié, avec un terminal temps réel pour
                comprendre exactement ce qui se passe.
              </p>
            </article>
          </div>
        </section>

        <section className={styles.section} id="comment-ca-marche">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Comment ça marche ?</h2>
            <p className={styles.sectionLead}>
              Un flux clair en 5 étapes, de la connexion Gmail au suivi des logs.
            </p>
          </div>
          <ol className={styles.stepsList}>
            <li className={styles.stepItem}>
              <span className={styles.stepBadge}>1</span>
              <div>
                <h3 className={styles.stepTitle}>Connecte ton compte Gmail</h3>
                <p className={styles.stepText}>
                  Authentifie-toi via Google pour permettre à l&apos;app de créer des brouillons
                  d&apos;emails dans ta boîte, sans envoyer automatiquement.
                </p>
              </div>
            </li>
            <li className={styles.stepItem}>
              <span className={styles.stepBadge}>2</span>
              <div>
                <h3 className={styles.stepTitle}>Upload tes documents</h3>
                <p className={styles.stepText}>
                  Uploade ton CV, ta lettre de motivation et ton template d&apos;email pour les
                  réutiliser sur tous tes runs.
                </p>
              </div>
            </li>
            <li className={styles.stepItem}>
              <span className={styles.stepBadge}>3</span>
              <div>
                <h3 className={styles.stepTitle}>Configure ton ciblage</h3>
                <p className={styles.stepText}>
                  Choisis ton mode (dry-run ou réel), tes mots-clés, la zone géographique et les
                  limites pour éviter le spam.
                </p>
              </div>
            </li>
            <li className={styles.stepItem}>
              <span className={styles.stepBadge}>4</span>
              <div>
                <h3 className={styles.stepTitle}>Lance un run</h3>
                <p className={styles.stepText}>
                  Le pipeline génère les emails, crée les brouillons Gmail et enregistre chaque
                  étape dans la base.
                </p>
              </div>
            </li>
            <li className={styles.stepItem}>
              <span className={styles.stepBadge}>5</span>
              <div>
                <h3 className={styles.stepTitle}>Relis, personnalise, envoie</h3>
                <p className={styles.stepText}>
                  Tu gardes la main sur l&apos;envoi final depuis Gmail, avec tous les brouillons
                  prêts et les logs à portée de main.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Stack technique</h2>
            <p className={styles.sectionLead}>
              Une stack moderne, orientée développeurs, pensée pour être lisible et extensible.
            </p>
          </div>
          <div className={styles.techGrid}>
            <article className={styles.techCard}>
              <h3 className={styles.cardTitle}>Python & Gmail API</h3>
              <p className={styles.cardText}>
                Un backend Python qui orchestre la génération des emails et la création de
                brouillons via l&apos;API Gmail officielle.
              </p>
            </article>
            <article className={styles.techCard}>
              <h3 className={styles.cardTitle}>Next.js & React</h3>
              <p className={styles.cardText}>
                Une interface en Next.js App Router, typée et structurée comme un vrai produit SaaS
                moderne.
              </p>
            </article>
            <article className={styles.techCard}>
              <h3 className={styles.cardTitle}>Logs & observabilité</h3>
              <p className={styles.cardText}>
                Stockage structuré des exécutions, terminal temps réel et logs détaillés pour
                comprendre chaque run.
              </p>
            </article>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>À propos & contact</h2>
            <p className={styles.sectionLead}>
              Alternance Hunter est un projet personnel de Mahdi, pensé comme un vrai outil produit
              pour valoriser son profil de développeur.
            </p>
          </div>
          <div className={styles.aboutLayout}>
            <div>
              <p className={styles.aboutText}>
                Développeur orienté produit, j&apos;ai construit cet outil pour automatiser mes
                propres candidatures d&apos;alternance, tout en gardant un contrôle total sur ce
                qui part à chaque entreprise.
              </p>
              <p className={styles.aboutText}>
                Le projet met en avant ma capacité à concevoir un pipeline complet : ingestion de
                données, orchestration, intégration API et interface utilisateur orientée
                développeurs.
              </p>
            </div>
            <div className={styles.contactLinks}>
              <p className={styles.contactTitle}>Me contacter</p>
              <ul>
                <li>
                  <a href="mailto:mahdi@example.com" className={styles.contactLink}>
                    Email
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.linkedin.com"
                    target="_blank"
                    rel="noreferrer noopener"
                    className={styles.contactLink}
                  >
                    LinkedIn
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/Mahdi-Chaouch/alternance-killer"
                    target="_blank"
                    rel="noreferrer noopener"
                    className={styles.contactLink}
                  >
                    GitHub
                  </a>
                </li>
              </ul>
              <Link href="/dashboard" className={styles.primaryBtn}>
                Essayer le dashboard
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
