/**
 * Reviewed notices for code/assets shipped in the deliverable, including transitive
 * dependencies and generated output. About and build-notices consume this table.
 * Package versions and license-file presence are checked during generation;
 * terms and copyright are manually reviewed. A metadata discrepancy is noted explicitly.
 */

/** One third-party component of the deliverable, and its terms. */
interface Notice {
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

/** Every notice has a distributable text, installed or vendored. */
export type ThirdPartyNotice = Notice &
  (
    | { readonly pkg: string; readonly licenseFile?: never }
    | { readonly pkg?: never; readonly licenseFile: string }
  )

/**
 * The notices, in the order a reader meets them: what the deck runs on, what
 * the interface is built from, then the typefaces.
 */
export const THIRD_PARTY_NOTICES: readonly ThirdPartyNotice[] = [
  {
    name: 'reveal.js',
    pkg: 'reveal.js',
    version: '6.0.1',
    license: 'MIT',
    copyright:
      'Copyright (C) 2011-2026 Hakim El Hattab, http://hakim.se, and reveal.js contributors',
    url: 'https://revealjs.com',
    use: 'the slideshow engine — inlined into the exported standalone deck',
  },
  {
    name: 'Svelte',
    pkg: 'svelte',
    version: '5.57.0',
    license: 'MIT',
    copyright:
      'Copyright (c) 2016-2025 [Svelte Contributors]' +
      '(https://github.com/sveltejs/svelte/graphs/contributors)',
    url: 'https://svelte.dev',
    use: 'the component runtime the whole interface compiles onto',
  },
  {
    name: 'Remix Icon',
    pkg: 'remixicon',
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
    pkg: 'bits-ui',
    version: '2.19.1',
    license: 'MIT',
    copyright: 'Copyright (c) 2023 Hunter Johnston',
    url: 'https://bits-ui.com',
    use: 'the accessible behaviour under the dialogs, menus, tabs and switches',
  },
  {
    name: 'shadcn-svelte',
    pkg: 'shadcn-svelte',
    version: '1.6.1',
    license: 'MIT',
    copyright:
      'Copyright (c) 2023 Hunter Johnston <https://github.com/huntabyte>, ' +
      'Copyright (c) 2023 CokaKoala <https://github.com/adriangonz97>, ' +
      'Copyright (c) 2023 shadcn',
    url: 'https://www.shadcn-svelte.com',
    use: 'the interface primitives, VENDORED into the source tree and adapted',
    note:
      'Vendored AND depended upon: the primitives were fetched with the CLI into ' +
      'packages/components/src/commons/ui/ and edited locally, and the package also ' +
      'ships dist/tailwind.css, which the components tokens.css imports. The upstream ' +
      'licence sits next to the vendored sources (commons/ui/LICENSE.md) — a link to ' +
      'someone else’s repository is not a copy of anything.',
  },
  {
    name: '@floating-ui/dom',
    pkg: '@floating-ui/dom',
    version: '1.8.0',
    license: 'MIT',
    copyright: 'Copyright (c) 2021-present Floating UI contributors',
    url: 'https://floating-ui.com',
    use: 'the positioning of the menus, selects and tooltips, under bits-ui',
    note:
      'Reaches the deliverable through bits-ui, with @floating-ui/core and ' +
      '@floating-ui/utils (same licence, same holder, same version family): three ' +
      'packages, one notice, because they are one project.',
  },
  {
    name: 'tabbable',
    pkg: 'tabbable',
    version: '6.5.0',
    license: 'MIT',
    copyright: 'Copyright (c) 2015 David Clark',
    url: 'https://github.com/focus-trap/tabbable',
    use: 'the focus order the dialogs and menus trap, under bits-ui',
  },
  {
    name: 'runed',
    pkg: 'runed',
    version: '0.35.1',
    license: 'MIT',
    copyright:
      'Copyright (c) 2024 Hunter Johnston <https://github.com/huntabyte>, ' +
      'Copyright (c) 2024 Thomas G. Lopes <https://github.com/tglide>',
    url: 'https://runed.dev',
    use: 'the reactive utilities bits-ui builds its primitives on',
  },
  {
    name: 'svelte-toolbelt',
    pkg: 'svelte-toolbelt',
    version: '0.10.6',
    license: 'MIT',
    copyright:
      'Copyright (c) 2024 Hunter Johnston <https://github.com/huntabyte>, ' +
      'Copyright (c) 2024 Thomas G. Lopes <https://github.com/tglide>',
    url: 'https://github.com/huntabyte/svelte-toolbelt',
    use: 'the box/ref helpers bits-ui passes its elements through',
    note:
      'The package declares NO license field at all; the file it ships is MIT. The ' +
      'file governs — a tool reading the metadata alone would report this one unknown, ' +
      'and it is in the bundle.',
  },
  {
    name: 'style-to-object',
    pkg: 'style-to-object',
    version: '1.0.14',
    license: 'MIT',
    copyright: 'Copyright (c) 2017 Menglin "Mark" Xu <mark@remarkablemark.org>',
    url: 'https://github.com/remarkablemark/style-to-object',
    use: 'inline-style parsing inside the vendored primitives, with inline-style-parser',
  },
  {
    name: 'inline-style-parser',
    pkg: 'inline-style-parser',
    version: '0.2.7',
    license: 'MIT',
    copyright: 'Copyright (c) 2012 TJ Holowaychuk <tj@vision-media.ca>',
    url: 'https://github.com/remarkablemark/inline-style-parser',
    use: 'the parser under style-to-object',
  },
  {
    name: 'esm-env',
    pkg: 'esm-env',
    version: '1.2.2',
    license: 'MIT',
    copyright: 'Copyright 2022 Benjamin McCann',
    url: 'https://github.com/benmccann/esm-env',
    use: 'the build-time environment flags Svelte and runed compile against',
  },
  {
    name: 'tailwind-merge',
    pkg: 'tailwind-merge',
    version: '3.6.0',
    license: 'MIT',
    copyright: 'Copyright (c) 2021 Dany Castillo',
    url: 'https://github.com/dcastil/tailwind-merge',
    use: 'class-list merging inside the interface primitives',
  },
  {
    name: 'tailwind-variants',
    pkg: 'tailwind-variants',
    version: '3.3.1',
    license: 'MIT',
    copyright: 'Copyright (c) 2020 Tailwid Variants',
    url: 'https://www.tailwind-variants.org',
    use: 'the variant tables of the interface primitives',
    note: 'The copyright line is quoted verbatim, typo and all.',
  },
  {
    name: 'clsx',
    pkg: 'clsx',
    version: '2.1.1',
    license: 'MIT',
    copyright: 'Copyright (c) Luke Edwards <luke.edwards05@gmail.com> (lukeed.com)',
    url: 'https://github.com/lukeed/clsx',
    use: 'conditional class names, under tailwind-merge',
  },
  {
    name: 'Tailwind CSS',
    pkg: 'tailwindcss',
    version: '4.3.3',
    license: 'MIT',
    copyright: 'Copyright (c) Tailwind Labs, Inc.',
    url: 'https://tailwindcss.com',
    use: 'the utility stylesheet generated into the deliverable, and the colour values of the "tailwind" category palette',
  },
  {
    name: 'Material Design colour system',
    licenseFile: 'licenses/material-design-lite.txt',
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
    pkg: 'tw-animate-css',
    version: '1.4.0',
    license: 'MIT',
    copyright: 'Copyright (c) 2025 Wombosvideo',
    url: 'https://github.com/Wombosvideo/tw-animate-css',
    use: 'the enter/exit animations of the dialogs and menus',
  },
  {
    name: 'Roboto',
    pkg: '@fontsource/roboto',
    version: '5.3.0',
    license: 'SIL Open Font License 1.1',
    copyright:
      'Copyright 2011 The Roboto Project Authors ' +
      '(https://github.com/googlefonts/roboto-classic) ' +
      'Roboto-Italic[wdth,wght].ttf: Copyright 2011 The Roboto Project Authors ' +
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
    pkg: '@fontsource/inter',
    version: '5.3.0',
    license: 'SIL Open Font License 1.1',
    copyright:
      'Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter) ' +
      'Inter-Italic[opsz,wght].ttf: Copyright 2016 The Inter Project Authors ' +
      '(https://github.com/rsms/inter)',
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
