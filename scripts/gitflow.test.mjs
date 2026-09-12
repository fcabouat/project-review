import test from 'node:test'
import assert from 'node:assert/strict'
import { route, mergedDelivery, checkGitflow } from './gitflow.mjs'

test('Gitflow routes reject direct promotions, wrong names and foreign deliveries', () => {
  for (const [base, head, expected] of [
    ['develop', 'feature/editor', 'feature'],
    ['main', 'release/0.1.1', 'ship'],
    ['main', 'hotfix/0.1.2', 'ship'],
    ['develop', 'release/0.1.1', 'backport'],
    ['develop', 'hotfix/0.1.2', 'backport'],
    ['release/0.1.1', 'feature/stabilization', 'stabilize'],
  ])
    assert.equal(route(base, head, true, 'maintainer'), expected)
  for (const [base, head, same] of [
    ['main', 'develop', true],
    ['develop', 'main', true],
    ['main', 'feature/editor', true],
    ['develop', 'chore/tooling', true],
    ['main', 'release/latest', true],
    ['main', 'release/0.1.1', false],
    ['main', 'hotfix/01.2.3', true],
  ])
    assert.throws(() => route(base, head, same, 'maintainer'), /Gitflow refuses/)
  assert.equal(route('develop', 'dependabot/npm/pkg', true, 'dependabot[bot]'), 'dependency')
  assert.throws(() => route('develop', 'dependabot/fake', true, 'someone'), /Gitflow refuses/)
})

const repo = { owner: 'test', repo: 'project' }
function fixture(options = {}) {
  const pr = {
    base: { ref: options.base ?? 'main', sha: 'base' },
    head: {
      ref: options.head ?? 'release/0.1.1',
      sha: 'head',
      repo: { full_name: 'test/project' },
    },
    user: { login: 'maintainer' },
    merged_at: 'now',
    merge_commit_sha: 'merge',
  }
  const github = {
    rest: {
      repos: {
        listPullRequestsAssociatedWithCommit: async () => ({ data: options.noPr ? [] : [pr] }),
        getCommit: async () => ({
          data: {
            parents: options.squash ? [{ sha: 'base' }] : [{ sha: 'base' }, { sha: 'head' }],
          },
        }),
        getContent: async ({ path, ref }) => {
          if (path === '.changeset')
            return { data: options.pending ? [{ name: 'new.md' }] : [{ name: 'config.json' }] }
          const content = path.endsWith('package.json')
            ? JSON.stringify({
                version: ref === 'base' ? '0.1.0' : (options.version ?? '0.1.1'),
                private: true,
              })
            : '# App\n\n## 0.1.1\n\nNotes\n'
          return { data: { content: Buffer.from(content).toString('base64') } }
        },
        getReleaseByTag: async () => ({ data: { draft: options.draft ?? false } }),
        compareCommitsWithBasehead: async () => ({
          data: {
            status: options.diverged ? 'diverged' : 'ahead',
            merge_base_commit: { sha: options.oldHotfix ? 'old' : 'base' },
          },
        }),
      },
    },
  }
  return {
    github,
    context: {
      repo,
      sha: 'merge',
      ref: 'refs/heads/main',
      payload: options.push ? {} : { pull_request: pr },
    },
    core: { setOutput() {} },
  }
}

test('main requires a real delivery PR and a classic merge', async () => {
  assert.equal((await mergedDelivery(fixture().github, repo, 'merge')).head.ref, 'release/0.1.1')
  for (const options of [{ noPr: true }, { squash: true }, { head: 'develop' }]) {
    await assert.rejects(
      mergedDelivery(fixture(options).github, repo, 'merge'),
      /main must receive/,
    )
  }
})

test('versions and consumed changesets are enforced before shipping and backporting', async () => {
  await checkGitflow(fixture())
  await checkGitflow(fixture({ head: 'hotfix/0.1.1' }))
  await checkGitflow(fixture({ push: true }))
  await checkGitflow(fixture({ base: 'develop' }))
  for (const options of [
    { pending: true },
    { head: 'hotfix/0.1.1', oldHotfix: true },
    { version: '0.1.2' },
    { base: 'develop', draft: true },
    { base: 'develop', diverged: true },
    { base: 'develop', head: 'feature/manual-bump' },
  ])
    await assert.rejects(checkGitflow(fixture(options)))
  await checkGitflow(fixture({ base: 'develop', head: 'feature/unchanged', version: '0.1.0' }))
})
