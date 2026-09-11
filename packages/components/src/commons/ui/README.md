# commons/ui — vendored interface primitives

Adapted from [shadcn-svelte](https://www.shadcn-svelte.com), style `vega`,
fetched with the official CLI (see `../../../components.json`).

**The terms travel with the code**: [`LICENSE.md`](./LICENSE.md) next to this
file is the upstream MIT licence, copied verbatim from the installed
`shadcn-svelte` package — three copyright holders, 2023. Vendoring is still
redistribution, and MIT asks for the notice in every copy; a link to someone
else's repository is not a copy of anything. The same three lines are quoted in
the product's notices table (core's `data/third-party.ts`) and therefore in the
About screen and in `THIRD-PARTY.md` — one attribution, said in four places.

Vendored means owned: these sources are part of this package, reviewed and
edited like any other file. Updates are manual — re-run
`bunx shadcn-svelte@latest add <component> -o` with the aliases of
`components.json` declared as `paths` in a tsconfig, then re-apply the local
adaptations below. There is no automatic sync.

Local adaptations, applied to every fetched component:

- **Icons**: `@lucide/svelte` imports are replaced by the package's inlined
  Remix icons (`commons/Icon.svelte`) — one icon convention everywhere.
- **Imports**: the CLI's `$ui/…` aliases are rewritten to relative paths; the
  published tree resolves without path aliases.
- **Trim**: parts no screen consumes are dropped (with their `index.ts`
  entries); a future need re-fetches them.

The primitives are a neutral skeleton: every color they use resolves through
the shadcn alias layer of `../../tokens.css` (`@theme inline`) onto the
package's own chrome tokens.
