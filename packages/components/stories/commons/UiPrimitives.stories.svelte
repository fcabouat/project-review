<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  // Same ground as the shell: the residue chrome plus the token aliases.
  import '../../src/editor/editor.css'
  import * as AlertDialog from '../../src/commons/ui/alert-dialog'
  import { Badge } from '../../src/commons/ui/badge'
  import { Button } from '../../src/commons/ui/button'
  import { Checkbox } from '../../src/commons/ui/checkbox'
  import * as Dialog from '../../src/commons/ui/dialog'
  import * as DropdownMenu from '../../src/commons/ui/dropdown-menu'
  import { Input } from '../../src/commons/ui/input'
  import * as RadioGroup from '../../src/commons/ui/radio-group'
  import * as Select from '../../src/commons/ui/select'
  import { Separator } from '../../src/commons/ui/separator'
  import { Switch } from '../../src/commons/ui/switch'
  import * as Tabs from '../../src/commons/ui/tabs'
  import { Textarea } from '../../src/commons/ui/textarea'

  const { Story } = defineMeta({
    title: 'Commons/Ui primitives',
    parameters: {
      layout: 'padded',
      docs: {
        description: {
          component:
            'The vendored shadcn-svelte primitives (`commons/ui`), rendered under the editor theme: a neutral skeleton whose every color resolves through the token aliases of `tokens.css` onto the chrome tokens. What the editor screens compose is exactly what this gallery shows.',
        },
      },
    },
  })
</script>

<Story name="Gallery" asChild>
  <div class="editor flex max-w-[720px] flex-col gap-6 p-6">
    <section class="flex flex-wrap items-center gap-2.5">
      <Button>Primary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
      <Button size="sm" variant="outline">Small</Button>
      <Button size="icon-sm" variant="ghost" aria-label="Icon button">↶</Button>
      <Badge>12</Badge>
      <Badge variant="secondary">badge</Badge>
    </section>

    <Separator />

    <section class="grid max-w-[420px] gap-3">
      <Input placeholder="A text input" aria-label="A text input" />
      <Textarea rows={2} placeholder="A textarea" aria-label="A textarea"></Textarea>
      <Select.Root type="single" value="one">
        <Select.Trigger class="w-full" aria-label="A select">One</Select.Trigger>
        <Select.Content>
          <Select.Item value="one" label="One" />
          <Select.Item value="two" label="Two" />
          <Select.Item value="three" label="Three" />
        </Select.Content>
      </Select.Root>
      <label class="flex cursor-pointer items-center gap-2 text-[13px]">
        <Checkbox checked />
        <span>A checkbox</span>
      </label>
      <RadioGroup.Root value="a" class="flex gap-4" aria-label="A radio group">
        <label class="flex cursor-pointer items-center gap-2 text-[13px]">
          <RadioGroup.Item value="a" /><span>Choice A</span>
        </label>
        <label class="flex cursor-pointer items-center gap-2 text-[13px]">
          <RadioGroup.Item value="b" /><span>Choice B</span>
        </label>
      </RadioGroup.Root>
      <label class="flex items-center justify-between text-[13px]">
        <span>A switch</span>
        <Switch checked aria-label="A switch" />
      </label>
    </section>

    <Separator />

    <section>
      <Tabs.Root value="first">
        <Tabs.List>
          <Tabs.Trigger value="first">First</Tabs.Trigger>
          <Tabs.Trigger value="second">Second</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="first">
          <p class="text-(--txt2) pt-2 text-[13px]">First panel.</p>
        </Tabs.Content>
        <Tabs.Content value="second">
          <p class="text-(--txt2) pt-2 text-[13px]">Second panel.</p>
        </Tabs.Content>
      </Tabs.Root>
    </section>

    <section class="flex gap-2.5">
      <Dialog.Root>
        <Dialog.Trigger>
          {#snippet child({ props })}
            <Button variant="outline" {...props}>Open a dialog</Button>
          {/snippet}
        </Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>A dialog</Dialog.Title>
            <Dialog.Description>Focus trap, Escape and overlay handled.</Dialog.Description>
          </Dialog.Header>
        </Dialog.Content>
      </Dialog.Root>

      <AlertDialog.Root>
        <AlertDialog.Trigger>
          {#snippet child({ props })}
            <Button variant="destructive" {...props}>Open an alert dialog</Button>
          {/snippet}
        </AlertDialog.Trigger>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Confirm?</AlertDialog.Title>
            <AlertDialog.Description>The destructive-confirmation shape.</AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action>Confirm</AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog.Root>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button variant="outline" {...props}>Open a menu</Button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item>First action</DropdownMenu.Item>
          <DropdownMenu.Item>Second action</DropdownMenu.Item>
          <DropdownMenu.Item variant="destructive">Destructive action</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </section>
  </div>
</Story>
