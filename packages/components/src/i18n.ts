/**
 * LOCAL editor catalog — same discipline as the core catalog/, keys prefixed
 * `editor.*`.
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
 * these strings (pitfall n° 7) — never applied to text the user typed.
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

/**
 * The editor's own entries. Typed as an OPEN `Record<string, Entry>` — not a
 * closed key union like the core `CATALOG` — because `te()` receives composed
 * keys (`editor.event.${type}`, `editor.error.${code}`) the compiler cannot
 * enumerate; the safety net is totality (an unknown key surfaces as itself on
 * screen) plus `hasLabel` where callers need to probe first.
 */
export const EDITOR_CATALOG: Record<string, Entry> = {
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
  'editor.foot.counts': {
    fr: `{tracked} suivis${NBSP}· {archived} archivés`,
    en: '{tracked} tracked · {archived} archived',
  },
  'editor.foot.deck': { fr: `deck${NBSP}: {n} slides`, en: 'deck: {n} slides' },
  'editor.about.built': { fr: 'Développé en 2026', en: 'Built in 2026' },
  'editor.about.author': { fr: 'François Cabouat', en: 'François Cabouat' },
  'editor.about.mail': { fr: 'francois.cabouat@gmail.com', en: 'francois.cabouat@gmail.com' },

  'editor.topbar.undo': { fr: 'Annuler', en: 'Undo' },
  'editor.topbar.redo': { fr: 'Rétablir', en: 'Redo' },
  'editor.topbar.language': { fr: "Langue de l'application", en: 'Application language' },
  'editor.topbar.slideshow': {
    fr: `Générer le diaporama${NBSP}▸`,
    en: `Generate the slideshow${NBSP}▸`,
  },
  'editor.topbar.openSlideshow': {
    fr: 'Ouvrir le diaporama plein écran',
    en: 'Open the slideshow full screen',
  },

  /* ----------------------------- slideshow ------------------------------ */
  /* Exit bar of the E4 mockup: hidden by default, revealed on the top edge. */
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
  'editor.setting.palette': { fr: 'Palette', en: 'Palette' },
  'editor.setting.font': { fr: 'Police', en: 'Font' },
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
  'editor.value.pct': { fr: `{n}${NBSP}%`, en: `{n}${NBSP}%` },
  'editor.palette.tailwind': { fr: 'Tailwind', en: 'Tailwind' },
  'editor.palette.dsfr': { fr: 'DSFR', en: 'DSFR' },
  'editor.palette.material': { fr: 'Material', en: 'Material' },
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
  'editor.review.freeSlides': { fr: 'Slides additionnelles', en: 'Additional slides' },
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
  'editor.settings.appearance': { fr: 'Langue & palette', en: 'Language & palette' },
  'editor.settings.aggregates': { fr: "Slides d'agrégat", en: 'Aggregate slides' },
  'editor.settings.categories': { fr: 'Catégories', en: 'Categories' },
  'editor.settings.freeSlides': { fr: 'Slides libres', en: 'Free slides' },
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
  'editor.settings.newSlide': { fr: 'Nouvelle slide', en: 'New slide' },
  'editor.settings.fontHint': {
    fr: `«${NBSP}Marianne${NBSP}» (embarquée) ou toute famille Google Fonts — défaut${NBSP}: Roboto.`,
    en: '"Marianne" (bundled) or any Google Fonts family — default: Roboto.',
  },
  'editor.setting.style': { fr: 'Thème', en: 'Theme' },
  'editor.style.flat': { fr: 'Flat', en: 'Flat' },
  'editor.style.classic': { fr: 'Classique', en: 'Classic' },
  'editor.settings.logo': { fr: 'Logo', en: 'Logo' },
  'editor.settings.logoImport': { fr: 'Importer un logo…', en: 'Import a logo…' },
  'editor.settings.logoReset': { fr: 'Logo par défaut', en: 'Default logo' },
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
  'editor.data.persistOffConfirm': {
    fr: `Désactiver la sauvegarde locale efface les données enregistrées dans ce navigateur (la base ouverte reste intacte). Continuer${NBSP}?`,
    en: 'Turning local save off erases the data stored in this browser (the open database stays intact). Continue?',
  },
  'editor.data.examples': { fr: `Charger les données d'exemple`, en: 'Load the sample data' },
  'editor.data.examplesConfirm': {
    fr: `Remplacer la base actuelle par le jeu d'exemple Déjà Vu Ltd.${NBSP}? (annulable)`,
    en: 'Replace the current database with the Déjà Vu Ltd. sample set? (undoable)',
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
  'editor.sheet.takenText': { fr: 'Texte', en: 'Text' },
  'editor.sheet.takenWhen': { fr: 'Quand', en: 'When' },
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
  /* Same wording as the A/T/J tooltips (canon, 04/09) — the dynamic {reason}
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
  'editor.error.duplicateId': {
    fr: `identifiant «${NBSP}{id}${NBSP}» en double`,
    en: 'duplicate identifier "{id}"',
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
  'editor.error.emptyBlocks': { fr: 'au moins un bloc attendu', en: 'at least one block expected' },
  'editor.io.errorCount': {
    fr: `{n} erreur(s) de contrat${NBSP}:`,
    en: '{n} contract error(s):',
  },
  'editor.io.cancel': { fr: 'Annuler', en: 'Cancel' },
  'editor.io.keepSettings': {
    fr: `Conserver mes réglages et mon identité (thème, logo, langue, affichage)`,
    en: 'Keep my settings and identity (theme, logo, language, display)',
  },
  'editor.io.close': { fr: 'Fermer', en: 'Close' },
  'editor.io.replace': {
    fr: 'Remplacer le portefeuille (annulable)',
    en: 'Replace the portfolio (undoable)',
  },

  /* Import mode: replace everything (historic) or merge a contribution. */
  'editor.io.modeLegend': { fr: "Mode d'import", en: 'Import mode' },
  'editor.io.mode.replace': {
    fr: 'Remplacer tout le portefeuille',
    en: 'Replace the whole portfolio',
  },
  'editor.io.mode.merge': {
    fr: 'Fusionner les projets dans le portefeuille courant',
    en: 'Merge the projects into the current portfolio',
  },
  'editor.io.mergeReplacedList': {
    fr: `Projets remplacés par le fichier${NBSP}:`,
    en: 'Projects the file replaces:',
  },
  'editor.io.mergePreview': {
    fr: `fusionner${NBSP}: {n} remplacé(s), {m} ajouté(s)`,
    en: 'merge: {n} replaced, {m} added',
  },
  'editor.io.mergePreviewCategories': {
    fr: `, {k} catégorie(s) créée(s)`,
    en: ', {k} category(ies) created',
  },
  'editor.io.mergeHint': {
    fr: `La fusion ne supprime rien — vos catégories homonymes gardent leur version, et tout s'annule d'un Ctrl+Z.`,
    en: 'Merging deletes nothing — your homonym categories keep their version, and one Ctrl+Z undoes it all.',
  },
  'editor.io.mergeNoEffect': {
    fr: `Aucun effet${NBSP}: les projets du fichier sont identiques aux vôtres.`,
    en: 'No effect: the projects in the file are identical to yours.',
  },
  'editor.io.merge': { fr: 'Fusionner (annulable)', en: 'Merge (undoable)' },
  'editor.io.mergeDone': {
    fr: `✓ Fusion appliquée${NBSP}: {n} remplacé(s), {m} ajouté(s) — Ctrl+Z l'annule`,
    en: '✓ Merge applied: {n} replaced, {m} added — Ctrl+Z undoes it',
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

  /* ---------------------- E2ter — slide preview -------------------------- */
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
  // Composition glyph: the canonical mockup writes the transition with "▸".
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
}

export type { Slots }

/** `true` if the key resolves to a real label (editor catalog OR core catalog). */
export function hasLabel(key: string): boolean {
  return key in EDITOR_CATALOG || isCatalogKey(key)
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
export function te(key: string, language: Language, slots?: Slots): string {
  const entry = EDITOR_CATALOG[key]
  // Deliberately dynamic delegation: `t` stays total at runtime (unknown key →
  // the key itself), so the cast only silences the narrowed signature.
  if (entry === undefined) return t(key as CatalogKey, language, slots)

  let text = entry[language]
  const filled: Slots = { sp: language === 'fr' ? NBSP : '', ...slots }
  for (const [name, value] of Object.entries(filled)) {
    text = text.split(`{${name}}`).join(String(value))
  }
  return text
}
