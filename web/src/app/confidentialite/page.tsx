import styles from "../legal/legal.module.css";

export default function Confidentialite() {
  return (
    <div className={styles.page}>
      <article className={styles.inner}>
      <h1>Politique de Confidentialité</h1>
      <p>Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}</p>

      <section className={styles.section}>
        <h2>1. Introduction</h2>
        <p>
          La présente politique détaille la façon dont Alternance Hunter utilise et protège les
          informations que vous transmettez en utilisant ce service.
        </p>
      </section>

      <section className={styles.section}>
        <h2>2. Connexion avec les services Google (Gmail API)</h2>
        <p>
          Alternance Hunter nécessite une connexion à votre compte Google pour fonctionner. L'accès demandé 
          se limite strictement à la permission de <strong>créer des brouillons</strong> d'e-mails. 
          L'application n'a pas accès à vos mots de passe et ne lit, ne supprime, ni ne modifie 
          les e-mails existants dans votre boîte de réception.
        </p>
        <p>
          Les données générées via ce processus (brouillons) restent dans votre écosystème Google.
        </p>
      </section>

      <section className={styles.section}>
        <h2>3. Données personnelles traitées</h2>
        <p>
          Afin de générer vos candidatures, nous stockons temporairement :
        </p>
        <ul>
          <li>Votre adresse email pour vous identifier,</li>
          <li>Les informations de profil et CV que vous fournissez (uniquement le temps du traitement si non enregistré),</li>
          <li>L'historique des "Runs" de candidatures pour alimenter votre Dashboard personnel.</li>
        </ul>
        <p>
          Ces données ne sont ni vendues, ni partagées avec des tiers à des fins commerciales.
        </p>
      </section>

      <section className={styles.section}>
        <h2>4. Hébergement et sécurité</h2>
        <p>
          Les données relatives à votre compte sont chiffrées et transitent de manière sécurisée (HTTPS).
          L'infrastructure est isolée et hébergée sur l'infrastructure sécurisée de Render.
        </p>
      </section>
      
      <section className={styles.section}>
        <h2>5. Vos droits</h2>
        <p>
          Vous bénéficiez d'un droit de consultation et de suppression de vos données. L'application devrait vous 
          proposer une option pour supprimer votre compte. À défaut, vous pouvez en faire la demande
          via l'adresse de contact du créateur, indiquée dans nos Mentions Légales.
        </p>
      </section>
      </article>
    </div>
  );
}
