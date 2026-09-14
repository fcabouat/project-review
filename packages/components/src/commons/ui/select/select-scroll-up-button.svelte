<script lang="ts">
  import { Select as SelectPrimitive } from 'bits-ui'
  import Icon from '../../Icon.svelte'
  import { cn, type WithoutChildrenOrChild } from '../utils.js'

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: WithoutChildrenOrChild<SelectPrimitive.ScrollUpButtonProps> = $props()
</script>

<SelectPrimitive.ScrollUpButton
  bind:ref
  data-slot="select-scroll-up-button"
  class={cn(
    "z-10 flex cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4 top-0 w-full",
    className,
  )}
  {...restProps}
>
  <Icon name="arrow-up-s-line" size="16px" />
</SelectPrimitive.ScrollUpButton>
