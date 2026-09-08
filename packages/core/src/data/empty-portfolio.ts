/**
 * Empty portfolio — the first-launch state: the theme is pre-filled, the
 * content AND the identity are empty. It is initialisation DATA, not model:
 * the model layer says what a portfolio is, this file says which one you
 * start with.
 *
 * The identity is deliberately blank: Déjà Vu Ltd. lives ONLY in the sample
 * sets — a real user types their own organization on first launch (the
 * Review and Settings screens open ready to fill). `language` localizes the
 * default title and is stored as the deck language.
 *
 * PURE module: the reference date is injected by the caller (the editor shell
 * owns the clock, the domain never does).
 */
import type { IsoDate } from '../values/date'
import type { Portfolio } from '../model/portfolio'
import type { Language } from '../model/theme'

const DEFAULT_TITLE: Record<Language, string> = {
  fr: 'Revue des projets',
  en: 'Project review',
}

/**
 * The portfolio a user starts from: empty content (no category, project or
 * free slide), blank identity, pre-filled settings. The theme defaults
 * (flat/material/Roboto) deliberately MATCH the parse defaults for an absent
 * `theme` block — a blank start and a theme-less import must describe the
 * same state; only the title localizes to `language`. `reviewDate` is
 * required because the domain has no clock (law 1): the caller decides what
 * "today" is.
 */
export function emptyPortfolio(language: Language, reviewDate: IsoDate): Portfolio {
  return {
    version: 3,
    review: { title: DEFAULT_TITLE[language], reviewDate },
    settings: {
      language,
      identity: { org: '', unit: '' },
      theme: { style: 'flat', palette: 'material', font: 'Roboto' },
      show: { healthDashboard: true, recap: true, archives: true, decisions: true },
      recapRows: 11,
    },
    categories: [],
    projects: [],
    freeSlides: [],
  }
}
