# Marianne (optional)

Marianne is the official font of the French State. It is **not redistributed**
in this repository. To enable it, drop the following files here:

- `Marianne-Regular.woff2` (weight 400)
- `Marianne-Medium.woff2` (weights 500–600)
- `Marianne-Bold.woff2` (weights 700–800)

They ship with the DSFR (`@gouvfr/dsfr`, `dist/fonts/`). Once deployed, setting
the font to `Marianne` in the editor (Paramètres → Police) uses them; without
the files, the stack silently falls back to Inter. Any other value in that
field is treated as a Google Fonts family and loaded on demand.
