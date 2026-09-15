<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import MilestoneTimeline from '../../src/commons/MilestoneTimeline.svelte'
  import { colorOf, reviewDate, language, project } from './story-data'
  import { isoDate } from '@project-review/core/values/date'

  const { Story } = defineMeta({
    title: 'Atoms/MilestoneTimeline',
    component: MilestoneTimeline,
    args: { language, reviewDate },
    parameters: {
      docs: {
        description: {
          component:
            'Time spacing is retained when readable and adjusted when dates crowd. Labels wrap on two lines and alternate above/below the axis. Filled = completed, hollow = upcoming, red = overdue relative to the review date. The cursor follows the adjusted scale too.',
        },
      },
    },
  })
</script>

<!-- P-04: well-spaced milestones with a review cursor inside the range. -->
<Story name="Nominal" asChild>
  <div class="frame" style:--cat={colorOf('P-04')}>
    <MilestoneTimeline milestones={project('P-04').milestones} {reviewDate} {language} />
  </div>
</Story>

<Story name="Same-day milestones with long labels" asChild>
  <div class="frame" style:--cat={colorOf('P-09')}>
    <MilestoneTimeline
      milestones={Array.from({ length: 6 }, (_, i) => ({
        label: `Étape ${i + 1} — validation technique des équipements avant leur mise en service`,
        date: isoDate('2026-09-01')!,
        done: i < 2,
      }))}
      {reviewDate}
      {language}
    />
  </div>
</Story>

<!-- P-09, dense case: 6 milestones, two of them 12 days apart → staggered labels. -->
<Story name="Dense — 6 close milestones" asChild>
  <div class="frame" style:--cat={colorOf('P-09')}>
    <MilestoneTimeline milestones={project('P-09').milestones} {reviewDate} {language} />
  </div>
</Story>

<!-- P-06: "Réponse opérateur" expected on 31/08, review on 03/09 → overdue milestone. -->
<Story name="With an overdue milestone" asChild>
  <div class="frame" style:--cat={colorOf('P-06')}>
    <MilestoneTimeline milestones={project('P-06').milestones} {reviewDate} {language} />
  </div>
</Story>

<!-- No milestone: the axis and the legend stay, the sheet does not deform. -->
<Story name="Empty" asChild>
  <div class="frame" style:--cat={colorOf('P-04')}>
    <MilestoneTimeline milestones={[]} {reviewDate} {language} />
  </div>
</Story>

<style>
  /* usable width of a sheet: 1280 − 71 (bar) − 2 × 44 (margins) */
  .frame {
    width: 1121px;
    background: #fff;
  }
</style>
