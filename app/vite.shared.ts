import { createRequire } from 'node:module'

// The require export selects Reveal's UMD build for standalone HTML exports.
// Resolve through the app's declared dependency, independent of installer layout.
export const engineSourceAlias = {
  find: /^reveal\.js\/standalone(?=\?|$)/,
  replacement: createRequire(import.meta.url).resolve('reveal.js'),
}
