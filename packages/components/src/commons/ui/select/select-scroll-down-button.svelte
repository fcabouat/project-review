<script lang="ts">
  import { Select as SelectPrimitive } from 'bits-ui'
  import Icon from '../../Icon.svelte'
  import { cn, type WithoutChildrenOrChild } from '../utils.js'

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: WithoutChildrenOrChild<SelectPrimitive.ScrollDownButtonProps> = $props()
</script>

<SelectPrimitive.ScrollDownButton
  bind:ref
  data-slot="select-scroll-down-button"
  class={cn(
    "z-10 flex cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4 bottom-0 w-full",
    className,
  )}
  {...restProps}
>
  <Icon name="arrow-down-s-line" size="16px" />
</SelectPrimitive.ScrollDownButton>
