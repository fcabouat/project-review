import type { StorybookConfig } from '@storybook/svelte-vite'

// Stories live in stories/, a mirror of src/ (strict production/test split):
// nothing under src/ is a story, nothing under stories/ ships.
const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.svelte'],
  addons: [
    '@storybook/addon-svelte-csf',
    '@chromatic-com/storybook',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
  ],
  framework: '@storybook/svelte-vite',
}
export default config
