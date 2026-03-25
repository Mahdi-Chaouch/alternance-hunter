import Link from "next/link";
import { MoveLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '2rem'
    }}>
      <div style={{
        fontSize: '6rem',
        fontWeight: 900,
        background: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        marginBottom: '1rem',
        lineHeight: 1
      }}>
        404
      </div>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem', fontWeight: 800 }}>Page introuvable</h1>
      <p style={{ color: 'var(--color-fg-muted)', marginBottom: '2.5rem', maxWidth: '400px', lineHeight: 1.6 }}>
        La page que vous recherchez n'existe pas ou a été déplacée. Revenez à l'accueil pour continuer.
      </p>
      <Link href="/" style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.8rem 1.5rem',
        background: 'rgba(139, 92, 246, 0.15)',
        color: '#8b5cf6',
        borderRadius: '999px',
        textDecoration: 'none',
        fontWeight: 600,
        border: '1px solid rgba(139, 92, 246, 0.3)',
        transition: 'all 0.2s ease'
      }}>
        <MoveLeft size={18} /> Retour à l'accueil
      </Link>
    </div>
  );
}
