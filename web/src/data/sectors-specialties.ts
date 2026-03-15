/**
 * Secteurs d'activité et spécialités associées.
 * Utilisé pour le filtre Overpass (secteur) et l'affinage des recherches / lettres (spécialité).
 * Secteurs it, food, law, trade, health, construction, all ont un filtre Overpass côté backend.
 * marketing et finance n'ont pas de filtre dédié (fallback backend).
 */
export type SectorId =
  | "it"
  | "food"
  | "law"
  | "trade"
  | "health"
  | "construction"
  | "marketing"
  | "finance"
  | "all";

export const SECTORS_SPECIALTIES: Record<SectorId, string[]> = {
  it: [
    "Développement web",
    "Développement logiciel",
    "DevOps",
    "Réseau / systèmes",
    "Cybersécurité",
    "Data / IA",
    "Game development",
    "Modélisation 3D",
    "UX/UI",
    "Product management",
  ],
  marketing: [
    "Marketing digital",
    "SEO / SEA",
    "Community management",
    "Sales",
    "Business development",
  ],
  finance: ["Comptabilité", "Audit", "Analyse financière"],
  food: [
    "Restauration",
    "Cuisine",
    "Boulangerie / Pâtisserie",
    "Traiteur",
    "Agroalimentaire",
  ],
  law: [
    "Droit des affaires",
    "Droit immobilier",
    "Notariat",
    "Assurance",
    "Conformité",
  ],
  trade: [
    "Commerce de détail",
    "E-commerce",
    "Achat / Logistique",
    "Merchandising",
  ],
  health: [
    "Soins infirmiers",
    "Pharmacie",
    "Administration santé",
    "Médical / Paramédical",
  ],
  construction: [
    "BTP",
    "Électricité",
    "Plomberie",
    "Architecture",
    "Gros œuvre",
  ],
  all: [],
};

export const SECTOR_LABELS: Record<SectorId, string> = {
  it: "Informatique / Digital",
  food: "Alimentation / Restauration",
  law: "Droit / Finance / Assurance",
  trade: "Commerce / Retail",
  health: "Santé / Médical",
  construction: "BTP / Construction / Artisanat",
  marketing: "Commerce / Marketing",
  finance: "Finance",
  all: "Tous secteurs",
};
