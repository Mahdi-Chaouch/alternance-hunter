import os

css_path = "page.module.css"

dark_mode_overrides = """
/* SAAS MODERN DARK MODE OVERRIDES */
.pageDark .panel,
:global(:root[data-theme="dark"]) .page .panel {
  background: rgba(15, 23, 42, 0.5);
  border-color: rgba(51, 65, 85, 0.6);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
}

.pageDark .card,
:global(:root[data-theme="dark"]) .page .card {
  background: rgba(15, 23, 42, 0.4);
  border-color: rgba(51, 65, 85, 0.5);
}

.pageDark .stepCard,
:global(:root[data-theme="dark"]) .page .stepCard {
  background: radial-gradient(circle at top left, rgba(1, 178, 178, 0.08), transparent 55%),
    radial-gradient(circle at bottom right, rgba(168, 85, 247, 0.06), transparent 55%),
    rgba(15, 23, 42, 0.6);
  border-color: rgba(51, 65, 85, 0.6);
}

.pageDark .headerCard,
:global(:root[data-theme="dark"]) .page .headerCard {
  background: radial-gradient(circle at top left, rgba(1, 178, 178, 0.1), rgba(15, 23, 42, 0.8));
  border-color: rgba(51, 65, 85, 0.6);
}

/* Also fix inputs inside dark mode to look more premium */
.pageDark .zoneFieldInput,
:global(:root[data-theme="dark"]) .page .zoneFieldInput,
.pageDark .profileCard input,
:global(:root[data-theme="dark"]) .page .profileCard input,
.pageDark .profileCard textarea,
:global(:root[data-theme="dark"]) .page .profileCard textarea {
  background: rgba(2, 6, 23, 0.6);
  border-color: rgba(51, 65, 85, 0.8);
  color: #f8fafc;
}
"""

with open(css_path, "a", encoding="utf-8") as f:
    f.write(dark_mode_overrides)

print("Dark mode specific glassmorphism overrides added successfully.")
