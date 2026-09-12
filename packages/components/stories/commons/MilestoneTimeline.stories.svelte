<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import MilestoneTimeline from '../../src/commons/MilestoneTimeline.svelte'
  import { colorOf, reviewDate, language, project } from './story-data'

  const { Story } = defineMeta({
    title: 'Atoms/MilestoneTimeline',
    component: MilestoneTimeline,
    args: { language, reviewDate },
    parameters: {
      docs: {
        description: {
          component:
            'LINEAR time scale bounded to [8 %, 92 %]: the distance between two points is the distance between the dates. Filled dot = past milestone, hollow = upcoming, red = overdue; the red line is the review date. Label staggering kicks in by itself as soon as two milestones crowd.',
        },
      },
    },
  })
</script>

<!-- P-04, reference template: 4 well-spaced milestones, cursor at 56 %. -->
<Story name="Nominal" asChild>
  <div class="frame" style:--cat={colorOf('P-04')}>
    <MilestoneTimeline milestones={project('P-04').milestones} {reviewDate} {language} />
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
