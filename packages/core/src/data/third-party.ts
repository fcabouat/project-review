/**
 * THIRD-PARTY NOTICES — what this product carries that it did not write, and
 * under which terms. The single source: the About screen renders this table,
 * and `THIRD-PARTY.md` at the repository root restates it. One table, so the
 * repository and the deliverable can never say different things.
 *
 * Why it travels INSIDE the artifact: the deliverable is one redistributable
 * HTML file. Whoever receives it by mail, on a USB stick or from a share has
 * the code and the fonts in their hands and no repository to consult — the
 * notices have to be where the software is.
 *
 * WHAT IS LISTED. Everything whose code, assets or generated output ends up in
 * `dist/project-review.html` or in the static build beside it. Build-time
 * tooling that leaves no trace in the artifact (test runners, linters, type
 * checkers, bundler) is deliberately absent: a notice for something the reader
 * does not have would be noise, not honesty.
 *
 * HOW IT IS KEPT TRUE. Every line was read from the INSTALLED package —
 * `node_modules/<name>/package.json` for the version, and the package's own
 * license file for the terms and the copyright, quoted verbatim. Where a
 * package's declared `license` field disagrees with the license file it ships,
 * THE FILE WINS and {@link ThirdPartyNotice.note} says so: the file is the
 * license, the field is metadata.
 *
 * PURE module: no import at all.
 */

/** One third-party component of the deliverable, and its terms. */
export interface ThirdPartyNotice {
  /** Package or asset name, as published. */
  readonly name: string
  /** The version actually installed and shipped. */
  readonly version: string
  /** The license as its own text names it (not necessarily the SPDX id the
   * package metadata declares — see the module header). */
  readonly license: string
  /** The copyright line, verbatim from the shipped license file. */
  readonly copyright: string
  /** Where the license text and the project live. */
  readonly url: string
  /** What it does here, in one clause — so a reader can weigh the notice. */
  readonly use: string
  /** An obligation, a caveat or a metadata discrepancy worth stating. */
  readonly note?: string
}

/**
 * The notices, in the order a reader meets them: what the deck runs on, what
 * the interface is built from, then the typefaces.
 */
export const THIRD_PARTY_NOTICES: readonly ThirdPartyNotice[] = [
  {
    name: 'reveal.js',
    version: '6.0.1',
    license: 'MIT',
    copyright:
      'Copyright (C) 2011-2026 Hakim El Hattab, http://hakim.se, and reveal.js contributors',
    url: 'https://revealjs.com',
    use: 'the slideshow engine — inlined into the exported standalone deck',
  },
  {
    name: 'Svelte',
    version: '5.57.0',
    license: 'MIT',
    copyright: 'Copyright (c) 2016-2025 Svelte Contributors',
    url: 'https://svelte.dev',
    use: 'the component runtime the whole interface compiles onto',
  },
  {
    name: 'Remix Icon',
    version: '4.9.1',
    license: 'Remix Icon License v1.0',
    copyright: 'Copyright (c) 2017–2026 Remix Design',
    url: 'https://remixicon.com',
    use: 'the interface icons, inlined as SVG (15 of them)',
    note:
      'The package metadata declares Apache-2.0, but the license file it ships is the ' +
      'Remix Icon License v1.0 — the file governs. Under it attribution is appreciated ' +
      'rather than required, and a copy of the license is required only when ' +
      'redistributing the icon library whole or substantially: this product inlines a ' +
      'handful of icons as ordinary interface elements. The icons are not used as a logo ' +
      'or brand identifier, which that license forbids.',
  },
  {
    name: 'bits-ui',
    version: '2.19.1',
    license: 'MIT',
    copyright: 'Copyright (c) 2023 Hunter Johnston',
    url: 'https://bits-ui.com',
    use: 'the accessible behaviour under the dialogs, menus, tabs and switches',
  },
  {
    name: 'shadcn-svelte',
    version: '1.6.1',
    license: 'MIT',
    copyright:
      'Copyright (c) 2023 Hunter Johnston <https://github.com/huntabyte>, ' +
      'Copyright (c) 2023 CokaKoala <https://github.com/adriangonz97>',
    url: 'https://www.shadcn-svelte.com',
    use: 'the interface primitives, VENDORED into the source tree and adapted',
    note:
      'Vendored, not depended upon: the sources live in this repository ' +
      '(packages/components/src/commons/ui/) and were edited locally. The notice ' +
      'follows the code, wherever it lives.',
  },
  {
    name: 'tailwind-merge',
    version: '3.6.0',
    license: 'MIT',
    copyright: 'Copyright (c) 2021 Dany Castillo',
    url: 'https://github.com/dcastil/tailwind-merge',
    use: 'class-list merging inside the interface primitives',
  },
  {
    name: 'tailwind-variants',
    version: '3.3.1',
    license: 'MIT',
    copyright: 'Copyright (c) 2020 Tailwid Variants',
    url: 'https://www.tailwind-variants.org',
    use: 'the variant tables of the interface primitives',
    note: 'The copyright line is quoted verbatim, typo and all.',
  },
  {
    name: 'clsx',
    version: '2.1.1',
    license: 'MIT',
    copyright: 'Copyright (c) Luke Edwards <luke.edwards05@gmail.com> (lukeed.com)',
    url: 'https://github.com/lukeed/clsx',
    use: 'conditional class names, under tailwind-merge',
  },
  {
    name: 'Tailwind CSS',
    version: '4.3.3',
    license: 'MIT',
    copyright: 'Copyright (c) Tailwind Labs, Inc.',
    url: 'https://tailwindcss.com',
    use: 'the utility stylesheet generated into the deliverable, and the colour values of the "tailwind" category palette',
  },
  {
    name: 'Material Design colour system',
    version: 'Material Design 2 palette (material-design-lite, mdl-1.x)',
    license: 'Apache License 2.0',
    copyright: 'Copyright 2015 Google Inc. All Rights Reserved.',
    url: 'https://github.com/google/material-design-lite/blob/mdl-1.x/src/_color-definitions.scss',
    use: 'the colour values of the "material" category palette (the default)',
    note:
      'A borrowed set of VALUES, not an installed package — so the source is named ' +
      'instead: the file above publishes the same palette (blue 700, indigo 500, ' +
      'teal 600, green 600, light-green 800, deep-orange 600, red 600, purple 500, ' +
      'brown 500, blue-grey 600 …) and carries the Apache-2.0 header quoted here. ' +
      'Credited because a palette transcribed from a design system is a borrowing like ' +
      'any other, whether or not a package manager records it.',
  },
  {
    name: 'tw-animate-css',
    version: '1.4.0',
    license: 'MIT',
    copyright: 'Copyright (c) 2025 Wombosvideo',
    url: 'https://github.com/Wombosvideo/tw-animate-css',
    use: 'the enter/exit animations of the dialogs and menus',
  },
  {
    name: 'Roboto',
    version: '@fontsource/roboto 5.3.0',
    license: 'SIL Open Font License 1.1',
    copyright:
      'Copyright 2011 The Roboto Project Authors ' +
      '(https://github.com/googlefonts/roboto-classic)',
    url: 'https://github.com/googlefonts/roboto-classic',
    use: 'the default typeface — woff2 files embedded in the deliverable',
    note:
      'The OFL requires this notice and the license text to travel with the font files, ' +
      'which they do here. No Reserved Font Name is declared, and the font is not sold ' +
      'on its own — the two things the OFL forbids.',
  },
  {
    name: 'Inter',
    version: '@fontsource/inter 5.3.0',
    license: 'SIL Open Font License 1.1',
    copyright: 'Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter)',
    url: 'https://rsms.me/inter/',
    use: 'the second bundled typeface — woff2 files embedded in the deliverable',
    note: 'Same OFL terms as Roboto above.',
  },
]

/**
 * What the product's own MIT license does NOT cover. It matters here because a
 * portfolio can carry a logo and font files: MIT governs this software and the
 * assets IT ships, and nothing a person imports into their own document.
 * Stated in the same words by the README, the About screen and the embedding
 * form — three places, one sentence.
 */
export const IMPORTED_CONTENT_NOTICE =
  'The MIT license covers the software and the assets distributed with it. ' +
  'Logos, fonts, data and other content imported by users remain subject to their ' +
  'own rights and are not licensed under it.'
