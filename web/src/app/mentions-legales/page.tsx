import styles from "../legal/legal.module.css";

export default function MentionsLegales() {
  return (
    <div className={styles.page}>
      <article className={styles.inner}>
      <h1>Mentions Légales</h1>
      <p>Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}</p>

      <section className={styles.section}>
        <h2>1. Éditeur de l'application</h2>
        <p>
          Alternance Hunter est une application web développée et éditée par :<br />
          <strong>Mahdi Chaouch</strong> (Développeur indépendant).<br />
          Contact : <a href="mailto:mahdichaouch435@gmail.com">mahdichaouch435@gmail.com</a>
          
        </p>
      </section>

      <section className={styles.section}>
        <h2>2. Hébergement</h2>
        <p>
          L'interface frontend de l'application est hébergée par :<br />
          <strong>Vercel Inc.</strong><br />
          340 S Lemon Ave #4133<br />
          Walnut, CA 91789, USA<br />
          Site web : <a href="https://vercel.com" target="_blank" rel="noreferrer">vercel.com</a>
        </p>
        <p>
          Le backend et l'API de l'application sont hébergés par :<br />
          <strong>Render Networks</strong><br />
          525 Brannan St Suite 300<br />
          San Francisco, CA 94107, USA<br />
          Site web : <a href="https://render.com" target="_blank" rel="noreferrer">render.com</a>
        </p>
      </section>

      <section className={styles.section}>
        <h2>3. Propriété intellectuelle</h2>
        <p>
          L'ensemble des éléments constituant l'application (textes, graphismes, logiciels, photographies, images, logos, etc.) sont protégés par le droit de la propriété intellectuelle. Toute reproduction, représentation, modification ou adaptation de ces éléments est strictement interdite sans l'autorisation expresse du créateur.
        </p>
      </section>
      </article>
    </div>
  );
}
