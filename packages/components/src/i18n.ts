/**
 * LOCAL editor catalog — same discipline as the core catalog data
 * (data/catalog.*.ts), keys prefixed `editor.*`.
 *
 * WHY A SECOND CATALOG. The core catalog is the exhaustive catalog of the
 * labels *the deck generates*: it deliberately says nothing about the editor's
 * chrome (tabs, field hints, counters, history wording). Adding editor labels
 * there would inflate a frozen content contract with strings no slide shows, so
 * the editor carries its own catalog, in the same format and with the same
 * discipline: no string is written in a template, every one goes through `te()`.
 *
 * `te()` falls back to the domain catalog, so a view asks for `stage.ready` or
 * `sheet.goal` exactly as a slide does — the shared labels are defined ONCE,
 * in the core catalog, and are never restated here.
 *
 * French typography: the non-breaking spaces before `: ; ? !` and `%` live in
 * these strings — never applied to text the user typed.
 *
 * PURE module: no Svelte, no DOM, no clock.
 */
import { isCatalogKey, t, type CatalogKey, type Slots } from '@project-review/core/services/i18n'
import type { Language } from '@project-review/core/model/theme'

interface Entry {
  readonly fr: string
  readonly en: string
}

const NBSP = ' '

/** Closed editor keys; each entry supplies every supported language. */
export const EDITOR_CATALOG = {
  /* ------------------------------- shell -------------------------------- */
  'editor.nav.portfolio': { fr: 'Portefeuille', en: 'Portfolio' },
  'editor.nav.review': { fr: 'Revue', en: 'Review' },
  'editor.nav.projects': { fr: 'Projets', en: 'Projects' },
  'editor.nav.settings': { fr: 'Paramètres', en: 'Settings' },
  'editor.nav.data': { fr: 'Données', en: 'Data' },
  'editor.nav.import': { fr: 'Importer…', en: 'Import…' },
  'editor.nav.export': { fr: 'Exporter…', en: 'Export…' },
  'editor.nav.history': { fr: 'Historique', en: 'History' },
  'editor.nav.aria': { fr: "Navigation de l'application", en: 'Application navigation' },
  'editor.nav.collapse': { fr: 'Replier le panneau', en: 'Collapse the panel' },
  'editor.nav.expand': { fr: 'Déplier le panneau', en: 'Expand the panel' },
  'editor.nav.open': { fr: 'Ouvrir la navigation', en: 'Open the navigation' },
  'editor.nav.skip': { fr: 'Aller au contenu', en: 'Skip to content' },
  /* Screen name for assistive tech (the shell's visually hidden h1); the four
     route names reuse their nav labels, the sheet composes its own. */
  'editor.screen.sheet': { fr: 'Fiche projet {id}', en: 'Project sheet {id}' },
  'editor.foot.counts': {
    fr: `{tracked} suivis${NBSP}· {archived} archivés`,
    en: '{tracked} tracked · {archived} archived',
  },
  'editor.foot.deck': { fr: `deck${NBSP}: {n} slides`, en: 'deck: {n} slides' },
  'editor.about.built': { fr: 'Développé en 2026', en: 'Built in 2026' },
  'editor.about.author': { fr: 'François Cabouat', en: 'François Cabouat' },

  /* ---- About screen (`#/about`) — the notices travel with the artifact ---- */
  'editor.nav.about': { fr: 'À propos et licences', en: 'About and licenses' },
  'editor.about.product': { fr: 'Le logiciel', en: 'The software' },
  'editor.about.pitch': {
    fr: `Une application de revue de portefeuille projets en un seul fichier HTML${NBSP}: pas de serveur, pas d'installation, les données ne quittent pas le navigateur.`,
    en: 'A project-portfolio review application in a single HTML file: no server, no install, the data never leaves the browser.',
  },
  'editor.about.license': { fr: 'Licence', en: 'License' },
  'editor.about.licenseMit': {
    fr: 'Ce logiciel est distribué sous licence MIT.',
    en: 'This software is distributed under the MIT license.',
  },
  /* The permission texts themselves travel as a neighbour file of the
     deliverable (`dist/THIRD-PARTY-LICENSES.txt`, written by
     `pnpm run docs:notices`): the table below names the components, that file
     carries their terms in full. Split around the filename so the screen can
     render the filename as a link. */
  'editor.about.licenseTextsLead': {
    fr: `Les textes complets des licences des composants ci-dessous accompagnent le livrable, dans le fichier «${NBSP}`,
    en: 'The full licence texts of the components below travel with the deliverable, in the “',
  },
  'editor.about.licenseTextsTrail': {
    fr: `${NBSP}» placé à côté de lui.`,
    en: '” file placed beside it.',
  },
  'editor.about.thirdParty': {
    fr: 'Composants tiers embarqués',
    en: 'Embedded third-party components',
  },
  'editor.about.thirdPartyLead': {
    fr: `Ce fichier embarque le code et les polices ci-dessous. Chaque licence a été relevée dans le paquet réellement installé${NBSP}; les textes de licence restent en anglais, tels quels.`,
    en: 'This file embeds the code and typefaces below. Each license was read from the package actually installed; the license texts are kept in English, verbatim.',
  },

  'editor.topbar.undo': { fr: 'Annuler', en: 'Undo' },
  'editor.topbar.redo': { fr: 'Rétablir', en: 'Redo' },
  'editor.topbar.language': { fr: "Langue de l'application", en: 'Application language' },
  /* Menu items of the language dropdown — NATIVE names, invariant on purpose:
     a language list reads best in its own tongue. */
  'editor.language.fr': { fr: 'Français', en: 'Français' },
  'editor.language.en': { fr: 'English', en: 'English' },
  'editor.topbar.slideshow': {
    fr: `Générer le diaporama${NBSP}▸`,
    en: `Generate the slideshow${NBSP}▸`,
  },
  'editor.topbar.openSlideshow': {
    fr: 'Ouvrir le diaporama plein écran',
    en: 'Open the slideshow full screen',
  },

  /* ----------------------------- slideshow ------------------------------ */
  /* Slideshow exit bar: hidden by default, revealed on the top edge. */
  'editor.slideshow.bar': { fr: 'Barre de sortie du diaporama', en: 'Slideshow exit bar' },
  'editor.slideshow.back': { fr: "‹ Retour à l'éditeur", en: '‹ Back to the editor' },
  'editor.slideshow.print': { fr: 'Imprimer', en: 'Print' },
  'editor.slideshow.close': { fr: '✕ Fermer', en: '✕ Close' },
  'editor.slideshow.overview': { fr: "Vue d'ensemble", en: 'Overview' },
  'editor.slideshow.fullscreen': { fr: 'Plein écran', en: 'Full screen' },
  'editor.slideshow.fullscreenExit': { fr: 'Quitter le plein écran', en: 'Exit full screen' },
  'editor.slideshow.save': { fr: 'Enregistrer', en: 'Save' },
  'editor.slideshow.hint': {
    fr: `La barre apparaît au survol du bord haut${NBSP}; Échap bascule la vue d'ensemble.`,
    en: 'The bar appears when hovering the top edge; Esc toggles the overview.',
  },
  'editor.slideshow.loading': { fr: 'Chargement du diaporama…', en: 'Loading the slideshow…' },
  /* The engine did not come up. Said out loud, with the one move that helps:
     a « loading » line that never ends is a failure the person cannot name. */
  'editor.slideshow.bootFailed': {
    fr: `Le moteur du diaporama n'a pas pu être chargé.`,
    en: 'The slideshow engine could not be loaded.',
  },
  'editor.slideshow.retry': { fr: 'Réessayer', en: 'Try again' },
  /* The standalone export: three more states beside the offer itself. */
  'editor.slideshow.saving': { fr: 'Enregistrement…', en: 'Saving…' },
  'editor.slideshow.saved': { fr: 'Fichier enregistré', en: 'File saved' },
  'editor.slideshow.saveFailed': {
    fr: `L'enregistrement a échoué`,
    en: 'Saving failed',
  },
  'editor.slideshow.saveRetry': { fr: 'Réessayer', en: 'Try again' },
  'editor.slideshow.aria': { fr: 'Diaporama', en: 'Slideshow' },
  'editor.slideshow.printAria': {
    fr: `Aperçu d'impression${NBSP}: {n} pages A4 paysage`,
    en: 'Print preview: {n} A4 landscape pages',
  },

  /* ------------------------- fields, one by one -------------------------- */
  'editor.field.org': { fr: 'Organisation', en: 'Organisation' },
  'editor.field.unit': { fr: 'Service', en: 'Department' },
  'editor.field.orgLong': { fr: 'Organisation (forme longue)', en: 'Organisation (long form)' },
  'editor.field.unitLong': { fr: 'Service (forme longue)', en: 'Department (long form)' },
  'editor.field.contact': { fr: 'Contact', en: 'Contact' },
  'editor.field.title': { fr: 'Titre', en: 'Title' },
  'editor.field.subtitle': { fr: 'Sous-titre', en: 'Subtitle' },
  'editor.field.reviewDate': { fr: 'Date de revue', en: 'Review date' },
  'editor.field.previousReviewDate': { fr: 'Revue précédente', en: 'Previous review' },

  'editor.field.name': { fr: 'Nom', en: 'Name' },
  'editor.field.categoryId': { fr: 'Catégorie', en: 'Category' },
  'editor.field.priority': { fr: 'Priorité', en: 'Priority' },
  'editor.field.stage': { fr: 'Étape', en: 'Stage' },
  'editor.field.onHold': { fr: 'En attente', en: 'On hold' },
  'editor.field.health': { fr: 'Santé', en: 'Health' },
  'editor.field.progress': { fr: 'Avancement', en: 'Progress' },
  'editor.field.lead': { fr: 'Porteur', en: 'Lead' },
  'editor.field.sponsor': { fr: 'Sponsor', en: 'Sponsor' },
  'editor.field.scope': { fr: 'Périmètre', en: 'Scope' },
  'editor.field.goal': { fr: 'Objectif', en: 'Goal' },
  'editor.field.budget': { fr: 'Budget', en: 'Budget' },
  'editor.field.start': { fr: 'Début', en: 'Start' },
  'editor.field.targetEnd': { fr: 'Fin cible', en: 'Target end' },
  'editor.field.actualEnd': { fr: 'Fin réelle', en: 'Actual end' },
  'editor.field.risks': { fr: 'Risques', en: 'Risks' },
  'editor.field.sheet': { fr: 'Slide de détail', en: 'Detail slide' },
  'editor.field.updatedOn': { fr: 'Mis à jour', en: 'Updated' },
  'editor.field.author': { fr: 'Rédacteur', en: 'Writer' },
  'editor.field.id': { fr: 'ID', en: 'ID' },

  'editor.setting.language': { fr: 'Langue', en: 'Language' },
  'editor.setting.navigation': { fr: 'Navigation du diaporama', en: 'Slideshow navigation' },
  'editor.navigation.sections': { fr: 'Par sections', en: 'By section' },
  'editor.navigation.linear': { fr: 'Linéaire', en: 'Linear' },
  'editor.navigation.hint': {
    fr: 'Par sections : ← → entre sections, ↑ ↓ à l’intérieur. Linéaire : ← → parcourt toutes les slides. Ce choix est conservé dans l’export HTML.',
    en: 'By section: ← → between sections, ↑ ↓ within them. Linear: ← → visits every slide. The HTML export keeps this choice.',
  },
  'editor.setting.palette': { fr: 'Palette', en: 'Palette' },
  'editor.setting.font': { fr: 'Police', en: 'Font' },
  /* History wording of the `fontFaces` setting (the value side is
     `editor.value.fontFaces`). */
  'editor.setting.fontFaces': { fr: 'Police embarquée', en: 'Embedded font' },
  /* Same pairing for the palette the portfolio carries itself. */
  'editor.setting.customPalette': {
    fr: 'Palette du portefeuille',
    en: 'Portfolio palette',
  },
  'editor.setting.healthDashboard': { fr: 'Dashboard santé', en: 'Health dashboard' },
  'editor.setting.recap': { fr: 'Récapitulatif', en: 'Recap' },
  'editor.setting.archives': { fr: 'Archives', en: 'Archives' },
  'editor.setting.decisions': { fr: 'Décisions', en: 'Decisions' },
  'editor.setting.recapRows': { fr: 'Lignes par page', en: 'Rows per page' },

  /* --------------------------- shared values ----------------------------- */
  'editor.value.yes': { fr: 'oui', en: 'yes' },
  'editor.value.no': { fr: 'non', en: 'no' },
  'editor.value.empty': { fr: '(vide)', en: '(empty)' },
  'editor.value.image': { fr: 'image', en: 'image' },
  // Data URIs would flood the history: faces are counted, never spelled out.
  'editor.value.fontFaces': { fr: '{n} fonte(s)', en: '{n} face(s)' },
  // Twelve hex values would flood it just as much: the palette is named.
  'editor.value.customPalette': { fr: '12 couleurs', en: '12 colours' },
  'editor.value.pct': { fr: `{n}${NBSP}%`, en: `{n}${NBSP}%` },
  'editor.palette.tailwind': { fr: 'Tailwind', en: 'Tailwind' },
  'editor.palette.material': { fr: 'Material', en: 'Material' },
  /* The house family — its name says how it is built (one lightness, one
     chroma, a regular hue step), not who it belongs to. */
  'editor.palette.uniform': { fr: 'Uniforme', en: 'Uniform' },
  /* The palette the PORTFOLIO carries, when it brought no label of its own. */
  'editor.palette.portfolio': { fr: 'Palette du portefeuille', en: 'Portfolio palette' },
  'editor.sheetMode.auto': {
    fr: 'Auto — slide de détail affichée si le projet est prêt, en cours ou en reliquats, ou s’il porte une décision attendue',
    en: 'Auto — detail slide shown when the project is ready, in progress or in residuals, or carries a pending decision',
  },
  'editor.sheetMode.always': {
    fr: 'Toujours — slide de détail affichée quoi qu’il arrive (ex.\u00A0: garder consultable la fiche d’un projet archivé)',
    en: 'Always — detail slide shown no matter what (e.g. keep an archived project’s sheet browsable)',
  },
  'editor.sheetMode.never': {
    fr: 'Jamais — pas de slide de détail\u00A0: le projet n’apparaît qu’au récapitulatif',
    en: 'Never — no detail slide: the project only appears in the recap',
  },
  'editor.sheetMode.auto.short': { fr: 'A', en: 'A' },
  'editor.sheetMode.always.short': { fr: 'T', en: 'A' },
  'editor.sheetMode.never.short': { fr: 'J', en: 'N' },
  'editor.anchor.opening': { fr: 'ouverture', en: 'opening' },
  'editor.anchor.closing': { fr: 'clôture', en: 'closing' },
  'editor.anchor.beforeCategory': { fr: 'avant «{sp}{name}{sp}»', en: 'before "{name}"' },

  /* --------------------------- review screen ----------------------------- */
  'editor.review.title': { fr: 'Revue', en: 'Review' },
  'editor.review.identity': { fr: 'Identité', en: 'Identity' },
  'editor.review.freeSlides': { fr: 'Slides libres', en: 'Free slides' },
  'editor.review.freeSlidesHint': {
    fr: 'Toutes les slides libres se gèrent ici. Choisissez leur position ; les flèches règlent leur ordre à une même position.',
    en: 'Manage all free slides here. Choose their position; arrows reorder slides at the same position.',
  },
  'editor.review.dateHint': { fr: 'AAAA-MM-JJ', en: 'YYYY-MM-DD' },
  'editor.review.noFreeSlide': { fr: 'Aucune slide libre.', en: 'No free slide.' },

  /* -------------------------- projects screen ---------------------------- */
  'editor.projects.searchPlaceholder': {
    fr: 'Rechercher un projet par id, nom… (recherche floue)',
    en: 'Search a project by id, name… (fuzzy search)',
  },
  'editor.projects.searchLabel': { fr: 'Rechercher un projet', en: 'Search a project' },
  'editor.projects.total': { fr: '{n} projets', en: '{n} projects' },
  'editor.projects.found': { fr: '{n} / {total} —', en: '{n} / {total} —' },
  'editor.projects.clear': { fr: 'Effacer', en: 'Clear' },
  'editor.projects.none': { fr: 'Aucun projet ne correspond.', en: 'No project matches.' },
  'editor.projects.empty': {
    fr: 'Aucun projet — commencez par en ajouter un.',
    en: 'No project yet — start by adding one.',
  },
  'editor.projects.groupCount': { fr: '{n} projets', en: '{n} projects' },
  'editor.projects.groupCountOne': { fr: '1 projet', en: '1 project' },
  'editor.projects.archived': { fr: 'Archivés', en: 'Archived' },
  'editor.projects.add': { fr: '+ Ajouter un projet', en: '+ Add a project' },
  'editor.projects.newName': { fr: 'Nouveau projet', en: 'New project' },
  'editor.projects.edit': { fr: 'Modifier', en: 'Edit' },
  'editor.projects.delete': { fr: 'Supprimer', en: 'Delete' },
  'editor.projects.moveUp': { fr: 'Monter', en: 'Move up' },
  'editor.projects.moveDown': { fr: 'Descendre', en: 'Move down' },
  'editor.projects.pendingDecision': { fr: 'Décision attendue', en: 'Pending decision' },
  /* Row menu ("⋯") — move/delete reuse editor.projects.*, defined once above. */
  'editor.menu.actions': { fr: 'Actions', en: 'Actions' },
  'editor.menu.deleteConfirm': {
    fr: `Supprimer le projet «{sp}{id}{sp}»${NBSP}? (annulable)`,
    en: 'Delete project "{id}"? (undoable)',
  },
  'editor.projects.col.decision': { fr: 'Décis.', en: 'Dec.' },
  'editor.projects.col.slide': { fr: 'Détail', en: 'Detail' },
  'editor.projects.col.slideTitle': {
    fr: 'Slide de détail du projet dans le diaporama',
    en: 'Project detail slide in the slideshow',
  },
  'editor.projects.col.priority': { fr: 'Prio', en: 'Prio' },
  'editor.projects.col.id': { fr: 'ID', en: 'ID' },
  'editor.projects.col.project': { fr: 'Projet', en: 'Project' },
  'editor.projects.noProgressBeforeLaunch': {
    fr: "Pas d'avancement avant lancement",
    en: 'No progress before launch',
  },

  /* -------------------------- settings screen ---------------------------- */
  'editor.settings.appearance': { fr: 'Apparence', en: 'Appearance' },
  'editor.settings.aggregates': { fr: 'Diaporama', en: 'Slideshow' },
  'editor.settings.categories': { fr: 'Catégories', en: 'Categories' },
  'editor.settings.color': { fr: 'Couleur', en: 'Colour' },
  /* The 12 category colors of the data contract — the ADT values are
     code names, never shown raw. */
  'editor.color.blue': { fr: 'Bleu', en: 'Blue' },
  'editor.color.indigo': { fr: 'Indigo', en: 'Indigo' },
  'editor.color.teal': { fr: 'Sarcelle', en: 'Teal' },
  'editor.color.cyan': { fr: 'Cyan', en: 'Cyan' },
  'editor.color.green': { fr: 'Vert', en: 'Green' },
  'editor.color.olive': { fr: 'Olive', en: 'Olive' },
  'editor.color.amber': { fr: 'Ambre', en: 'Amber' },
  'editor.color.orange': { fr: 'Orange', en: 'Orange' },
  'editor.color.red': { fr: 'Rouge', en: 'Red' },
  'editor.color.purple': { fr: 'Violet', en: 'Purple' },
  'editor.color.brown': { fr: 'Brun', en: 'Brown' },
  'editor.color.taupe': { fr: 'Taupe', en: 'Taupe' },
  'editor.settings.anchor': { fr: 'Ancre', en: 'Anchor' },
  'editor.settings.blocks': {
    fr: 'Blocs (une ligne = une puce, ligne vide = nouveau bloc)',
    en: 'Blocks (one line = one bullet, blank line = new block)',
  },
  'editor.settings.add': { fr: '+ Ajouter', en: '+ Add' },
  'editor.settings.newCategory': { fr: 'Nouvelle catégorie', en: 'New category' },
  /* No family is ever fetched, so the hint names the three LOCAL sources and
     the fallback — the card's live verdict then says which one applies. */
  'editor.settings.fontHint': {
    fr: `Roboto ou Inter (fournies)${NBSP}; toute autre famille déployée à côté de l'application, ou embarquée ci-dessous. Aucune police n'est téléchargée auprès d'un tiers.`,
    en: 'Roboto or Inter (shipped); any other family deployed beside the app, or embedded below. No font is ever fetched from a third party.',
  },
  /* The deployment convention, with the CURRENT family in it — so a «not
     found» verdict says exactly which files are missing and where. */
  'editor.settings.deployedFiles': {
    fr: `Fichiers attendus sous fonts/{family}/${NBSP}: {family}-Regular.woff2 (400), {family}-Medium.woff2 (500–600), {family}-Bold.woff2 (700–800).`,
    en: 'Expected files under fonts/{family}/: {family}-Regular.woff2 (400), {family}-Medium.woff2 (500–600), {family}-Bold.woff2 (700–800).',
  },
  'editor.settings.fontProbe.unknown': {
    fr: 'Vérification de la police…',
    en: 'Checking the font…',
  },
  'editor.settings.fontProbe.served': {
    fr: `«${NBSP}{family}${NBSP}» servie par ce déploiement.`,
    en: '"{family}" is served by this deployment.',
  },
  'editor.settings.fontProbe.missing': {
    fr: `«${NBSP}{family}${NBSP}» introuvable ici — repli sur la pile système. Embarquez ses .woff2 ci-dessous pour qu'elle voyage avec le portefeuille.`,
    en: '"{family}" not found here — falling back to the system stack. Embed its .woff2 below to make it travel with the portfolio.',
  },
  /* Third source of the live verdict: the portfolio itself embeds the faces. */
  'editor.settings.fontProbe.embedded': {
    fr: 'Police embarquée dans le portefeuille.',
    en: 'Font embedded in the portfolio.',
  },
  /* Second source: the family ships inside this build (no deployment needed). */
  'editor.settings.fontProbe.bundled': {
    fr: `Police fournie avec l'application.`,
    en: 'Font shipped with the application.',
  },
  /* ---- embedded font faces (Settings ▸ Appearance) ---- */
  'editor.settings.embeddedFonts': { fr: 'Police embarquée', en: 'Embedded font' },
  'editor.settings.embedFiles': { fr: 'Embarquer des .woff2…', en: 'Embed .woff2 files…' },
  'editor.settings.embedFolder': { fr: 'Embarquer un dossier…', en: 'Embed a folder…' },
  'editor.settings.embedHint': {
    fr: `Les fichiers .woff2 voyagent dans le .json${NBSP}: la police suit le portefeuille, export autonome compris.`,
    en: 'The .woff2 files travel inside the .json: the font follows the portfolio, standalone export included.',
  },
  /* ---- portfolio identity: the three assets the .json carries ---- */
  'editor.settings.slideAppearance': {
    fr: 'Apparence des slides',
    en: 'Slide appearance',
  },
  'editor.settings.identityHint': {
    fr: `Thème, palette, police et logo voyagent dans le fichier .json${NBSP}: ils suivent le portefeuille, export autonome et impression compris.`,
    en: 'Slide theme, palette, font and logo travel inside the .json file: they follow the portfolio, standalone export and printing included.',
  },
  /* ONE licence line for the three — they raise the same question, and
     answering it three times would only make it easier to skip. It says what
     the README's IP clause and the About screen say: what a person imports
     stays under its own rights. */
  'editor.settings.assetsLicense': {
    fr: `Une palette, une police ou un logo importés restent soumis à leurs droits propres — les embarquer dans un fichier diffusé constitue une redistribution${NBSP}: vérifiez que leur licence l'autorise.`,
    en: 'An imported palette, font or logo stays under its own rights — embedding one in a distributed file is redistribution: check that its license allows it.',
  },
  /* The same verb for the three assets: one vocabulary, one gesture. */
  'editor.settings.removeAsset': { fr: 'Retirer', en: 'Remove' },
  'editor.settings.removeFaceAria': {
    fr: 'Retirer la fonte {family} {weight}',
    en: 'Remove the {family} {weight} face',
  },
  'editor.settings.faceItalic': { fr: 'italique', en: 'italic' },
  'editor.settings.faceSize': { fr: `~{n}${NBSP}Ko`, en: '~{n} KB' },
  'editor.settings.fontFaceTooBig': {
    fr: `«${NBSP}{name}${NBSP}» trop lourd pour être embarqué ({max}${NBSP}Ko max par fichier).`,
    en: '"{name}" too large to embed ({max} KB max per file).',
  },
  'editor.settings.fontsTotalTooBig': {
    fr: `Ensemble trop lourd${NBSP}: {max}${NBSP}Ko max de polices embarquées au total.`,
    en: 'Too large together: {max} KB max of embedded fonts in total.',
  },
  'editor.settings.fontFaceUnreadable': {
    fr: `«${NBSP}{name}${NBSP}» illisible, ou pas un fichier woff2.`,
    en: '"{name}" unreadable, or not a woff2 file.',
  },
  'editor.settings.noWoff2': {
    fr: 'Aucun fichier .woff2 dans la sélection.',
    en: 'No .woff2 file in the selection.',
  },
  'editor.setting.style': { fr: 'Thème', en: 'Theme' },
  'editor.style.flat': { fr: 'Flat', en: 'Flat' },
  'editor.style.institutional': { fr: 'Institutionnel', en: 'Institutional' },
  'editor.style.modern': { fr: 'Moderne', en: 'Modern' },
  /* Reader scheme (Settings ▸ Appearance) — an app-side preference, never a
     domain event: see `AppearanceControl` (screens/contracts). */
  'editor.setting.scheme': { fr: `Thème de l'interface`, en: 'Interface theme' },
  'editor.scheme.system': { fr: 'Système', en: 'System' },
  'editor.scheme.light': { fr: 'Clair', en: 'Light' },
  'editor.scheme.dark': { fr: 'Sombre', en: 'Dark' },
  'editor.settings.schemeHint': {
    fr: `Préférence de cet appareil — ne voyage pas avec le fichier${NBSP}; les slides restent claires.`,
    en: 'A preference of this device — it does not travel with the file; slides stay light.',
  },
  'editor.settings.paletteCount': { fr: '{n} couleurs', en: '{n} colours' },
  /* No palette carried: how one arrives. There is no editor for it on
     purpose — a palette is data, and it comes in with the data. */
  'editor.settings.paletteHint': {
    fr: `Un portefeuille peut porter ses douze couleurs${NBSP}: elles arrivent par le fichier de données (settings.theme.customPalette) et remplacent alors la famille choisie.`,
    en: 'A portfolio can carry its own twelve colours: they come in with the data file (settings.theme.customPalette) and then replace the chosen family.',
  },
  /* One is carried: it applies, and the families wait until it is removed. */
  'editor.settings.paletteApplies': {
    fr: `Les douze couleurs du portefeuille s'appliquent. Retirez-les pour revenir à une famille fournie (annulable).`,
    en: "The portfolio's twelve colours apply. Remove them to go back to a bundled family (undoable).",
  },
  'editor.settings.paletteRemoveAria': {
    fr: 'Retirer la palette du portefeuille',
    en: "Remove the portfolio's palette",
  },
  'editor.settings.logo': { fr: 'Logo', en: 'Logo' },
  'editor.settings.logoImport': { fr: 'Importer un logo…', en: 'Import a logo…' },
  'editor.settings.logoReset': { fr: 'Retirer le logo', en: 'Remove logo' },
  'editor.settings.logoNone': { fr: 'Aucun logo', en: 'No logo' },
  'editor.settings.logoHint': {
    fr: `SVG ou PNG, embarqué dans le fichier .json (300${NBSP}Ko max).`,
    en: 'SVG or PNG, embedded in the .json file (300 KB max).',
  },
  'editor.settings.logoTooBig': {
    fr: 'Image trop lourde pour être embarquée (300 Ko max).',
    en: 'Image too large to embed (300 KB max).',
  },
  /* ------------------------- data administration ------------------------- */
  'editor.data.persist': {
    fr: 'Sauvegarde locale (localStorage)',
    en: 'Local save (localStorage)',
  },
  'editor.data.persistHint': {
    fr: `La base et l'historique annuler/rétablir survivent au rechargement de la page.`,
    en: 'The database and the undo/redo history survive a page reload.',
  },
  /* The browser refuses local storage outright: the switch governs nothing,
     so it is disabled and says why rather than looking broken. */
  'editor.data.persistUnavailable': {
    fr: `Ce navigateur refuse le stockage local${NBSP}: rien ne sera enregistré ici. Exportez votre fichier pour le conserver.`,
    en: 'This browser refuses local storage: nothing will be saved here. Export your file to keep it.',
  },
  /* Turning the save back ON found a readable document already stored: the
     switch wrote nothing and asks. The three answers are the dialog's. */
  'editor.data.restoreTitle': {
    fr: 'Une sauvegarde existe déjà dans ce navigateur',
    en: 'A saved copy already exists in this browser',
  },
  'editor.data.restoreBody': {
    fr: `Rien n'a été écrit. Vous pouvez charger la sauvegarde à la place du document ouvert (annulable), ou garder le document ouvert — la sauvegarde sera alors remplacée.`,
    en: 'Nothing has been written. You can load the saved copy instead of the open document (undoable), or keep the open document — the saved copy is then replaced.',
  },
  'editor.data.restoreStored': { fr: 'Charger la sauvegarde', en: 'Load the saved copy' },
  'editor.data.restoreKeepOpen': {
    fr: 'Garder le document ouvert',
    en: 'Keep the open document',
  },
  'editor.data.persistOffConfirm': {
    fr: `Désactiver la sauvegarde locale efface les données enregistrées dans ce navigateur (la base ouverte reste intacte). Continuer${NBSP}?`,
    en: 'Turning local save off erases the data stored in this browser (the open database stays intact). Continue?',
  },
  /* Owner-validated guidance line: the sample sets live NEXT TO the app and
     on the project site, and come in through the ordinary import — the
     deliverable itself carries no content. */
  'editor.data.samplesHint': {
    fr: `Des portefeuilles d'exemple accompagnent l'app et le site du projet${NBSP}; importez-les comme n'importe quel fichier.`,
    en: 'Sample portfolios come with the app and the project site; import them like any file.',
  },
  'editor.data.purge': { fr: 'Purger la base', en: 'Purge the database' },
  'editor.data.purgeConfirm': {
    fr: `Vider catégories, projets et slides libres${NBSP}? La revue et les paramètres sont conservés. (annulable)`,
    en: 'Empty categories, projects and free slides? The review and the settings are kept. (undoable)',
  },
  'editor.data.resetSettings': { fr: 'Réinitialiser les réglages', en: 'Reset the settings' },
  'editor.data.resetSettingsConfirm': {
    fr: `Revenir au thème et à l'affichage par défaut${NBSP}? Langue et identité sont conservées. (annulable)`,
    en: 'Back to the default theme and display? Language and identity are kept. (undoable)',
  },
  'editor.data.undoHint': {
    fr: `Chaque action ci-dessus reste annulable (Ctrl+Z).`,
    en: 'Each action above stays undoable (Ctrl+Z).',
  },

  /* ---- the save state, permanently on screen (`SaveStateBar.svelte`) ----
     One entry per `SavePhase`. The two that need a person say what happened
     AND what can be done about it — never «an error occurred». */
  'editor.save.aria': {
    fr: 'État de la sauvegarde locale',
    en: 'Local save state',
  },
  'editor.save.dirty': {
    fr: 'Modifications non enregistrées',
    en: 'Unsaved changes',
  },
  'editor.save.saving': { fr: 'Enregistrement…', en: 'Saving…' },
  'editor.save.saved': {
    fr: 'Enregistré dans ce navigateur',
    en: 'Saved in this browser',
  },
  'editor.save.pending': {
    fr: 'Saisie en cours, sauvegarde du brouillon en attente. Quittez le champ pour valider.',
    en: 'Typing in progress, draft save pending. Leave the field to validate.',
  },
  'editor.save.draftSaved': {
    fr: 'Brouillons sauvegardés dans ce navigateur. Retrouvez-les dans leurs champs ; quittez un champ pour le valider.',
    en: 'Drafts saved in this browser. Return to their fields to resume; leave a field to validate it.',
  },
  'editor.save.error': {
    fr: `Échec de l'enregistrement local${NBSP}: ce document n'existe que dans cet onglet. Téléchargez-en une copie.`,
    en: 'Local save failed: this document exists only in this tab. Download a copy of it.',
  },
  'editor.save.unavailable': {
    fr: `Ce navigateur n'autorise aucune sauvegarde locale${NBSP}: ce document n'existe que dans cet onglet. Téléchargez-en une copie.`,
    en: 'This browser allows no local save: this document exists only in this tab. Download a copy of it.',
  },
  'editor.save.off': {
    fr: `La sauvegarde locale a été désactivée dans ce navigateur${NBSP}: ce document n'existe que dans cet onglet. Téléchargez-en une copie, ou réactivez la sauvegarde dans Paramètres ▸ Données.`,
    en: 'Local saving was switched off in this browser: this document exists only in this tab. Download a copy of it, or switch saving back on under Settings ▸ Data.',
  },
  'editor.save.download': { fr: 'Télécharger une copie', en: 'Download a copy' },
  'editor.save.downloadDrafts': { fr: 'Télécharger les brouillons', en: 'Download drafts' },
  'editor.save.conflict': {
    fr: `Un autre onglet a enregistré une version différente${NBSP}; rien n'a été écrasé. Choisissez laquelle garder.`,
    en: 'Another tab saved a different version; nothing was overwritten. Choose which one to keep.',
  },
  'editor.save.takeStored': {
    fr: `Charger la version de l'autre onglet`,
    en: "Load the other tab's version",
  },
  'editor.save.keepMine': { fr: 'Garder cette version', en: 'Keep this version' },

  'editor.settings.logoUnreadable': {
    fr: 'Fichier illisible ou format non reconnu.',
    en: 'Unreadable file or unrecognized format.',
  },
  'editor.settings.decrease': { fr: 'Diminuer', en: 'Decrease' },
  'editor.settings.increase': { fr: 'Augmenter', en: 'Increase' },
  'editor.settings.categoryUsage': { fr: '{n} projets', en: '{n} projects' },
  'editor.settings.categoryUsageOne': { fr: '1 projet', en: '1 project' },
  'editor.settings.deleteBlocked': {
    fr: 'Catégorie utilisée par {n} projet(s) — la vider avant de la supprimer',
    en: 'Category used by {n} project(s) — empty it before deleting',
  },

  /* ---------------------------- sheet screen ----------------------------- */
  'editor.sheet.breadcrumb': { fr: '‹ Portefeuille', en: '‹ Portfolio' },
  'editor.sheet.back': { fr: '← Retour au portefeuille', en: '← Back to the portfolio' },
  'editor.sheet.continuous': {
    fr: 'Modifications appliquées en continu — Ctrl+Z pour annuler',
    en: 'Changes applied continuously — Ctrl+Z to undo',
  },
  'editor.sheet.missing': { fr: 'Projet introuvable.', en: 'Project not found.' },
  'editor.sheet.idLocked': {
    fr: `Identifiant stable — modifiable uniquement via «${NBSP}Renuméroter${NBSP}»`,
    en: 'Stable identifier — changed only through "Renumber"',
  },
  'editor.sheet.renumber': { fr: 'Renuméroter', en: 'Renumber' },
  'editor.sheet.renumberPrompt': {
    fr: `Nouvel identifiant pour «${NBSP}{id}${NBSP}»${NBSP}?`,
    en: 'New identifier for "{id}"?',
  },
  'editor.sheet.renumberTaken': {
    fr: `L'identifiant «${NBSP}{id}${NBSP}» est déjà pris.`,
    en: 'Identifier "{id}" is already taken.',
  },

  'editor.tab.state': { fr: 'Cadre & état', en: 'Frame & status' },
  'editor.tab.narrative': { fr: 'Récit', en: 'Narrative' },
  'editor.tab.decisions': { fr: 'Décisions', en: 'Decisions' },
  'editor.tab.milestones': { fr: 'Jalons & dates', en: 'Milestones & dates' },
  'editor.tab.options': { fr: 'Options', en: 'Options' },

  'editor.sheet.status': { fr: 'État', en: 'Status' },
  'editor.sheet.frame': { fr: 'Cadre', en: 'Frame' },
  'editor.sheet.narrative': { fr: 'Récit de revue', en: 'Review narrative' },
  'editor.sheet.timeAndMilestones': { fr: 'Temps & jalons', en: 'Time & milestones' },
  'editor.sheet.options': { fr: 'Options', en: 'Options' },
  'editor.sheet.preview': { fr: 'Aperçu', en: 'Preview' },

  'editor.sheet.decisionIndex': { fr: 'Décision {n}', en: 'Decision {n}' },
  'editor.sheet.question': { fr: 'Question', en: 'Question' },
  'editor.sheet.decider': { fr: 'Décideur', en: 'Decision-maker' },
  'editor.sheet.taken': { fr: 'Décision prise', en: 'Decision taken' },
  'editor.sheet.decisionsHint': {
    fr: 'La fiche présente la première décision en attente, ou à défaut la dernière décision prise. Le relevé des décisions prises couvre la période jusqu’à la date de revue ; sans date de revue précédente, toutes les décisions antérieures sont incluses. Les projets archivés sont exclus du relevé.',
    en: 'The sheet shows the first pending decision, or otherwise the latest settled decision. The settled-decision summary covers the period up to the review date; without a previous review date, it includes all earlier decisions. Archived projects are excluded from the summary.',
  },
  'editor.sheet.takenText': { fr: 'Texte', en: 'Text' },
  'editor.sheet.takenWhen': { fr: 'Quand', en: 'When' },
  'editor.sheet.outcomeIncomplete': {
    fr: 'Renseignez le texte et une date valide pour enregistrer ce résultat. La saisie reste en attente.',
    en: 'Enter the text and a valid date to save this outcome. The draft is still pending.',
  },
  'editor.settings.blocksMany': {
    fr: 'Tous les blocs sont conservés. Au-delà de trois, vérifiez la lisibilité de la diapositive dans l’aperçu.',
    en: 'All blocks are kept. With more than three, check the slide’s readability in the preview.',
  },
  'editor.sheet.addDecision': {
    fr: '+ Ajouter une décision ({n} restantes)',
    en: '+ Add a decision ({n} left)',
  },
  'editor.sheet.decisionsFull': { fr: 'Trois décisions maximum.', en: 'Three decisions at most.' },
  'editor.sheet.removeDecision': { fr: 'Retirer cette décision', en: 'Remove this decision' },
  'editor.sheet.noDecision': {
    fr: 'Aucune décision portée à la revue.',
    en: 'No decision brought to the review.',
  },

  'editor.sheet.milestoneLabel': { fr: 'Libellé', en: 'Label' },
  'editor.sheet.milestoneDate': { fr: 'Date', en: 'Date' },
  'editor.sheet.milestoneDisplay': { fr: 'Affichage', en: 'Display' },
  'editor.sheet.milestoneDone': { fr: 'Fait', en: 'Done' },
  'editor.sheet.milestoneDoneHint': {
    fr: 'Un jalon non coché avant la date de revue est en retard.',
    en: 'An unchecked milestone before the review date is overdue.',
  },
  'editor.sheet.addMilestone': { fr: '+ Jalon', en: '+ Milestone' },
  'editor.sheet.milestonesFull': { fr: 'Six jalons maximum.', en: 'Six milestones at most.' },
  'editor.sheet.milestonesSorted': {
    fr: 'Affichés par date croissante — la saisie ne fixe pas leur ordre.',
    en: 'Shown by ascending date — entry order does not fix them.',
  },
  'editor.sheet.noMilestone': { fr: 'Aucun jalon.', en: 'No milestone.' },

  /* ---------------------------- field hints ------------------------------ */
  'editor.hint.goal': {
    fr: `Deux phrases max${NBSP}: quoi, pour qui, pourquoi`,
    en: 'Two sentences max: what, for whom, why',
  },
  'editor.hint.bullets': {
    fr: `Une ligne = une puce${NBSP}· **gras** autorisé${NBSP}· «${NBSP}texte — précision${NBSP}» atténue la fin`,
    en: 'One line = one bullet · **bold** allowed · "text — detail" dims the end',
  },
  'editor.hint.risks': {
    fr: `Trois lignes maximum — vide affiche «${NBSP}RAS${NBSP}»`,
    en: 'Three lines at most — empty renders "None"',
  },
  'editor.hint.question': {
    fr: 'Une question fermée que la revue peut trancher',
    en: 'A closed question the review can settle',
  },
  'editor.hint.decider': {
    fr: "Qui a l'autorité de trancher",
    en: 'Who has the authority to settle it',
  },
  'editor.hint.scope': {
    fr: 'Pour qui, combien, où — une ligne',
    en: 'For whom, how many, where — one line',
  },
  'editor.hint.budget': {
    fr: `Libre et court («${NBSP}20 k€ — devis attendu${NBSP}»)`,
    en: 'Short and free ("€20k — quote pending")',
  },
  'editor.hint.progressIgnored': {
    fr: `Ignoré avant lancement${NBSP}: la tuile affichera «${NBSP}—${NBSP}».`,
    en: 'Ignored before launch: the tile will show "—".',
  },
  /* Same wording as the A/T/J tooltips — the dynamic {reason}
     variant is retired with them. */
  'editor.hint.sheet.auto': {
    fr: 'Auto — slide de détail affichée si le projet est prêt, en cours ou en reliquats, ou s’il porte une décision attendue.',
    en: 'Auto — detail slide shown when the project is ready, in progress or in residuals, or carries a pending decision.',
  },
  'editor.hint.sheet.always': {
    fr: 'Toujours — slide de détail affichée quoi qu’il arrive (ex. : garder consultable la fiche d’un projet archivé).',
    en: 'Always — detail slide shown no matter what (e.g. keep an archived project’s sheet browsable).',
  },
  'editor.hint.sheet.never': {
    fr: 'Jamais — pas de slide de détail : le projet n’apparaît qu’au récapitulatif.',
    en: 'Never — no detail slide: the project only appears in the recap.',
  },
  'editor.reason.shownStage': {
    fr: 'fiche affichée (étape «{sp}{stage}{sp}»)',
    en: 'sheet shown (stage "{stage}")',
  },
  'editor.reason.shownDecision': {
    fr: 'fiche affichée (décision attendue)',
    en: 'sheet shown (pending decision)',
  },
  'editor.reason.shownAlways': {
    fr: 'fiche affichée (mode «{sp}Toujours{sp}»)',
    en: 'sheet shown (mode "Always")',
  },
  'editor.reason.hidden': {
    fr: 'fiche masquée (projet non lancé, aucune décision attendue)',
    en: 'sheet hidden (project not launched, no pending decision)',
  },

  'editor.counter.chars': { fr: `{n}${NBSP}/${NBSP}{max}`, en: `{n}${NBSP}/${NBSP}{max}` },
  'editor.counter.lines': {
    fr: `{n}${NBSP}/${NBSP}{max} lignes`,
    en: `{n}${NBSP}/${NBSP}{max} lines`,
  },
  /* Over the VISUAL-CAPACITY budget (core's model/budget.ts): the frame the
     value is drawn in was MEASURED to hold less than this. Nothing is refused
     and nothing is lost — the slide clips what does not fit. */
  'editor.counter.over': {
    fr: `Au-delà de ce que le cadre de la slide peut afficher${NBSP}: le texte sera tronqué à l'écran et à l'impression.`,
    en: 'Beyond what the slide frame can show: the text will be clipped on screen and in print.',
  },

  /* --------------------------- history screen ---------------------------- */
  'editor.history.title': { fr: 'Historique — {n} actions', en: 'History — {n} actions' },
  'editor.history.current': { fr: '— position actuelle —', en: '— current position —' },
  'editor.history.undone': { fr: 'annulé', en: 'undone' },
  'editor.history.empty': {
    fr: 'Aucune action enregistrée pour l’instant.',
    en: 'No action recorded yet.',
  },
  'editor.history.foot': {
    fr: `Ctrl+Z / Ctrl+Y naviguent dans cet historique${NBSP}; il est conservé au rechargement tant que la sauvegarde locale est active.`,
    en: 'Ctrl+Z / Ctrl+Y move through this history; it survives reloads while local save is on.',
  },

  /* ------------------------ import / export modal ------------------------ */
  'editor.io.title': { fr: 'Import / export', en: 'Import / export' },
  'editor.io.export': { fr: 'Exporter', en: 'Export' },
  'editor.io.import': { fr: 'Importer', en: 'Import' },
  'editor.io.copy': { fr: 'Copier', en: 'Copy' },
  'editor.io.copied': { fr: 'Copié', en: 'Copied' },
  'editor.io.copyFailed': { fr: 'Copie impossible', en: 'Copy failed' },
  'editor.io.download': { fr: 'Télécharger .json', en: 'Download .json' },
  'editor.io.dropzone': {
    fr: 'Glissez un fichier .json ici, ou ',
    en: 'Drop a .json file here, or ',
  },
  'editor.io.browse': { fr: 'parcourez', en: 'browse' },
  'editor.io.paste': { fr: 'JSON à importer', en: 'JSON to import' },
  'editor.io.reportOk': {
    fr: '✓ {projects} projets, {categories} catégories, {slides} slides libres',
    en: '✓ {projects} projects, {categories} categories, {slides} free slides',
  },
  'editor.io.refused': { fr: 'Import refusé', en: 'Import refused' },
  'editor.error.badJson': {
    fr: 'JSON illisible — vérifiez la syntaxe.',
    en: 'Unreadable JSON — check the syntax.',
  },
  'editor.error.tooLarge': {
    fr: `Fichier trop volumineux (plus de 10${NBSP}Mo) — ce n'est pas un portefeuille.`,
    en: 'File too large (over 10 MB) — not a portfolio.',
  },
  /* The stored envelope carries its own format stamp: an envelope this build
     cannot open is refused whole rather than half-read (recovery screen). */
  'editor.error.unknownFormat': {
    fr: `Les données enregistrées ne sont pas dans un format que cette version sait ouvrir.`,
    en: 'The saved data is not in a format this version can open.',
  },

  /* ------------ strict-parse errors (`{ path, code, params }`) ------------ */
  /* One entry per `ParseErrorCode` of the core parse/ — the parse names what
     happened, these strings say it in the editor's language. */
  'editor.error.notAnObject': {
    fr: 'le fichier ne contient pas un objet JSON',
    en: 'the file is not a JSON object',
  },
  'editor.error.missingKey': { fr: 'clé requise absente', en: 'required key missing' },
  'editor.error.unknownKey': {
    fr: 'clé inconnue — hors contrat',
    en: 'unknown key — outside the contract',
  },
  'editor.error.wrongType': { fr: '{expected} attendu', en: '{expected} expected' },
  'editor.error.invalidVersion': {
    fr: `version «${NBSP}{value}${NBSP}» — 3 attendue`,
    en: 'version "{value}" — 3 expected',
  },
  'editor.error.invalidDate': {
    fr: `«${NBSP}{value}${NBSP}» invalide (date calendaire AAAA-MM-JJ attendue)`,
    en: '"{value}" invalid (calendar YYYY-MM-DD date expected)',
  },
  'editor.error.invalidEnum': {
    fr: `«${NBSP}{value}${NBSP}» hors énumération ({allowed})`,
    en: '"{value}" outside the enumeration ({allowed})',
  },
  'editor.error.emptyId': { fr: 'identifiant vide', en: 'empty identifier' },
  'editor.error.invalidId': {
    fr: 'identifiant Unicode mal formé (demi-caractère isolé)',
    en: 'malformed Unicode identifier (unpaired surrogate)',
  },
  'editor.error.duplicateId': {
    fr: `identifiant «${NBSP}{id}${NBSP}» en double`,
    en: 'duplicate identifier "{id}"',
  },
  'editor.error.duplicateFontFace': {
    fr: 'variante de police en double (mêmes famille, poids et style)',
    en: 'duplicate font variant (same family, weight and style)',
  },
  'editor.error.invalidProgress': {
    fr: `entier 0–100 attendu (reçu «${NBSP}{value}${NBSP}»)`,
    en: 'integer 0–100 expected (got "{value}")',
  },
  'editor.error.invalidRecapRows': {
    fr: `entier 6–16 attendu (reçu «${NBSP}{value}${NBSP}»)`,
    en: 'integer 6–16 expected (got "{value}")',
  },
  'editor.error.invalidFont': {
    fr: `police «${NBSP}{value}${NBSP}» refusée (lettres, chiffres, espaces, - et _ ; 64 caractères max)`,
    en: 'font "{value}" refused (letters, digits, spaces, - and _; 64 characters max)',
  },
  'editor.error.invalidLogo': {
    fr: 'data URI image attendue (data:image/…)',
    en: 'image data URI expected (data:image/…)',
  },
  'editor.error.oversizedLogo': {
    fr: 'plus de {max}\u202Fk caractères',
    en: 'over {max}k characters',
  },
  'editor.error.invalidFontFace': {
    fr: 'data URI de police attendue (data:font/woff2;base64,…)',
    en: 'font data URI expected (data:font/woff2;base64,…)',
  },
  'editor.error.invalidFontWeight': {
    fr: `graisse «${NBSP}{value}${NBSP}» refusée (entier 100–900, ou plage «${NBSP}min max${NBSP}»)`,
    en: 'weight "{value}" refused (integer 100–900, or a "min max" range)',
  },
  'editor.error.invalidPaletteColor': {
    fr: `couleur «${NBSP}{value}${NBSP}» refusée (hexadécimal exact attendu, ex.${NBSP}: #1a2b3c)`,
    en: 'colour "{value}" refused (exact hexadecimal expected, e.g. #1a2b3c)',
  },
  'editor.error.oversizedFontFace': {
    fr: 'plus de {max} k caractères',
    en: 'over {max}k characters',
  },
  'editor.error.oversizedFontFaces': {
    fr: `polices embarquées${NBSP}: plus de {max} k caractères en tout`,
    en: 'embedded fonts: over {max}k characters together',
  },
  'editor.error.emptyBlocks': { fr: 'au moins un bloc attendu', en: 'at least one block expected' },
  'editor.error.tooManyEntities': {
    fr: `{count} projets, catégories et slides au total${NBSP}: {max} au maximum (au-delà, l'application ne répond plus).`,
    en: '{count} projects, categories and slides in total: {max} at most (beyond that the application stops responding).',
  },
  'editor.io.errorCount': {
    fr: `{n} erreur(s) de contrat${NBSP}:`,
    en: '{n} contract error(s):',
  },
  /* The COUNT above is exhaustive; the list is not. Said out loud, because a
     list that silently stops is a report the reader cannot trust. */
  'editor.io.errorListCapped': {
    fr: `Les {n} premières sont affichées.`,
    en: 'The first {n} are shown.',
  },
  'editor.io.errorReport': {
    fr: 'Télécharger le rapport complet',
    en: 'Download the full report',
  },

  /* The review date is the reference of every derivation (law 1): it is the
     one date the format will not let go missing. */
  'editor.review.dateRequired': {
    fr: `La date de revue ne peut pas être vide${NBSP}: AAAA-MM-JJ attendu.`,
    en: 'The review date cannot be empty: YYYY-MM-DD expected.',
  },

  /* ---- recovery screen: a stored document the app could not read back ---- */
  /* Said plainly, and in this order: what happened, that nothing was lost,
     then the two choices — the destructive one last and never pre-selected. */
  'editor.recovery.title': {
    fr: 'Sauvegarde locale illisible',
    en: 'Local backup unreadable',
  },
  'editor.recovery.lead': {
    fr: `Des données sont enregistrées dans ce navigateur, mais elles ne respectent pas le format du portefeuille${NBSP}: l'application ne sait pas les ouvrir.`,
    en: 'Data is saved in this browser, but it does not honor the portfolio format: the application cannot open it.',
  },
  'editor.recovery.safe': {
    fr: `Rien n'a été effacé et rien ne sera écrit tant que vous n'aurez pas choisi ({n}${NBSP}Ko conservés).`,
    en: 'Nothing was erased and nothing will be written until you choose ({n} KB kept).',
  },
  'editor.recovery.download': {
    fr: 'Télécharger la sauvegarde',
    en: 'Download the backup',
  },
  'editor.recovery.startEmpty': {
    fr: 'Repartir d’un portefeuille vide',
    en: 'Start from an empty portfolio',
  },
  'editor.recovery.startEmptyHint': {
    fr: 'Repartir à vide efface définitivement cette sauvegarde de ce navigateur — téléchargez-la d’abord si elle compte.',
    en: 'Starting empty erases this backup from this browser for good — download it first if it matters.',
  },
  /* The erasure was asked for and REFUSED: the screen stays, because leaving
     it would announce a deletion the browser did not perform. */
  'editor.recovery.startEmptyRefused': {
    fr: `Ce navigateur a refusé d'effacer la sauvegarde${NBSP}: elle est toujours là. Téléchargez-la, puis videz les données du site depuis les réglages du navigateur.`,
    en: 'This browser refused to erase the backup: it is still there. Download it, then clear this site’s data from the browser settings.',
  },
  'editor.io.cancel': { fr: 'Annuler', en: 'Cancel' },
  'editor.demo.marker': { fr: 'Démo · données fictives', en: 'Demo · fictional data' },
  'editor.demo.notice': {
    fr: 'Démo en lecture seule : ces données sont fictives et ne sont jamais enregistrées.',
    en: 'Read-only demo: this fictional data is never saved.',
  },
  'editor.demo.security': {
    fr: 'Sécurité avant d’utiliser l’éditeur',
    en: 'Read online security before using the editor',
  },
  'editor.demo.unavailable': { fr: 'Démo indisponible', en: 'Demo unavailable' },
  'editor.demo.loadFailed': {
    fr: 'Les données fictives n’ont pas pu être chargées. Le lien de démo nécessite un accès HTTP(S) et les fichiers d’exemple voisins.',
    en: 'The fictional sample data could not be loaded. The demo link requires HTTP(S) access and the adjacent sample files.',
  },
  'editor.demo.retry': { fr: 'Réessayer', en: 'Retry' },
  /* Confirm button of the destructive-action dialogs (AlertDialog). */
  'editor.confirm': { fr: 'Confirmer', en: 'Confirm' },
  /* Dialog-foot pointer to the data administration (purge, reset). */
  'editor.io.dataPointer': {
    fr: `La purge et la réinitialisation se trouvent dans Paramètres → Données`,
    en: 'The purge and the reset live in Settings → Data',
  },
  'editor.io.close': { fr: 'Fermer', en: 'Close' },
  'editor.io.replace': {
    fr: 'Remplacer le portefeuille (annulable)',
    en: 'Replace the portfolio (undoable)',
  },

  /* Full restoration or an explicit, previewed selection of content/settings. */
  'editor.io.modeLegend': { fr: "Mode d'import", en: 'Import mode' },
  'editor.io.mode.replace': {
    fr: 'Remplacer tout le portefeuille',
    en: 'Replace the whole portfolio',
  },
  'editor.io.mode.merge': {
    fr: 'Panacher — choisir quoi importer',
    en: 'Mix — choose what to import',
  },
  'editor.io.reading': { fr: 'Lecture du fichier…', en: 'Reading file…' },
  'editor.io.readFailed': {
    fr: 'Impossible de lire ce fichier. Réessayez ou collez son contenu.',
    en: 'Could not read this file. Try again or paste its contents.',
  },
  'editor.io.profileDetected': {
    fr: 'Profil d’apparence reconnu',
    en: 'Appearance profile recognized',
  },
  'editor.io.profileSafe': {
    fr: 'Ce profil ne contient aucun projet ni slide libre et ne peut pas remplacer votre portefeuille.',
    en: 'This profile contains no projects or free slides and cannot replace your portfolio.',
  },
  'editor.io.mixHint': {
    fr: 'Seuls les éléments cochés sont importés. Un même identifiant remplace l’élément existant ; rien n’est supprimé. Décochez les blocs d’apparence pour conserver votre habillage.',
    en: 'Only selected items are imported. A matching ID replaces the existing item; nothing is deleted. Leave appearance blocks unchecked to keep your styling.',
  },
  'editor.io.blocks': { fr: 'Blocs à reprendre', en: 'Settings to import' },
  'editor.io.block.review': { fr: 'Revue (titre et dates)', en: 'Review (title and dates)' },
  'editor.io.block.language': { fr: 'Langue', en: 'Language' },
  'editor.io.block.identity': {
    fr: 'Identité (organisation et logo)',
    en: 'Identity (organization and logo)',
  },
  'editor.io.block.theme': {
    fr: 'Habillage (thème, palette et polices)',
    en: 'Appearance (theme, palette and fonts)',
  },
  'editor.io.block.display': {
    fr: 'Affichage et navigation des slides',
    en: 'Slide display and navigation',
  },
  'editor.io.collection.categories': { fr: 'Catégories', en: 'Categories' },
  'editor.io.collection.projects': { fr: 'Projets', en: 'Projects' },
  'editor.io.collection.freeSlides': { fr: 'Slides libres', en: 'Free slides' },
  'editor.io.selectAll': { fr: 'Tout sélectionner', en: 'Select all' },
  'editor.io.item.added': { fr: 'nouvel élément', en: 'new item' },
  'editor.io.item.replaced': {
    fr: 'conflit : remplacera votre version',
    en: 'conflict: will replace your version',
  },
  'editor.io.item.same': { fr: 'identique', en: 'unchanged' },
  'editor.io.previewChanges': {
    fr: 'Récapitulatif avant validation',
    en: 'Preview before applying',
  },
  'editor.io.reordered': {
    fr: 'Ordre modifié : {collections}',
    en: 'Order changed: {collections}',
  },
  'editor.io.replaceHint': {
    fr: 'Restauration complète : contenu, catégories, langue, logo et présentation proviendront du fichier.',
    en: 'Full restoration: content, categories, language, logo and appearance will come from the file.',
  },
  'editor.io.changeCounts': {
    fr: '{added} ajout(s) · {replaced} remplacement(s) · {removed} suppression(s)',
    en: '{added} added · {replaced} replaced · {removed} removed',
  },
  'editor.io.missingCategories': {
    fr: 'Catégories absentes du résultat : {ids}. Les projets concernés resteront non classés ; les slides ancrées avant ces catégories ne seront pas présentées.',
    en: 'Categories missing from the result: {ids}. Affected projects will remain uncategorized; slides anchored before these categories will not be presented.',
  },
  'editor.io.mixNoEffect': {
    fr: 'Aucun changement à appliquer. Choisissez les éléments à reprendre.',
    en: 'No changes to apply. Select the items to import.',
  },
  /* The two refusals the command gate can give on a file that parsed perfectly
     well — the dialog shows them BEFORE the button is armed, because a legal
     file plus the settings it keeps (or plus the portfolio it merges into) is
     what the budget actually weighs. The figures are the budget's own. */
  'editor.io.refusedBudget': {
    fr: `Import impossible${NBSP}: le portefeuille obtenu dépasse ce que le format sait relire — {entities} projets, catégories et slides au maximum, et {chars} M caractères. Réduisez le fichier, ou n'en importez qu'une partie.`,
    en: 'Import impossible: the portfolio this would produce is past what the format can read back — {entities} projects, categories and slides at most, and {chars} M characters. Trim the file, or import part of it.',
  },
  'editor.io.refusedContract': {
    fr: `Import impossible${NBSP}: le portefeuille obtenu ne respecterait pas le format.`,
    en: 'Import impossible: the portfolio this would produce would not honour the format.',
  },
  'editor.io.applyMix': {
    fr: 'Appliquer la sélection (annulable)',
    en: 'Apply selection (undoable)',
  },
  'editor.io.exportProfile': {
    fr: 'Exporter uniquement le profil d’apparence et les catégories',
    en: 'Export only the appearance profile and categories',
  },
  'editor.io.exportProfileHint': {
    fr: 'Identité, logo, thème, palette, polices, langue, affichage et catégories — sans revue, projets ni slides libres. Les fichiers de polices et le logo embarqués restent soumis à leurs droits propres.',
    en: 'Identity, logo, theme, palette, fonts, language, display and categories — without review, projects or free slides. Embedded fonts and logos remain subject to their own rights.',
  },

  /* Export selection: checkboxes grouped by category; all checked = full file. */
  'editor.io.selection': { fr: 'Projets à exporter', en: 'Projects to export' },
  'editor.io.selectionCount': {
    fr: `{n}${NBSP}/ {total} projets cochés`,
    en: '{n} / {total} projects selected',
  },
  'editor.io.partialHint': {
    fr: `Export partiel${NBSP}: les projets cochés, leurs catégories, la revue et les réglages courants — le fichier s'ouvre seul dans l'application.`,
    en: 'Partial export: the selected projects, their categories, the current review and settings — the file opens on its own in the app.',
  },

  /* --------------------------- slide preview ----------------------------- */
  'editor.preview.open': { fr: 'Aperçu de la slide', en: 'Preview the slide' },
  'editor.preview.button': { fr: `Aperçu de la slide${NBSP}▸`, en: `Preview the slide${NBSP}▸` },
  'editor.preview.title': { fr: 'Aperçu — {subject}', en: 'Preview — {subject}' },
  'editor.preview.position': { fr: 'slide {page} / {total}', en: 'slide {page} of {total}' },
  'editor.preview.outOfDeck': {
    fr: 'hors deck avec les réglages actuels',
    en: 'not in the deck with the current settings',
  },
  'editor.preview.openSlideshow': {
    fr: `Ouvrir le diaporama ici${NBSP}▸`,
    en: `Open the slideshow here${NBSP}▸`,
  },
  'editor.preview.foot': {
    fr: `Rendu calculé à l'ouverture, et recalculé seulement tant que l'aperçu est affiché — jamais en arrière-plan. Échap pour fermer.`,
    en: 'Rendered when opened, and recomputed only while the preview is displayed — never in the background. Escape closes.',
  },
  'editor.preview.subject.sheet': { fr: '{id} · Fiche projet', en: '{id} · Project sheet' },
  'editor.preview.subject.divider': { fr: '{name} · Intercalaire', en: '{name} · Divider' },
  'editor.preview.subject.title': { fr: 'Slide de titre', en: 'Title slide' },
  'editor.preview.subject.freeform': { fr: '{title} · Slide libre', en: '{title} · Free slide' },
  'editor.preview.titleSlide': { fr: 'Aperçu de la slide de titre', en: 'Preview the title slide' },
  'editor.preview.freeSlide': { fr: 'Aperçu de la slide libre', en: 'Preview the free slide' },

  /* ---------------------- soft validation badges ------------------------- */
  'editor.check.progress100': {
    fr: `Avancement 100${NBSP}% hors «${NBSP}Terminé · reliquats${NBSP}» ou «${NBSP}Clos${NBSP}»`,
    en: 'Progress at 100% outside "Done · residuals" or "Closed"',
  },
  'editor.check.healthOnArchived': {
    fr: 'Santé renseignée sur un projet archivé',
    en: 'Health set on an archived project',
  },
  'editor.check.onHoldOnScoping': {
    fr: `«${NBSP}En attente${NBSP}» sur un projet à cadrer`,
    en: '"On hold" on a project still to scope',
  },
  'editor.check.decisionOnArchived': {
    fr: 'Décision attendue sur un projet archivé — invisible du deck',
    en: 'Pending decision on an archived project — invisible in the deck',
  },
  'editor.check.actualEndWithoutStage': {
    fr: `Fin réelle sans étape «${NBSP}Terminé · reliquats${NBSP}» ou «${NBSP}Clos${NBSP}»`,
    en: 'Actual end without stage "Done · residuals" or "Closed"',
  },
  'editor.check.duplicateColor': {
    fr: `Deux catégories partagent la couleur «${NBSP}{color}${NBSP}»`,
    en: 'Two categories share the colour "{color}"',
  },

  /* ---------------------- history: event wording ------------------------- */
  // Composition glyph: history lines write a state transition with "▸".
  'editor.event.arrow': { fr: '▸', en: '▸' },
  'editor.event.subject.review': { fr: 'Revue', en: 'Review' },
  'editor.event.subject.identity': { fr: 'Identité', en: 'Identity' },
  'editor.event.subject.settings': { fr: 'Paramètres', en: 'Settings' },
  'editor.event.subject.category': { fr: 'Catégorie «{sp}{name}{sp}»', en: 'Category "{name}"' },

  'editor.event.CategoryCreated': {
    fr: 'Catégorie «{sp}{name}{sp}» créée',
    en: 'Category "{name}" created',
  },
  'editor.event.CategoryDeleted': {
    fr: 'Catégorie «{sp}{name}{sp}» supprimée',
    en: 'Category "{name}" deleted',
  },
  'editor.event.CategoryMoved': {
    fr: 'Catégorie «{sp}{name}{sp}» déplacée',
    en: 'Category "{name}" moved',
  },
  'editor.event.ProjectCreated': { fr: '{id} · projet créé', en: '{id} · project created' },
  'editor.event.ProjectDeleted': { fr: '{id} · projet supprimé', en: '{id} · project deleted' },
  'editor.event.ProjectMoved': { fr: '{id} · projet déplacé', en: '{id} · project moved' },
  'editor.event.ProjectRenumbered': {
    fr: '{before} ▸ {after} · renuméroté',
    en: '{before} ▸ {after} · renumbered',
  },
  'editor.event.FreeSlideCreated': {
    fr: 'Slide libre «{sp}{title}{sp}» ajoutée',
    en: 'Free slide "{title}" added',
  },
  'editor.event.FreeSlideDeleted': {
    fr: 'Slide libre «{sp}{title}{sp}» retirée',
    en: 'Free slide "{title}" removed',
  },
  'editor.event.FreeSlideChanged': {
    fr: 'Slide libre «{sp}{title}{sp}» modifiée',
    en: 'Free slide "{title}" edited',
  },
  'editor.event.FreeSlideMoved': { fr: 'Slide libre déplacée', en: 'Free slide moved' },
  'editor.event.PortfolioReplaced': {
    // House pluralisation convention — cf. 'jalon(s)', '{n} puce(s)': never "1 projets".
    fr: 'Import du portefeuille — remplacement ({n} projet(s))',
    en: 'Portfolio import — replacement ({n} project(s))',
  },
  'editor.event.ProjectsMerged': {
    fr: 'Fusion — {n} projet(s) remplacé(s), {m} ajouté(s)',
    en: 'Merge — {n} project(s) replaced, {m} added',
  },
  'editor.event.listResized': {
    fr: '{id} · {list}{sp}: {n} puce(s) ▸ {m}',
    en: '{id} · {list}: {n} bullet(s) ▸ {m}',
  },
  'editor.event.listEdited': { fr: '{id} · {list} réécrit', en: '{id} · {list} rewritten' },
  'editor.event.decisionsAdded': { fr: '{id} · décision ajoutée', en: '{id} · decision added' },
  'editor.event.decisionsRemoved': { fr: '{id} · décision retirée', en: '{id} · decision removed' },
  'editor.event.decisionsEdited': {
    fr: '{id} · décisions modifiées',
    en: '{id} · decisions edited',
  },
  'editor.event.milestonesAdded': { fr: '{id} · jalon ajouté', en: '{id} · milestone added' },
  'editor.event.milestonesRemoved': { fr: '{id} · jalon retiré', en: '{id} · milestone removed' },
  'editor.event.milestonesEdited': { fr: '{id} · jalons modifiés', en: '{id} · milestones edited' },
} satisfies Record<string, Entry>

export type EditorKey = keyof typeof EDITOR_CATALOG
export type LabelKey = EditorKey | CatalogKey
export type { Slots }

function isEditorKey(key: string): key is EditorKey {
  return Object.hasOwn(EDITOR_CATALOG, key)
}

/** `true` if the key resolves to a real label (editor catalog OR core catalog). */
export function hasLabel(key: string): key is LabelKey {
  return isEditorKey(key) || isCatalogKey(key)
}

/**
 * Total, like `t()`: an editor key resolves here, anything else is delegated to
 * the core catalog (which in turn returns the key itself if unknown — visible,
 * never an exception).
 *
 * The `{sp}` slot is filled with a non-breaking space by default: it lets the
 * French guillemets of a catalog string keep their inner spaces without
 * scattering literal U+00A0 across every call site.
 */
export function te(key: LabelKey, language: Language, slots?: Slots): string {
  if (!isEditorKey(key)) return t(key, language, slots)

  let text = EDITOR_CATALOG[key][language]
  const filled: Slots = { sp: language === 'fr' ? NBSP : '', ...slots }
  for (const [name, value] of Object.entries(filled)) {
    text = text.split(`{${name}}`).join(String(value))
  }
  return text
}
