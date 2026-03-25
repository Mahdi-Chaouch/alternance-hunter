import os

with open("dashboard/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

start_str = '  return (\n    <div className={`${styles.page} ${theme === "dark" ? styles.pageDark : ""}`}>'
end_str = '        <div className={styles.topGrid}>'

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    before = content[:start_idx]
    after = content[end_idx:]
    
    replacement = """  return (
    <div className={`${styles.page} ${theme === "dark" ? styles.pageDark : ""}`} style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: 0, overflow: 'hidden' }}>
      {showDemoBanner ? (
          <div style={{ padding: '0.75rem', background: '#e8f4fc', borderBottom: '1px solid #0a7ea4', color: '#000', textAlign: 'center', flexShrink: 0, fontSize: '0.9rem' }}>
            <strong>Mode démo</strong> — Vous consultez le dashboard sans connexion. <Link href="/login" style={{ fontWeight: 600 }}>Connectez-vous</Link> pour utiliser toutes les fonctions.
          </div>
      ) : null}
      
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* SIDEBAR B2C POP */}
        <aside className={styles.sidebar} style={{ width: '280px', flexShrink: 0, borderRight: '1px solid rgba(139,92,246,0.15)', background: theme === 'dark' ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2.5rem', overflowY: 'auto' }}>
          
          <div className={styles.sidebarBrand} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '14px', background: 'linear-gradient(135deg, #8b5cf6, #d946ef)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '1.2rem', boxShadow: '0 8px 20px rgba(139,92,246,0.4)' }}>
              AH
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 800, background: 'linear-gradient(to right, #8b5cf6, #d946ef)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Alternance</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--subtle-text)', fontWeight: 700, letterSpacing: '0.04em' }}>HUNTER B2C</span>
            </div>
          </div>

          <nav className={styles.sidebarNav} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--subtle-text)', marginBottom: '0.5rem', fontWeight: 700 }}>Navigation Principale</div>
            <a href="#step-profil" className={styles.sidebarLink}><User size={18} /> Profil & Personnalisation</a>
            <a href="#step-documents" className={styles.sidebarLink}><FolderOpen size={18} /> Documents & Modèles</a>
            <a href="#step-config" className={styles.sidebarLink}><Settings size={18} /> Config. Recherche</a>
            <a href="#step-runs" className={styles.sidebarLink}><LayoutDashboard size={18} /> Historique & Suivi</a>
            <a href="#step-logs" className={styles.sidebarLink}><TerminalIcon size={18} /> Terminal Live</a>
          </nav>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button className={styles.secondaryBtn} type="button" onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))} style={{ width: '100%', justifyContent: 'center', borderRadius: '14px' }}>
              {theme === "light" ? "🌙 Mode Nuit" : "☀️ Mode Jour"}
            </button>
            {!showDemoBanner && (
              <>
                <button className={styles.primaryBtn} type="button" onClick={onSaveWorkInProgress} style={{ width: '100%', justifyContent: 'center', borderRadius: '14px', background: 'linear-gradient(to right, #8b5cf6, #d946ef)' }}>
                  <Save size={16} style={{marginRight: '0.4rem'}} /> Enregistrer le brouillon
                </button>
                <button className={styles.secondaryBtn} type="button" onClick={onSignOut} disabled={isSigningOut} style={{ width: '100%', justifyContent: 'center', borderRadius: '14px', border: 'none', background: 'transparent', color: 'var(--subtle-text)' }}>
                  {isSigningOut ? "Déconnexion..." : "Se déconnecter"}
                </button>
              </>
            )}
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className={styles.mainContentArea} style={{ flex: 1, padding: '2.5rem 3rem', overflowY: 'auto', background: 'transparent' }}>
          <header style={{ marginBottom: '2.5rem' }}>
            <h1 style={{ fontSize: '2.2rem', margin: '0 0 0.5rem 0', fontWeight: 800 }}>Content de vous revoir{firstName ? `, ${firstName}` : ''} 👋</h1>
            <p style={{ color: 'var(--subtle-text)', margin: 0, fontSize: '1.05rem' }}>Poursuivez la configuration ou lancez une nouvelle recherche ludique.</p>
          </header>

"""
    new_content = before + replacement + after
    
    # Check bottom tags
    end_tag = '      </main>\n    </div>\n  );\n}'
    end_idx = new_content.rfind(end_tag)
    if end_idx != -1:
        new_content = new_content[:end_idx] + '        </main>\n      </div>\n    </div>\n  );\n}'
    else:
        # if the end tag differs perfectly, just replace the last 3 lines manually
        new_content = new_content.replace('      </main>\n    </div>\n  );\n}', '        </main>\n      </div>\n    </div>\n  );\n}')
    
    with open("dashboard/page.tsx", "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Dashboard Sidebar injected perfectly!")
else:
    print("Tags not found.")
