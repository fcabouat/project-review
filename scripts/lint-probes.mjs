/**
 * BOUNDARY PROBES — the proof that the architecture fence is switched on.
 *
 * `eslint.config.js` declares the layer boundaries as `no-restricted-imports`
 * blocks. A declared boundary and an ENFORCED boundary are two different
 * things, and the difference is invisible: a `files:` glob that matches
 * nothing, a narrower block that drops a shared fragment (the flat-config trap
 * that config's own header warns about), a rule downgraded to a warning — all
 * of them leave a green lint and an open fence. Zero violations is what a
 * working rule and an absent rule look like from the outside.
 *
 * So each boundary is probed the only way that proves anything: a file
 * carrying the forbidden import is written AT THE VERY PATH the rule guards,
 * ESLint is asked about it, and the run must fail with THAT boundary's own
 * message. Import forbidden → non-zero exit, or this script fails.
 *
 * WHY THE FIXTURES ARE WRITTEN AND NOT VERSIONED IN PLACE. A committed file
 * that violates the fence would break `eslint .` itself — the very command
 * this extends — and would have to be excluded from it, which is exactly the
 * hole being tested for. The fixture SOURCES are versioned here instead, in
 * the table below, and they exist on disk only for the length of one ESLint
 * run; `finally` removes them whatever happens.
 *
 * NOT A NEW GATE: this runs behind `pnpm run lint`, in the same command and the
 * same CI step.
 *
 * WHAT IS NOT PROBED, said rather than hidden. Two blocks of the config name
 * EXACT FILES (`services/persistence.ts`, `services/stored-events.ts`,
 * `services/i18n.ts`) rather than a directory, so the only file that could
 * probe them is the file itself. Their shared fragment — the embeddable-core
 * ban — is probed by the `services/*.ts` case below; their own refinements are
 * not, and no file placed anywhere can change that without editing the config.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')

/**
 * One probe: where the fixture goes (the path the rule guards), what it
 * imports (the thing that boundary forbids), and the fragment of the rule's
 * own message that must come back. The message fragment matters as much as the
 * failure: a probe that only checked "something was reported" would pass on an
 * unrelated rule.
 */
const PROBES = [
  /* ---- one probe per LAYER RULE: what that layer alone may not reach ---- */
  {
    path: 'packages/core/src/values/probe-boundary.ts',
    imports: '../../model/portfolio',
    expect: 'values/ is the bottom layer',
  },
  {
    path: 'packages/core/src/model/probe-boundary.ts',
    imports: '../data/empty-portfolio',
    expect: 'model/ only rests on values/',
  },
  {
    path: 'packages/core/src/data/probe-boundary.ts',
    imports: '../events',
    expect: 'data/ is initialisation data',
  },
  {
    path: 'packages/core/src/services/parse/probe-boundary.ts',
    imports: '../../commands',
    expect: 'services/parse rests on model + values alone',
  },
  {
    path: 'packages/core/src/services/probe-boundary.ts',
    imports: '../commands',
    expect: 'the flat services rest on model + values + events',
  },
  {
    path: 'packages/core/src/runtime/probe-boundary.ts',
    imports: '../services/persistence',
    expect: 'runtime/ orchestrates model + values + commands + events',
  },
  {
    path: 'packages/core/src/commands/probe-boundary.ts',
    imports: '../runtime/editing',
    expect: 'nothing inside the core imports the runtime',
  },
  {
    path: 'packages/core/src/events/probe-boundary.ts',
    imports: '../runtime/editing',
    expect: 'nothing inside the core imports the runtime',
  },
  {
    path: 'packages/core/src/projections/probe-boundary.ts',
    imports: '../runtime/editing',
    expect: 'nothing inside the core imports the runtime',
  },
  {
    path: 'packages/components/src/editor/probe-boundary.ts',
    imports: '../screens/contracts',
    expect: 'screens/ composes the other sub-folders',
  },
  {
    path: 'packages/components/src/slides/probe-boundary.ts',
    imports: '../editor/validation',
    expect: 'slides/ and commons/ are pure view leaves',
  },
  {
    path: 'packages/components/src/commons/probe-boundary.ts',
    imports: '../editor/validation',
    expect: 'slides/ and commons/ are pure view leaves',
  },
  {
    path: 'packages/components/src/slideshow/probe-boundary.ts',
    imports: '../editor/validation',
    expect: 'The editor widgets host the slideshow',
  },
  {
    path: 'packages/infrastructure/src/probe-boundary.ts',
    imports: 'svelte',
    expect: '@project-review/infrastructure may only import @project-review/core',
  },

  /* ---- and one per PATH AT WHICH A SHARED FRAGMENT IS RESTATED ----
     This half is the one that catches the flat-config trap `eslint.config.js`
     warns about in its own header: for a single rule key the last matching
     block wins WHOLE, so a narrower block that forgets the package-wide
     fragment silently reopens the package-wide fence — with zero violations
     and a green lint, because the code that would have tripped it is not
     written. The layer probes above would not notice: they check the narrower
     rule, which is precisely the one that still works. */
  ...[
    'packages/core/src',
    'packages/core/src/values',
    'packages/core/src/model',
    'packages/core/src/data',
    'packages/core/src/services',
    'packages/core/src/services/parse',
    'packages/core/src/runtime',
    'packages/core/src/commands',
    'packages/core/src/events',
    'packages/core/src/projections',
  ].map((dir) => ({
    path: `${dir}/probe-embeddable.ts`,
    imports: 'svelte',
    expect: '@project-review/core is embeddable',
  })),
  ...[
    'packages/components/src',
    'packages/components/src/editor',
    'packages/components/src/screens',
    'packages/components/src/slides',
    'packages/components/src/commons',
    'packages/components/src/slideshow',
  ].map((dir) => ({
    path: `${dir}/probe-embeddable.ts`,
    imports: '@project-review/infrastructure/local-storage',
    expect: '@project-review/components may only import @project-review/core',
  })),
]

/** The fixture itself — the forbidden import, and a use of it so the file has
 * no reason to be reported for anything else first. */
const fixture = (probe) =>
  `// Written by scripts/lint-probes.mjs; removed by it. Never committed.\n` +
  `import * as forbidden from '${probe.imports}'\n` +
  `export const probe: unknown = forbidden\n`

const written = []

/** ESLint over every fixture at once — one process, whatever the count. */
function report(paths) {
  try {
    const out = execFileSync(
      process.execPath,
      ['node_modules/eslint/bin/eslint.js', '--no-color', '--format', 'json', ...paths],
      {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    // A clean exit means NOT ONE boundary fired: every fence is open.
    return { failed: false, results: JSON.parse(out) }
  } catch (error) {
    if (typeof error.stdout !== 'string' || error.stdout === '') throw error
    return { failed: true, results: JSON.parse(error.stdout) }
  }
}

try {
  for (const probe of PROBES) {
    const full = join(ROOT, probe.path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, fixture(probe))
    written.push(full)
  }

  const { failed, results } = report(PROBES.map((p) => p.path))
  const byFile = new Map(results.map((r) => [r.filePath, r]))

  let open = 0
  for (const probe of PROBES) {
    const messages = byFile.get(join(ROOT, probe.path))?.messages ?? []
    const hit = messages.some(
      (m) => m.ruleId === 'no-restricted-imports' && m.message.includes(probe.expect),
    )
    if (hit) continue
    open += 1
    console.error(
      `probe: ${probe.path} imported '${probe.imports}' and the fence stayed open` +
        ` — expected a no-restricted-imports message containing "${probe.expect}"`,
    )
  }

  if (!failed) {
    console.error('probe: eslint exited 0 over every fixture — no boundary is enforced at all')
    open = open || PROBES.length
  }

  if (open > 0) {
    console.error(`probes: ${open} of ${PROBES.length} boundaries are NOT enforced — failing`)
    process.exit(1)
  }
  console.log(`probes: ${PROBES.length} declared boundaries, ${PROBES.length} enforced`)
} finally {
  for (const full of written) rmSync(full, { force: true })
}
