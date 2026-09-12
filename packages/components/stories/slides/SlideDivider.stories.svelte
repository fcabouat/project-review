<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import SlideDivider from '../../src/slides/SlideDivider.svelte'
  import { sample } from '../commons/story-data'
  import { isTracked } from '@project-review/core/projections'
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { Project } from '@project-review/core/model/project'
  import { projectId } from '@project-review/core/values/ids'

  /* Compact mode starts at 6 projects, and the sample data set has no category
     that big: the story clones the projects of "Infrastructure" — real data,
     renumbered — to reach the 8 that trip the two-column list. */
  const infra = sample.projects.filter((p) => p.categoryId === 'infra' && isTracked(p))
  const filler: Project[] = Array.from({ length: 8 }, (_, i) => {
    const source = infra[i % infra.length] as Project
    return { ...source, id: projectId(`P-${String(40 + i)}`)! }
  })
  const crowded: Portfolio = {
    ...sample,
    projects: [...sample.projects.filter((p) => p.categoryId !== 'infra'), ...filler],
  }

  /* Orphan divider: two projects whose categoryId resolves to NO category —
     a GHOST id, exactly what a hand-edited file produces (never the sentinel's
     own 'unsorted'). The deck derives the implicit "À classer" group for them;
     the divider must LIST them (`projectsOfGroup`) and show the LOCALIZED
     sentinel name (categoryName), never the raw catalog key. */
  const orphaned: Portfolio = {
    ...sample,
    projects: sample.projects.map((p, i) =>
      i < 2 ? { ...p, categoryId: 'ghost' as Project['categoryId'] } : p,
    ),
  }

  const { Story } = defineMeta({
    title: 'Slides/Divider',
    component: SlideDivider,
    args: { portfolio: sample },
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            '"Monument" composition: giant numeral bleeding off both edges, right-aligned content column. The list mode is decided by `dividerMode` on the project count — plain up to 5, two columns from 6 to 10, truncated beyond.',
        },
      },
    },
  })
</script>

<!-- 3 projects: plain list. -->
<Story name="Normal" args={{ group: { kind: 'category', id: 'infra' }, number: 2 }} />

<!-- 8 projects: the list goes to two columns rather than running past the floor. -->
<Story
  name="Compact"
  args={{ portfolio: crowded, group: { kind: 'category', id: 'infra' }, number: 2 }}
/>

<!-- Orphan projects (ghost categoryId): the implicit "À classer" divider —
     it lists the two orphans, and the heading is the LOCALIZED sentinel
     label, never the raw `category.unsorted` key. The group is a KIND of its
     own, so this divider does not depend on any id being free. -->
<Story
  name="Unsorted (orphans)"
  args={{ portfolio: orphaned, group: { kind: 'orphans' }, number: 5 }}
/>
