<script module lang="ts">
  /**
   * Remix Icon icons **inlined** (never the icon font: its baseline floats).
   * The package SVG already carries `fill="currentColor"`; the stylesheet below
   * restates it so we survive any variation of the package.
   * Six icons only — each one must earn its place (plan § 4): five on the
   * sheets, plus `eye-line` for the editor's "preview this slide" affordance.
   */
  import checkLine from 'remixicon/icons/System/check-line.svg?raw'
  import timeLine from 'remixicon/icons/System/time-line.svg?raw'
  import arrowRightLine from 'remixicon/icons/Arrows/arrow-right-line.svg?raw'
  import alertLine from 'remixicon/icons/System/alert-line.svg?raw'
  import scales3Line from 'remixicon/icons/Others/scales-3-line.svg?raw'
  import eyeLine from 'remixicon/icons/System/eye-line.svg?raw'

  export const ICONS = {
    'check-line': checkLine,
    'time-line': timeLine,
    'arrow-right-line': arrowRightLine,
    'alert-line': alertLine,
    'scales-3-line': scales3Line,
    'eye-line': eyeLine,
  } as const

  export type IconName = keyof typeof ICONS

  export const ICON_NAMES = Object.keys(ICONS) as readonly IconName[]
</script>

<script lang="ts">
  interface Props {
    readonly name: IconName
    /** Any CSS length; 1em by default — the icon follows the text size. */
    readonly size?: string
    /** Set ⇒ the icon carries meaning; otherwise it is decorative. */
    readonly title?: string
  }

  let { name, size = '1em', title }: Props = $props()
</script>

<span
  class="icon"
  style:--icon-size={size}
  role={title ? 'img' : undefined}
  aria-label={title}
  aria-hidden={title ? undefined : 'true'}
>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- static remixicon catalog, no user content ever flows here -->
  {@html ICONS[name]}
</span>

<style>
  /* inline-flex + align-items:center: no optical offset, whatever the line. */
  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    line-height: 0;
  }
  .icon :global(svg) {
    display: block;
    width: var(--icon-size);
    height: var(--icon-size);
    fill: currentColor;
  }
</style>
