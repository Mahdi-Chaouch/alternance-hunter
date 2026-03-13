import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.panel}>
          <p className={styles.eyebrow}>Alternance Pipeline</p>
          <h1>Automatise tes candidatures d&apos;alternance</h1>
          <p className={styles.panelHint}>
            Configure un profil, importe ton CV et lance un pipeline qui trouve des cibles, genere
            des emails et cree des brouillons Gmail suivis par un dashboard temps reel.
          </p>
          <div className={styles.controls}>
            <Link href="/dashboard" className={styles.primaryBtn}>
              Ouvrir le dashboard
            </Link>
            <Link href="/login" className={styles.secondaryBtn}>
              Se connecter
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
