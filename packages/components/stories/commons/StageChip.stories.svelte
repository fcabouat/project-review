<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import StageChip from '../../src/commons/StageChip.svelte'
  import { language } from './story-data'

  // One story per stage: each has its ground, ink and weight — the state carries meaning.
  const { Story } = defineMeta({
    title: 'Atoms/StageChip',
    component: StageChip,
    args: { language },
    parameters: {
      docs: {
        description: {
          component:
            'Six life-cycle stages, plus the "en attente" mention stuck alongside. The `color-mix(currentColor 25%)` hairline is mandatory (pitfall n° 13): without it the pale grounds vanish on zebra rows and in print.',
        },
      },
    },
  })
</script>

<Story name="To scope" args={{ stage: 'toScope' }} />
<Story name="Ready" args={{ stage: 'ready' }} />
<Story name="In progress" args={{ stage: 'inProgress' }} />
<Story name="Done · residuals" args={{ stage: 'residuals' }} />
<Story name="Closed" args={{ stage: 'closed' }} />
<Story name="Abandoned" args={{ stage: 'abandoned' }} />

<!-- P-06 of the sample data set: in progress AND on hold — the second chip sticks to the first. -->
<Story name="In progress · on hold" args={{ stage: 'inProgress', onHold: true }} />
