<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import TextLine from '../../src/commons/TextLine.svelte'
  import { project } from './story-data'

  // The three lines come from the sample data set, not from a lorem.
  const PLAIN = project('P-06').done[0] ?? ''
  const BOLD = project('P-06').ongoing[0] ?? ''
  const BOLD_SUFFIX = project('P-09').done[0] ?? ''

  const { Story } = defineMeta({
    title: 'Atoms/TextLine',
    component: TextLine,
    parameters: {
      docs: {
        description: {
          component:
            'Micro-format § 4.5: `**bold**` and a dimmed suffix after the LAST " — " surrounded by spaces. "18 k€" and glued dashes trigger nothing. In list context, hanging indent: the 2nd line aligns on the 1st.',
        },
      },
    },
  })
</script>

<!-- P-06 "Audit réseau des deux sites": bare text, no enrichment. -->
<Story name="Plain" args={{ text: PLAIN }} />

<!-- P-06 "**En attente** de la réponse opérateur…": leading bold segment. -->
<Story name="With bold" args={{ text: BOLD }} />

<!-- P-09 "**Siège basculé** — 380 lignes": bold + dimmed suffix. -->
<Story name="Bold and suffix" args={{ text: BOLD_SUFFIX }} />
