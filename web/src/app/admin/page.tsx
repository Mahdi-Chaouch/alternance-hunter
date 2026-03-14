import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-session";
import styles from "../page.module.css";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();

type SessionUser = {
  email?: string | null;
  name?: string | null;
};

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export default async function AdminPage() {
  const session = await getServerSession();
  const user = (session?.user ?? null) as SessionUser | null;
  const email = normalizeEmail(user?.email);

  if (!email) {
    redirect("/login");
  }

  // Si ADMIN_EMAIL est défini, seuls les admins y ont accès; sinon tout utilisateur autorisé (AUTH_ALLOWED_EMAILS) peut accéder.
  if (ADMIN_EMAIL && email !== ADMIN_EMAIL) {
    redirect("/dashboard");
  }

  return (
    <div className={`${styles.page} ${styles.pageDark}`}>
      <main className={styles.main}>
        <section className={styles.panel}>
          <p className={styles.eyebrow}>Administration</p>
          <h1>Dashboard admin</h1>
          <p className={styles.sectionHint}>
            Cette page est reservee au compte admin pour superviser l&apos;outil Alternance Hunter.
          </p>
          <dl className={styles.metaGrid}>
            <div>
              <dt>Email connecte</dt>
              <dd>{email}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>Administrateur</dd>
            </div>
          </dl>
          <p className={styles.sectionHint}>
            Tu pourras utiliser cette page pour ajouter des vues avancees (stats des runs, controle des
            comptes invites, sante du pipeline, etc.).
          </p>
        </section>
      </main>
    </div>
  );
}

