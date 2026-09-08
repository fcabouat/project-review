/**
 * WHY THIS FIXTURE. Two hand-built, typed portfolios for the edit-pipeline
 * tests (commands, events, runtime, persistence) — deliberately decoupled from
 * the sample JSON files, which belong to the derivation tests: an editorial
 * change to the samples must never ripple into the algebra tests.
 *
 * `testPortfolio` — 2 categories · 3 projects · 1 free slide. The mix is
 * chosen to exercise the events, not for business plausibility (the store
 * validates nothing):
 *  - P-01 carries ALL optional fields — enough to test their erasure;
 *  - P-02 carries NONE — the low bound every event and every deck rule must
 *    encaisser, and the proof that an absent optional can appear;
 *  - P-03 sits in between (on hold, residuals, forced sheet).
 *
 * `otherPortfolio` — a second, minimal portfolio in the OTHER language and
 * theme, so a `PortfolioReplaced` (import) visibly changes every corner.
 *
 * Each builder returns a brand-new object: no test can pollute another. The
 * fresh elements at the bottom (NEW_*) are guaranteed NOT to exist in either
 * portfolio — they feed creation events and inapplicable-target cases.
 */

import type { Category } from '../../src/model/category'
import type { FreeSlide } from '../../src/model/free-slide'
import type { Portfolio } from '../../src/model/portfolio'
import type { Project } from '../../src/model/project'
import { categoryId, freeSlideId, projectId } from '../../src/values/ids'
import { isoDate } from '../../src/values/date'
import { progressOf } from '../../src/values/progress'

/* The fixture builds its scalars through the same smart constructors as any
 * emitter: a literal that stopped validating would fail HERE, not in a view. */
const d = (s: string) => isoDate(s)!
const cid = (s: string) => categoryId(s)!
const pid = (s: string) => projectId(s)!
const fid = (s: string) => freeSlideId(s)!

export const testPortfolio = (): Portfolio => ({
  version: 3,
  review: {
    title: 'Revue des projets',
    subtitle: 'Revue mensuelle',
    reviewDate: d('2026-09-03'),
    previousReviewDate: d('2026-07-02'),
  },
  settings: {
    language: 'fr',
    // The fictional Déjà Vu identity — same publisher as the sample sets.
    identity: {
      org: 'Déjà Vu Ltd.',
      unit: 'DSI',
      orgLong: 'Déjà Vu Ltd.',
      unitLong: 'Direction des Systèmes d’Information',
      contact: 'dsi@dejavu.example',
    },
    theme: { style: 'classic', palette: 'dsfr', font: 'Inter' },
    show: { healthDashboard: true, recap: true, archives: true, decisions: true },
    recapRows: 11,
  },
  categories: [
    { id: cid('infra'), name: 'Infrastructure', color: 'blue' },
    { id: cid('poste'), name: 'Poste de travail', color: 'green' },
  ],
  projects: [
    {
      id: pid('P-01'),
      name: 'Refonte du cœur de réseau',
      categoryId: cid('infra'),
      priority: 'P1',
      stage: 'inProgress',
      onHold: false,
      health: 'watch',
      progress: progressOf(60)!,
      lead: 'Camille NOËL',
      sponsor: 'Direction',
      scope: 'Deux sites, 900 postes',
      goal: 'Remplacer les commutateurs de cœur. Sécuriser la disponibilité du réseau.',
      budget: '120 k€ — notifié',
      start: d('2026-01-15'),
      targetEnd: d('2026-12-31'),
      actualEnd: d('2026-11-20'),
      done: ['Audit des baies **terminé**', 'Marché notifié'],
      ongoing: ['Câblage du site B'],
      next: ['Bascule du site A — 15/10'],
      risks: 'Fenêtre de bascule courte.',
      decisions: [
        {
          question: 'Valider la fenêtre de bascule du site A ?',
          decider: 'Direction',
          taken: { text: 'Bascule confirmée le 15/10', when: d('2026-07-02') },
        },
        { question: 'Financer le lot 2 sur 2027 ?', decider: 'Direction' },
      ],
      milestones: [
        { label: 'Notification marché', date: d('2026-03-10'), done: true },
        { label: 'Bascule site A', date: d('2026-10-15'), display: 'T4 2026', done: false },
      ],
      sheet: 'auto',
      updatedOn: d('2026-08-28'),
      author: 'Camille NOËL',
    },
    {
      id: pid('P-02'),
      name: 'Renouvellement du parc portable',
      categoryId: cid('poste'),
      stage: 'toScope',
      onHold: false,
      goal: 'Remplacer les portables de plus de cinq ans.',
      done: [],
      ongoing: [],
      next: [],
      decisions: [],
      milestones: [],
      sheet: 'auto',
    },
    {
      id: pid('P-03'),
      name: 'Messagerie sécurisée',
      categoryId: cid('infra'),
      priority: 'P2',
      stage: 'residuals',
      onHold: true,
      health: 'onTrack',
      progress: progressOf(95)!,
      lead: 'Dominique ROY',
      goal: 'Chiffrer les échanges avec les partenaires institutionnels.',
      done: ['Passerelle installée'],
      ongoing: [],
      next: ['Former les référents'],
      decisions: [],
      milestones: [{ label: 'Mise en service', date: d('2026-06-01'), done: true }],
      sheet: 'always',
      updatedOn: d('2026-08-30'),
    },
  ],
  freeSlides: [
    {
      id: fid('opening'),
      anchor: { type: 'opening' },
      title: 'Mot d’ouverture',
      blocks: [['Ordre du jour', 'Points saillants du trimestre']],
    },
  ],
})

/** Second portfolio, for `PortfolioReplaced` (import). */
export const otherPortfolio = (): Portfolio => ({
  version: 3,
  review: { title: 'Autre revue', reviewDate: d('2027-01-08') },
  settings: {
    language: 'en',
    identity: { org: 'DIR', unit: 'SERV' },
    theme: { style: 'flat', palette: 'tailwind', font: 'Inter' },
    show: { healthDashboard: false, recap: true, archives: false, decisions: true },
    recapRows: 8,
  },
  categories: [{ id: cid('divers'), name: 'Divers', color: 'amber' }],
  projects: [
    {
      id: pid('X-1'),
      name: 'Projet importé',
      categoryId: cid('divers'),
      stage: 'ready',
      onHold: false,
      goal: 'Vérifier que le remplacement global s’annule.',
      done: [],
      ongoing: [],
      next: [],
      decisions: [],
      milestones: [],
      sheet: 'auto',
    },
  ],
  freeSlides: [],
})

/* ------------------------------------------------------------------ */
/* Safe access (noUncheckedIndexedAccess): a test that asks for an     */
/* element the fixture does not hold must fail loudly, not on a `!`.   */
/* ------------------------------------------------------------------ */

export const projectOf = (p: Portfolio, id: string): Project => {
  const x = p.projects.find((y) => y.id === id)
  if (x === undefined) throw new Error(`project ${id} missing from the fixture`)
  return x
}

export const categoryOf = (p: Portfolio, id: string): Category => {
  const x = p.categories.find((y) => y.id === id)
  if (x === undefined) throw new Error(`category ${id} missing from the fixture`)
  return x
}

export const slideOf = (p: Portfolio, id: string): FreeSlide => {
  const x = p.freeSlides.find((y) => y.id === id)
  if (x === undefined) throw new Error(`slide ${id} missing from the fixture`)
  return x
}

/* ------------------------------------------------------------------ */
/* Fresh elements — ids taken by NEITHER portfolio above: they feed    */
/* the creation events and their inverses.                             */
/* ------------------------------------------------------------------ */

export const NEW_CATEGORY: Category = {
  id: cid('metier'),
  name: 'Applications métier',
  color: 'purple',
}

export const NEW_PROJECT: Project = {
  id: pid('P-99'),
  name: 'Projet ajouté',
  categoryId: cid('poste'),
  stage: 'ready',
  onHold: false,
  goal: 'Vérifier la création et sa réciproque.',
  done: [],
  ongoing: [],
  next: [],
  decisions: [],
  milestones: [],
  sheet: 'auto',
}

export const NEW_SLIDE: FreeSlide = {
  id: fid('annexe'),
  anchor: { type: 'closing' },
  title: 'Annexe',
  blocks: [['Une ligne'], ['Deux', 'Trois']],
}

/** P-02 as a colleague's contribution: same id, reworked content — feeds the
 * merge samples (an in-place replacement that is NOT structurally trivial). */
export const MERGED_P02: Project = {
  ...projectOf(testPortfolio(), 'P-02'),
  stage: 'ready',
  goal: 'Remplacer les portables — périmètre recadré par le collègue.',
}
