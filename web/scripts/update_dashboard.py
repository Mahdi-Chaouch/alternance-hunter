import re
import os

page_tsx_path = "dashboard/page.tsx"
css_path = "page.module.css"

# 1. Update page.module.css to add Glassmorphism
with open(css_path, "r", encoding="utf-8") as f:
    css_content = f.read()

# Add backdrop filters and nice borders
css_content = css_content.replace(
    "  border: 1px solid var(--panel-border);",
    "  border: 1px solid rgba(255, 255, 255, 0.2);"
)

# Replace the panel background to be semi-transparent
css_content = re.sub(
    r"\.panel \{\n  border: 1px solid(.*?)\n  border-radius: 16px;\n  background: var\(--panel-bg\);",
    ".panel {\n  border: 1px solid rgba(148, 163, 184, 0.2);\n  border-radius: 20px;\n  background: rgba(255, 255, 255, 0.6);\n  backdrop-filter: blur(16px);\n  -webkit-backdrop-filter: blur(16px);\n  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.05);",
    css_content,
    flags=re.MULTILINE
)

# .card
css_content = re.sub(
    r"\.card \{\n  border-radius: 14px;\n  border: 1px solid(.*?)\n  background:(.*?);",
    ".card {\n  border-radius: 16px;\n  border: 1px solid rgba(148, 163, 184, 0.2);\n  background: rgba(255, 255, 255, 0.4);\n  backdrop-filter: blur(12px);",
    css_content,
    flags=re.MULTILINE
)

with open(css_path, "w", encoding="utf-8") as f:
    f.write(css_content)
    print("Updated page.module.css with Glassmorphism.")


# 2. Update dashboard/page.tsx to use Lucide Icons
with open(page_tsx_path, "r", encoding="utf-8") as f:
    tsx_content = f.read()

# Add import
import_statement = """import { 
  LayoutDashboard, User, FolderOpen, Settings, Terminal as TerminalIcon, 
  Save, LogOut, MapPin, Search, FileText, Mail, Play, Square, X, RefreshCw
} from "lucide-react";\n"""

tsx_content = re.sub(
    r'import \{ GoogleLogo \} from "@/app/components/GoogleLogo";',
    f'import {{ GoogleLogo }} from "@/app/components/GoogleLogo";\n{import_statement}',
    tsx_content
)

# Emojis in strings or JSX
replacements = {
    '"🔍"': '"Search"',
    '"📄"': '"FileText"',
    '"✉️"': '"Mail"',
    "📊 Tableau de bord": "<span style={{display: 'flex', alignItems: 'center', gap: '0.4rem'}}><LayoutDashboard size={18} /> Tableau de bord</span>",
    "👤 Profil expediteur": "<span style={{display: 'flex', alignItems: 'center', gap: '0.4rem'}}><User size={18} /> Profil expediteur</span>",
    "👤  Profil & personnalisation": "<span style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}><User size={24} /> Profil & personnalisation</span>",
    "📁 Documents & templates": "<span style={{display: 'flex', alignItems: 'center', gap: '0.4rem'}}><FolderOpen size={18} /> Documents & templates</span>",
    "📁 Vos documents": "<span style={{display: 'flex', alignItems: 'center', gap: '0.4rem'}}><FolderOpen size={18} /> Vos documents</span>",
    "⚙️ Options de recherche": "<span style={{display: 'flex', alignItems: 'center', gap: '0.4rem'}}><Settings size={18} /> Options de recherche</span>",
    "🖥️ Logs & terminal": "<span style={{display: 'flex', alignItems: 'center', gap: '0.4rem'}}><TerminalIcon size={18} /> Logs & terminal</span>",
    "💾 Enregistrer le travail": "<Save size={16} style={{marginRight: '0.4rem'}} /> Enregistrer le travail",
    "💾 Enregistrer mon profil": "<Save size={16} style={{marginRight: '0.4rem'}} /> Enregistrer mon profil",
    "🚪 Se deconnecter": "<LogOut size={16} style={{marginRight: '0.4rem'}} /> Se déconnecter",
    "▶️ Lancer la recherche": "<Play size={16} style={{marginRight: '0.4rem'}} /> Lancer la recherche",
    "🛑 Forcer l'arrêt": "<Square size={16} fill=\"currentColor\" style={{marginRight: '0.4rem'}} /> Forcer l'arrêt",
    "📍": "<MapPin size={18} style={{position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5}} />",
    "🗺️ Zone geographique": "<span style={{display: 'flex', alignItems: 'center', gap: '0.4rem'}}><MapPin size={18} /> Zone geographique</span>",
}

for old, new in replacements.items():
    tsx_content = tsx_content.replace(old, new)
    
# Replacing icons rendering in the pipeline steps
tsx_content = tsx_content.replace(
    '<span className={styles.runStepIcon}>{step.icon}</span>',
    '''<span className={styles.runStepIcon}>
                    {step.icon === "Search" && <Search size={22} />}
                    {step.icon === "FileText" && <FileText size={22} />}
                    {step.icon === "Mail" && <Mail size={22} />}
                  </span>'''
)

# And drop zone icon
tsx_content = tsx_content.replace(
    '<span className={styles.dropZoneIcon} aria-hidden="true">📁</span>',
    '<span className={styles.dropZoneIcon} aria-hidden="true"><FolderOpen size={32} /></span>'
)

with open(page_tsx_path, "w", encoding="utf-8") as f:
    f.write(tsx_content)
    print("Updated dashboard/page.tsx with Lucide icons.")

