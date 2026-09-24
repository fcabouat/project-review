<script lang="ts">
  import type { Project } from '@project-review/core/model/project'
  import type { Language } from '@project-review/core/model/theme'
  import { t } from '@project-review/core/services/i18n'
  let {
    project,
    language,
    lead = true,
  }: { readonly project: Project; readonly language: Language; readonly lead?: boolean } = $props()
</script>

<span
  >{#if project.reference}<b>{project.reference}</b>{' · '}{/if}{project.name}</span
>
{#if lead && project.lead}<span class="block text-[0.85em] leading-[1.25] font-normal"
    >{t('sheet.lead', language)} : {project.lead}</span
  >{/if}
{#if project.scopeTags?.length}
  <span
    class="line-clamp-2 text-[0.8em] leading-[1.25] font-normal break-all"
    title={project.scopeTags.join(' ')}
  >
    {project.scopeTags.join(' ')}
  </span>
{/if}
