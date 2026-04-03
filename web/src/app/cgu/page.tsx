import styles from "../legal/legal.module.css";

export default function CGU() {
  return (
    <div className={styles.page}>
      <article className={styles.inner}>
      <h1>Conditions Générales d'Utilisation (CGU)</h1>
      <p>Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}</p>
      
      <section className={styles.section}>
        <h2>1. Objet</h2>
        <p>
          Les présentes Conditions Générales d'Utilisation ont pour objet de définir les modalités
          de mise à disposition de l'application Alternance Hunter et les conditions d'utilisation
          par l'Utilisateur. L'accès et l'utilisation de l'application impliquent l'acceptation sans
          réserve des présentes CGU.
        </p>
      </section>

      <section className={styles.section}>
        <h2>2. Description du service</h2>
        <p>
          Alternance Hunter est un outil technique destiné à aider les développeurs et étudiants à
          générer des brouillons d'emails de candidature dans leur propre boîte de messagerie (Gmail).
          Le service est fourni gratuitement "en l'état" dans le cadre d'un projet personnel.
        </p>
      </section>

      <section className={styles.section}>
        <h2>3. Responsabilité de l'Utilisateur</h2>
        <p>
          L'Utilisateur s'engage à faire un usage personnel et licite de l'application. En particulier,
          l'Utilisateur est seul responsable des emails et des contenus qu'il décide d'envoyer via sa
          propre adresse email à des recruteurs ou entreprises. Alternance Hunter ne fait que
          pré-remplir des brouillons et n'envoie aucun email de manière autonome sans l'action
          délibérée de l'Utilisateur. L'Utilisateur s'engage à ne pas pratiquer de "spam" (envoi massif
          et non sollicité).
        </p>
      </section>

      <section className={styles.section}>
        <h2>4. Limites de responsabilité</h2>
        <p>
          Alternance Hunter étant un projet expérimental, son auteur ne garantit pas la pérennité du service
          ou l'absence de bugs. Le développeur ne saurait être tenu responsable d'une mauvaise utilisation du
          quota Gmail de l'utilisateur, ou de tout incident résultant de l'utilisation de l'application.
        </p>
      </section>
      </article>
    </div>
  );
}
