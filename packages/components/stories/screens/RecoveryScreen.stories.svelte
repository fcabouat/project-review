<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  // Mounted by the app in place of the shell, which owns the stylesheet import.
  import '../../src/editor/editor.css'
  import RecoveryScreen from '../../src/screens/RecoveryScreen.svelte'
  import { readPortfolioJson } from '@project-review/core/services/parse'

  const { Story } = defineMeta({
    title: 'Screens/Recovery',
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            "What the application shows INSTEAD of the editor when a snapshot is stored and the format refuses it. By the time this renders the automatic saves are already disarmed (the host's persistence control), so nothing can overwrite the data while the person reads: the screen exists to make the choice explicit and reversible-by-download. «Download the backup» hands back the stored bytes verbatim — nothing repaired, reformatted or truncated — and «Start empty» is the only path that abandons them. The report between the two is the strict parse's own, rendered exactly as the import dialog renders it: same verdict, same wording. The two stories are the two shapes a refusal takes — a contract report, and a pre-parse refusal (the text was not JSON at all).",
        },
      },
    },
  })

  /** Real refusals, produced by the real parse: the report is never hand-written. */
  const brokenContract = readPortfolioJson(
    JSON.stringify({
      version: 1,
      review: { title: 'Q3 review' },
      settings: { theme: { font: 'Times New Roman!!' } },
      projects: [{ id: '', name: 'Nameless' }],
      categories: [],
      freeSlides: [],
      leftover: true,
    }),
  )
  const notJson = readPortfolioJson('{ "review": "truncated by a full disk…')

  const refusalOf = (outcome: ReturnType<typeof readPortfolioJson>) => {
    if (outcome.ok) throw new Error('the story needs a refused payload')
    return outcome
  }
</script>

<Story name="Contract report" asChild>
  <RecoveryScreen
    language="en"
    refusal={refusalOf(brokenContract)}
    raw={'{"version":1,"…":"the stored bytes, handed back as they are"}'}
    startEmpty={() => {}}
  />
</Story>

<Story name="Not JSON at all" asChild>
  <RecoveryScreen
    language="fr"
    refusal={refusalOf(notJson)}
    raw={'{ "review": "truncated by a full disk…'}
    startEmpty={() => {}}
  />
</Story>
