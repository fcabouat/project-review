/** Offline scenarios: simulated GitHub decisions, no network or real publication. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { release } from './release.mjs'

function fixture(options = {}) {
  const graph = { B: [], C: ['B'], D: ['B', 'C'], M: ['B', 'D'], S: ['D', 'M'], X: ['B'] }
  const contains = (a, b) => a === b || graph[b].some((parent) => contains(a, parent))
  const state = {
    main: 'B',
    develop: 'B',
    localMain: 'B',
    localDevelop: 'C',
    current: 'develop',
    tag: undefined,
    published: false,
    source: undefined,
    ...options.state,
  }
  let fetched = 'B'
  let clock = 0
  let tagObject
  const prs = []
  const calls = []
  const log = []
  const writes = []
  const io = {
    log: (message) => log.push(message),
    pause: async (ms) => {
      clock += ms
    },
    now: () => clock,
    run(file, args) {
      calls.push([file, ...args])
      const write = () => writes.push([file, ...args])
      if (file === 'git') {
        const [cmd, ...rest] = args
        if (cmd === 'status') return options.dirty ? ' M package.json' : ''
        if (cmd === 'branch') return state.current
        if (cmd === 'rev-parse') {
          const ref = rest[0]
          if (ref.endsWith('^{tree}'))
            return ref.startsWith('B^') || ref.startsWith('X^') ? 'old-tree' : 'new-tree'
          return ref === 'HEAD'
            ? state[state.current === 'main' ? 'localMain' : 'localDevelop']
            : ref === 'FETCH_HEAD'
              ? fetched
              : state.localMain
        }
        if (cmd === 'merge-base')
          return contains(rest[0], rest[1]) ? rest[0] : contains(rest[1], rest[0]) ? rest[1] : 'B'
        if (cmd === 'fetch') {
          const ref = rest.at(-1)
          if (ref.startsWith('refs/heads/')) fetched = state[ref.slice('refs/heads/'.length)]
          return ''
        }
        if (cmd === 'ls-remote') {
          const ref = rest[1]
          const sha = ref.startsWith('refs/tags/')
            ? state.tag
            : ref.includes('release/')
              ? state.source
              : state[ref.slice('refs/heads/'.length)]
          return sha ? `${sha}\t${ref}` : ''
        }
        if (args.includes('push')) {
          write()
          state.source = 'C'
          return ''
        }
        if (cmd === 'switch') {
          write()
          state.current = rest[0]
          return ''
        }
        if (cmd === 'merge') {
          write()
          state[state.current === 'main' ? 'localMain' : 'localDevelop'] = rest[1]
          return ''
        }
      }
      if (file === 'gh') {
        const [cmd, action] = args
        if (cmd === 'auth') {
          if (options.noAuth) throw new Error('auth unavailable')
          return ''
        }
        if (cmd === 'api') {
          if (action === 'repos/fcabouat/project-review')
            return JSON.stringify({
              permissions: { push: !options.noPermission },
              allow_merge_commit: true,
              private: false,
            })
          write()
          if (action.endsWith('git/tags')) {
            tagObject = state.main
            return '{"sha":"tag-object"}'
          }
          if (action.endsWith('git/refs')) {
            state.tag = tagObject
            return '{}'
          }
          if (args.includes('DELETE')) {
            state.source = undefined
            return ''
          }
        }
        if (cmd === 'pr') {
          const value = (flag) => args[args.indexOf(flag) + 1]
          if (action === 'list')
            return JSON.stringify(
              prs.filter((pr) => pr.head === value('--head') && pr.base === value('--base')),
            )
          if (action === 'create') {
            write()
            const head = value('--head')
            const base = value('--base')
            const pr = {
              number: prs.length + 1,
              head,
              base,
              state: 'OPEN',
              headRefOid: head.startsWith('release/') ? 'C' : state[head],
              url: `https://github.com/fcabouat/project-review/pull/${prs.length + 1}`,
            }
            prs.push(pr)
            return pr.url
          }
          if (action === 'view') {
            const pr = prs.find((pr) => String(pr.number) === args[2] || pr.url === args[2])
            if (args[2] === pr.url) return JSON.stringify(pr)
            if (options.prClosed) return JSON.stringify({ ...pr, state: 'CLOSED' })
            if (options.prChanged) return JSON.stringify({ ...pr, headRefOid: 'X' })
            if (options.neverMerged) return JSON.stringify(pr)
            pr.state = 'MERGED'
            state[pr.base] = pr.head.startsWith('release/') ? 'D' : pr.base === 'main' ? 'M' : 'S'
            if (options.foreignMerge) state[pr.base] = 'X'
            return JSON.stringify(pr)
          }
        }
        if (cmd === 'run' && action === 'list') {
          if (options.missingCI) return '[]'
          if (options.movingBranch) state[args[args.indexOf('--branch') + 1]] = 'X'
          return JSON.stringify([
            {
              databaseId: 1,
              status: 'completed',
              conclusion: options.failedCI ? 'failure' : 'success',
              url: 'https://github.com/run/1',
            },
          ])
        }
        if (cmd === 'run' && action === 'view')
          return JSON.stringify({
            jobs: [
              { name: 'verify', conclusion: 'success' },
              { name: 'analyze', conclusion: options.skippedAnalysis ? 'skipped' : 'success' },
              { name: 'deploy', conclusion: options.skippedDeploy ? 'skipped' : 'success' },
            ],
          })
        if (cmd === 'release' && action === 'list')
          return JSON.stringify(state.published ? [{ tagName: 'v0.1.1', isDraft: false }] : [])
        if (cmd === 'release' && action === 'create') {
          write()
          state.published = true
          return ''
        }
      }
      throw new Error(`Unexpected command: ${file} ${args.join(' ')}`)
    },
  }
  return { io, state, writes, calls, log, prs }
}

test('complete release waits for three human merges, checks CI, tags main and syncs locally', async () => {
  const f = fixture()
  await release(f.io, '0.1.1')
  assert.equal(f.prs.length, 3)
  assert.equal(f.state.published, true)
  assert.equal(f.state.tag, 'M')
  assert.equal(f.state.localMain, 'M')
  assert.equal(f.state.localDevelop, 'S')
  assert.equal(f.state.source, undefined)
  assert.equal(f.state.current, 'develop')
  assert.ok(
    !f.calls.some(
      (call) =>
        call.includes('--force') ||
        call.includes('--admin') ||
        (call[1] === 'pr' && call[2] === 'merge'),
    ),
  )
})

test('dry run is local and performs no mutations', async () => {
  const f = fixture()
  await release(f.io, '0.1.1', { dryRun: true })
  assert.equal(f.writes.length, 0)
  assert.ok(f.calls.every(([file]) => file === 'git'))
})

for (const [option, message] of [
  ['dirty', /dépôt local/],
  ['noAuth', /auth unavailable/],
  ['noPermission', /Accès/],
  ['prClosed', /PR modifiée ou refusée/],
  ['prChanged', /PR modifiée ou refusée/],
  ['neverMerged', /45 minutes/],
  ['failedCI', /CI non verte/],
  ['missingCI', /45 minutes/],
  ['skippedDeploy', /deploy doit avoir réussi/],
  ['foreignMerge', /inattendu/],
  ['movingBranch', /a avancé/],
  ['skippedAnalysis', /analyze doit avoir réussi/],
]) {
  test(`stops safely for ${option}: no tag or release`, async () => {
    const f = fixture({ [option]: true })
    await assert.rejects(release(f.io, '0.1.1'), message)
    assert.equal(f.state.tag, undefined)
    assert.equal(f.state.published, false)
  })
}

test('refuses a tag collision before any remote write', async () => {
  const f = fixture({ state: { tag: 'X' } })
  await assert.rejects(release(f.io, '0.1.1'), /existe déjà/)
  assert.equal(f.writes.length, 0)
})

test('rejects invalid versions and candidate branch collisions before remote writes', async () => {
  const f = fixture({ state: { source: 'X' } })
  await assert.rejects(release(f.io, '0.1.1'), /existe avec un autre commit/)
  for (const version of ['v0.1.1', '0.1.1;echo', '1.2', '01.2.3']) {
    await assert.rejects(release(f.io, version), /version stable/)
  }
  assert.equal(f.writes.length, 0)
})

test('relaunch between tag creation and publication reuses the immutable tag', async () => {
  const f = fixture({ state: { main: 'M', develop: 'D', tag: 'M' } })
  await release(f.io, '0.1.1')
  assert.equal(f.state.published, true)
  assert.ok(!f.writes.some((call) => call.includes('repos/fcabouat/project-review/git/tags')))
})

test('relaunch after publication resumes sync without duplicating the tag or release', async () => {
  const f = fixture({ state: { main: 'M', develop: 'D', tag: 'M', published: true } })
  await release(f.io, '0.1.1')
  assert.equal(f.prs.length, 1)
  assert.ok(
    !f.writes.some(
      (call) =>
        call.includes('repos/fcabouat/project-review/git/tags') ||
        (call[1] === 'release' && call[2] === 'create'),
    ),
  )
})

test('relaunch after completion performs no further remote writes', async () => {
  const f = fixture({
    state: {
      main: 'M',
      develop: 'S',
      localMain: 'M',
      localDevelop: 'S',
      tag: 'M',
      published: true,
    },
  })
  await release(f.io, '0.1.1')
  assert.equal(f.prs.length, 0)
  assert.ok(f.writes.every(([file]) => file === 'git'))
})
