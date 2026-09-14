import test from 'node:test'
import assert from 'node:assert/strict'
import { route, checkGitflow } from './gitflow.mjs'

test('Gitflow routes work branches to develop and rejects delivery PRs', () => {
  assert.equal(route('develop', 'feature/editor', true, 'maintainer'), 'work')
  assert.equal(route('develop', 'bugfix/layout', true, 'maintainer'), 'work')
  assert.equal(route('develop', 'dependabot/npm/pkg', true, 'dependabot[bot]'), 'dependency')
  for (const [base, head] of [
    ['main', 'develop'],
    ['main', 'release/0.3.0'],
    ['develop', 'release/0.3.0'],
    ['main', 'hotfix/0.2.2'],
    ['develop', 'chore/tooling'],
  ])
    assert.throws(() => route(base, head, true, 'maintainer'), /Gitflow refuses/)
})

const context = {
  repo: { owner: 'test', repo: 'project' },
  payload: {
    pull_request: {
      base: { ref: 'develop', sha: 'base' },
      head: { ref: 'feature/editor', sha: 'head', repo: { full_name: 'test/project' } },
      user: { login: 'maintainer' },
    },
  },
}
const github = (headVersion = '0.2.1') => ({
  rest: {
    repos: {
      compareCommitsWithBasehead: async () => ({ data: { merge_base_commit: { sha: 'base' } } }),
      getContent: async ({ ref }) => ({
        data: {
          content: Buffer.from(
            JSON.stringify({ version: ref === 'base' ? '0.2.1' : headVersion }),
          ).toString('base64'),
        },
      }),
    },
  },
})

test('work PRs keep release versions unchanged', async () => {
  await checkGitflow({ github: github(), context })
  await assert.rejects(checkGitflow({ github: github('0.3.0'), context }), /must not change/)
})
