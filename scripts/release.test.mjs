import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Exercise the actual privileged inline script without moving repository code
// into the API-only publication job or making any network requests.
const workflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8')
const source = workflow
  .split('Publish the validated main commit (never replace a tag)')[1]
  .split('script: |\n')[1]
  .split('      - name:')[0]
  .split('\n')
  .map((line) => line.replace(/^ {12}/, ''))
  .join('\n')
const run = new (Object.getPrototypeOf(async function () {}).constructor)(
  'github',
  'context',
  'core',
  source,
)

test('release preparation requires explicit dispatch while main publication retains its gates', () => {
  const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
  const expression = ci
    .split('\n  release:\n')[1]
    .split('if: >-\n')[1]
    .split('\n    permissions:')[0]
    .trim()
  const allowed = new Function(
    'github',
    'inputs',
    'needs',
    'always',
    'cancelled',
    `return (${expression})`,
  )
  const needs = {
    verify: { result: 'success' },
    codeql: { result: 'success' },
    deploy: { result: 'skipped' },
  }
  const check = (branch, event, prepare = false, results = needs) =>
    allowed(
      { ref: `refs/heads/${branch}`, event_name: event, event: { repository: { private: false } } },
      { prepare_release: prepare },
      results,
      () => true,
      () => false,
    )
  assert.equal(check('develop', 'push'), false)
  assert.equal(check('develop', 'workflow_dispatch'), false)
  assert.equal(check('develop', 'workflow_dispatch', true), true)
  assert.equal(check('develop', 'pull_request', true), false)
  assert.equal(check('release/0.2.1', 'workflow_dispatch', true), false)
  assert.equal(check('main', 'push'), false)
  assert.equal(check('main', 'push', false, { ...needs, deploy: { result: 'success' } }), true)
  assert.equal(
    check('develop', 'workflow_dispatch', true, { ...needs, verify: { result: 'failure' } }),
    false,
  )
  assert.equal(
    check('develop', 'workflow_dispatch', true, { ...needs, codeql: { result: 'failure' } }),
    false,
  )
})

function fixture({ existing = false, lookupError, resolveError, conflict = false } = {}) {
  const writes = []
  let resolved = false
  const missing = (status) => Object.assign(new Error(`HTTP ${status}`), { status })
  const github = {
    rest: {
      git: {
        getRef: async ({ ref }) => {
          if (ref === 'heads/main') return { data: { object: { sha: 'main' } } }
          assert.equal(ref, 'tags/v0.2.0')
          if (lookupError) throw missing(lookupError)
          if (!existing) throw missing(404)
          return { data: { object: { sha: 'tag-object' } } }
        },
        createRef: async (args) => {
          writes.push(['tag', args.sha])
        },
      },
      repos: {
        listPullRequestsAssociatedWithCommit: async () => ({
          data: [
            {
              merged_at: 'now',
              merge_commit_sha: 'main',
              base: { ref: 'main' },
              head: { ref: 'release/0.2.0', sha: 'release', repo: { full_name: 'test/repo' } },
            },
          ],
        }),
        getCommit: async ({ ref }) => {
          if (ref === 'main') return { data: { parents: [{ sha: 'old' }, { sha: 'release' }] } }
          resolved = true
          assert.equal(ref, 'refs/tags/v0.2.0')
          assert.equal(existing, true, 'never resolve an absent tag as a commit')
          if (resolveError) throw missing(resolveError)
          return { data: { sha: conflict ? 'other' : 'main' } }
        },
        getContent: async ({ path }) =>
          path === '.changeset'
            ? { data: [{ name: 'config.json' }] }
            : {
                data: {
                  content: Buffer.from(
                    path.endsWith('package.json')
                      ? JSON.stringify({ version: '0.2.0', private: true })
                      : '# App\n\n## 0.2.0\n\nRelease notes\n',
                  ).toString('base64'),
                },
              },
        getReleaseByTag: async () => {
          if (!existing) throw missing(404)
          return { data: { draft: false, html_url: 'release-url' } }
        },
        createRelease: async () => {
          writes.push(['release'])
          return { data: { html_url: 'release-url' } }
        },
        compareCommitsWithBasehead: async () => ({ data: { status: 'diverged' } }),
      },
    },
  }
  return {
    writes,
    resolved: () => resolved,
    execute: () =>
      run(
        github,
        { repo: { owner: 'test', repo: 'repo' }, sha: 'main' },
        { setOutput() {}, notice() {} },
      ),
  }
}

test('publication creates an absent tag without invoking the commit endpoint for it', async () => {
  const f = fixture()
  await f.execute()
  assert.equal(f.resolved(), false)
  assert.deepEqual(f.writes, [['tag', 'main'], ['release']])
})

test('existing tags resolve to commits; reruns are idempotent and errors never authorize overwrites', async () => {
  const f = fixture({ existing: true })
  await f.execute()
  assert.equal(f.resolved(), true)
  assert.deepEqual(f.writes, [])
  for (const options of [
    { lookupError: 403 },
    { lookupError: 422 },
    { existing: true, resolveError: 422 },
    { existing: true, resolveError: 404 },
    { existing: true, conflict: true },
  ]) {
    const failed = fixture(options)
    await assert.rejects(failed.execute())
    assert.deepEqual(failed.writes, [])
  }
})
