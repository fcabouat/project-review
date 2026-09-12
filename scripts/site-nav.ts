/** Shared navigation for the landing, guides, overview and generated API pages. */
type Language = 'en' | 'fr'
type Section = 'home' | 'overview' | 'guide' | 'api'

export function siteNav(lang: Language, section: Section, depth = 0): string {
  const up = '../'.repeat(depth)
  const home = lang === 'fr' ? 'fr.html' : 'index.html'
  const translated = section === 'home' || section === 'guide'
  const link = (href: string, label: string, active: boolean) =>
    `<a href="${up}${href}"${active ? ' aria-current="page"' : ''}>${label}</a>`
  const languages = (['fr', 'en'] as const)
    .map((language) => {
      const label = language === 'fr' ? 'Français' : 'English'
      if (language === lang) return `<span lang="${language}" aria-current="true">${label}</span>`
      if (!translated) {
        return `<span lang="fr" aria-disabled="true" title="Cette page est disponible uniquement en anglais">Français</span>`
      }
      const href =
        section === 'guide'
          ? `guide/${language}.html`
          : language === 'fr'
            ? 'fr.html'
            : 'index.html'
      return `<a href="${up}${href}" lang="${language}" hreflang="${language}">${label}</a>`
    })
    .join('')
  return `<header class="pr-site-header">
  <div class="pr-site-bar">
    <a class="pr-site-brand" href="${up}${home}"${section === 'home' ? ' aria-current="page"' : ''}>
      <svg width="26" height="26" viewBox="0 0 96 96" aria-hidden="true">
        <rect width="96" height="96" rx="20" fill="#303F9F" />
        <g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="11">
          <path d="M22 26 L40 58 L58 26" stroke="#5EEAD4" opacity=".5" />
          <path d="M32 38 L50 70 L68 38" stroke="#FFF" />
        </g>
      </svg>project-review
    </a>
    <nav class="pr-site-links" aria-label="${lang === 'fr' ? 'Navigation du site' : 'Site navigation'}">
      ${link(`${home}#examples`, lang === 'fr' ? 'Exemples' : 'Examples', false)}
      ${link('overview.html', lang === 'fr' ? 'Architecture (EN)' : 'Overview', section === 'overview')}
      ${link(`guide/${lang}.html`, lang === 'fr' ? 'Guide' : 'User guide', section === 'guide')}
      ${link('api/index.html', 'API', section === 'api')}
      ${link('storybook/index.html', 'Storybook', false)}
      <a href="https://github.com/fcabouat/project-review">GitHub</a>
    </nav>
    <nav class="pr-site-languages" aria-label="${lang === 'fr' ? 'Langue de la page' : 'Page language'}">${languages}</nav>
  </div>
</header>`
}
