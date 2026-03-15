#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Génération de lettres de motivation (LM) à partir du fichier draft et d'un template .docx.

Placeholders supportés dans le template :
  {{ENTREPRISE}}  - Nom de l'entreprise
  {{DATE}}        - Date du jour (jj/mm/aaaa)
  {{ZONE}}        - Zone géographique (ex: Paris (Paris-Centre))
  {{VILLE}}       - Ville (ex: Paris, Cannes, Fontainebleau, Auxerre)
  {{DOMAINE}}     - Domaine du site (ex: exemple.com)
  {{SITE}}        - URL du site
  {{SECTEUR}}     - Secteur d'activité (ex: Informatique / Digital)
  {{SPECIALITE}}  - Métier / spécialité (ex: Développement web)
  {{PARAGRAPHE_PERSONNALISE}} - Paragraphe généré par IA (si --use-ai)

Option --use-ai : utilise l'API OpenAI pour générer un paragraphe personnalisé
par entreprise (nécessite OPENAI_API_KEY). Le prompt utilise secteur et spécialité
pour adapter le paragraphe au domaine recherché.
"""

import argparse
import os
import re
import sys
from pathlib import Path
from datetime import date
from urllib.parse import urlparse

from docx import Document

SEP = "=============================="


def safe_filename(name: str) -> str:
    name = re.sub(r'[<>:"/\\|?*]', "", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name[:120]


def extract_domain(site: str) -> str:
    """Extrait le domaine (sans www) depuis une URL."""
    if not site:
        return ""
    try:
        netloc = urlparse(site.strip()).netloc or ""
        return netloc.replace("www.", "").lower().strip()
    except Exception:
        return ""


def extract_company_info(draft_file: str) -> list[dict]:
    """
    Parse le fichier draft et retourne une liste de dicts uniques par entreprise :
    { "company", "zone", "site", "domain" }
    """
    text = Path(draft_file).read_text(encoding="utf-8", errors="ignore")
    blocks = [b.strip() for b in text.split(SEP) if b.strip()]

    seen = set()
    result = []

    for block in blocks:
        m_company = re.search(r"Entreprise:\s*(.+)", block)
        m_zone = re.search(r"Zone:\s*(.+)", block)
        m_ville = re.search(r"Ville:\s*(.+)", block)
        m_site = re.search(r"Site:\s*(.+)", block)

        if not m_company:
            continue

        company = m_company.group(1).strip()
        key = company.lower()
        if key in seen:
            continue
        seen.add(key)

        zone = m_zone.group(1).strip() if m_zone else ""
        ville = m_ville.group(1).strip() if m_ville else ""
        site = m_site.group(1).strip() if m_site else ""
        domain = extract_domain(site)

        result.append({
            "company": company,
            "zone": zone,
            "ville": ville,
            "site": site,
            "domain": domain,
        })

    return result


def _replace_in_paragraph(p, replacements: dict) -> None:
    """Remplace les placeholders dans un paragraphe (conserve le premier run pour le texte)."""
    text = p.text
    if not any(ph in text for ph in replacements):
        return
    for placeholder, value in replacements.items():
        text = text.replace(placeholder, str(value or ""))
    for r in p.runs:
        r.text = ""
    if p.runs:
        p.runs[0].text = text


def _replace_in_cell(cell, replacements: dict) -> None:
    for p in cell.paragraphs:
        _replace_in_paragraph(p, replacements)


def replace_in_doc(
    doc: Document,
    info: dict,
    extra: dict | None = None,
    sector: str = "",
    specialty: str = "",
) -> None:
    """
    Remplace tous les placeholders dans le document.
    info : { company, zone, site, domain, ville }
    extra : { "{{PARAGRAPHE_PERSONNALISE}}": "..." } pour l'IA
    sector / specialty : contexte run pour {{SECTEUR}} et {{SPECIALITE}}
    """
    today = date.today().strftime("%d/%m/%Y")
    replacements = {
        "{{ENTREPRISE}}": info.get("company", ""),
        "{{DATE}}": today,
        "{{ZONE}}": info.get("zone", ""),
        "{{VILLE}}": info.get("ville", ""),
        "{{DOMAINE}}": info.get("domain", ""),
        "{{SITE}}": info.get("site", ""),
        "{{SECTEUR}}": sector,
        "{{SPECIALITE}}": specialty,
    }
    if extra:
        replacements.update(extra)

    for p in doc.paragraphs:
        _replace_in_paragraph(p, replacements)

    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                _replace_in_cell(cell, replacements)


def generate_personalized_paragraph(
    company: str,
    domain: str,
    api_key: str,
    model: str = "gpt-4o-mini",
    sector: str = "",
    specialty: str = "",
) -> str:
    """
    Appelle l'API OpenAI pour générer 2-3 phrases personnalisées pour la LM.
    sector / specialty permettent d'adapter le domaine (ex: alternance en X).
    """
    try:
        import openai
    except ImportError:
        return ""

    domain_label = specialty.strip() or sector.strip() or "développement web"
    client = openai.OpenAI(api_key=api_key)
    prompt = (
        f"Rédige en français, en 2 à 3 phrases maximum, un paragraphe pour une lettre de motivation "
        f"d'alternance en {domain_label}. Le candidat s'adresse à l'entreprise « {company} » "
        f"(site: {domain or 'non précisé'}). Le paragraphe doit expliquer brièvement pourquoi il serait "
        f"motivé de rejoindre cette entreprise (sans inventer de détails, ton professionnel et neutre). "
        f"Pas de formules de politesse, pas de liste à puces, uniquement le paragraphe."
    )
    try:
        r = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "Tu es un assistant qui rédige des paragraphes courts et professionnels pour des lettres de motivation."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=200,
        )
        text = (r.choices[0].message.content or "").strip()
        return text if text else ""
    except Exception:
        return ""


def _load_dotenv() -> None:
    """Charge les variables du fichier .env à la racine du projet (OPENAI_API_KEY, etc.)."""
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return
    try:
        for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, _, value = line.partition("=")
                key, value = key.strip(), value.strip().strip("'\"")
                if key and value:
                    os.environ.setdefault(key, value)
    except Exception:
        pass


def main() -> None:
    _load_dotenv()

    parser = argparse.ArgumentParser(description="Génère des LM .docx à partir du draft et du template.")
    parser.add_argument("--draft-file", default="data/exports/draft_emails.txt", help="Fichier draft (blocs Entreprise/Zone/Site)")
    parser.add_argument("--template", default="", help="Template Word avec placeholders (obligatoire; uploadez via l'UI ou --template /chemin)")
    parser.add_argument("--out-dir", default="outputs/letters", help="Dossier de sortie des LM")
    parser.add_argument("--use-ai", action="store_true",
                        help="Génère le paragraphe personnalisé via OpenAI (OPENAI_API_KEY requis)")
    parser.add_argument("--ai-model", default="gpt-4o-mini", help="Modèle OpenAI (défaut: gpt-4o-mini)")
    parser.add_argument("--sector", default="", help="Secteur d'activité pour placeholders et prompt IA")
    parser.add_argument("--specialty", default="", help="Métier / spécialité pour placeholders et prompt IA")

    args = parser.parse_args()

    draft = Path(args.draft_file)
    template = Path(args.template)
    outdir = Path(args.out_dir)

    if not draft.exists():
        raise SystemExit(f"❌ Fichier draft introuvable: {draft} (cwd={Path.cwd()})")

    if not args.template.strip() or not template.exists():
        raise SystemExit(
            "❌ Template LM requis. Uploadez un template (.docx) depuis l'interface web "
            "ou fournissez --template /chemin/vers/template.docx"
        )

    outdir.mkdir(parents=True, exist_ok=True)

    companies_info = extract_company_info(str(draft))
    print("Entreprises trouvées:", len(companies_info))
    if not companies_info:
        raise SystemExit("❌ Aucun bloc entreprise valide trouvé dans le fichier draft.")

    use_ai = args.use_ai
    api_key = os.environ.get("OPENAI_API_KEY", "").strip() if use_ai else ""
    if use_ai and not api_key:
        print("--use-ai demandé mais OPENAI_API_KEY non défini. Paragraphe personnalisé laissé vide.")
        use_ai = False

    sector = getattr(args, "sector", "") or ""
    specialty = getattr(args, "specialty", "") or ""

    generated = 0
    for info in companies_info:
        doc = Document(template)
        extra = None

        if use_ai:
            full_text = "\n".join(p.text for p in doc.paragraphs)
            for t in doc.tables:
                for row in t.rows:
                    for cell in row.cells:
                        full_text += "\n" + cell.text
            if "{{PARAGRAPHE_PERSONNALISE}}" in full_text:
                paragraph = generate_personalized_paragraph(
                    info["company"],
                    info.get("domain", ""),
                    api_key,
                    args.ai_model,
                    sector=sector,
                    specialty=specialty,
                )
                extra = {"{{PARAGRAPHE_PERSONNALISE}}": paragraph or "(Paragraphe non généré.)"}

        replace_in_doc(doc, info, extra, sector=sector, specialty=specialty)

        filename = safe_filename(info["company"]) + "_LM.docx"
        path = outdir / filename
        doc.save(path)
        generated += 1

    print("LM générées :", generated)
    print("Dossier :", outdir)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n⛔ Interrompu.")
        sys.exit(1)
