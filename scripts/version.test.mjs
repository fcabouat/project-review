import test from 'node:test'
import assert from 'node:assert/strict'
import {
  bump,
  currentVersion,
  manifests,
  nextVersion,
  setVersion,
  validateTag,
} from './version.mjs'

test('version increments cover patch, minor and major', () => {
  assert.equal(bump('0.2.1', 'patch'), '0.2.2')
  assert.equal(bump('0.2.1', 'minor'), '0.3.0')
  assert.equal(bump('0.2.1', 'major'), '1.0.0')
  assert.throws(() => bump('v0.2.1', 'patch'))
})

test('release and hotfix versions are computed from their configured base', () => {
  const calls = []
  const git = (...args) => {
    calls.push(args.join(' '))
    if (args[0] === 'config') return args.at(-1).endsWith('master') ? 'main' : 'develop'
    return JSON.stringify({ version: args[1].startsWith('main:') ? '1.4.2' : '0.9.8' })
  }
  assert.equal(nextVersion('release', 'minor', git), '0.10.0')
  assert.equal(nextVersion('hotfix', 'patch', git), '1.4.3')
  assert.ok(calls.includes('show develop:app/package.json'))
  assert.ok(calls.includes('show main:app/package.json'))
  assert.throws(() => nextVersion('hotfix', '1.4.2', git), /must increase/)
})

test('release start updates every manifest and commits once', () => {
  const files = new Map(
    manifests.map((path) => [path, JSON.stringify({ version: '0.2.1', private: true })]),
  )
  const commands = []
  const git = (...args) => {
    commands.push(args)
    if (args[0] === 'branch') return 'release/0.3.0'
    return ''
  }
  const read = (path) => files.get(path)
  const write = (path, value) => files.set(path, value)
  setVersion('release', 'v0.3.0', { read, write, git, stagedStatus: () => 1 })
  assert.deepEqual(
    [...files.values()].map((value) => JSON.parse(value).version),
    Array(4).fill('0.3.0'),
  )
  assert.ok(commands.some((args) => args.join(' ') === 'commit -m chore(release): v0.3.0'))
})

test('tag validation requires aligned versions, an annotated tag and current main ancestry', () => {
  const git = (...args) => {
    if (args[0] === 'cat-file') return 'tag'
    if (args[0] === 'rev-parse') return 'commit'
    if (args[0] === 'rev-list') return 'commit first-parent release-parent'
    if (args[0] === 'show') return "Merge branch 'release/0.2.2'"
    return ''
  }
  const read = () => JSON.stringify({ version: '0.2.2' })
  assert.equal(validateTag('v0.2.2', git, read), '0.2.2')
  assert.throws(() => validateTag('v0.2.3', git, read), /does not match/)
  assert.throws(() => validateTag('0.2', git, read), /Invalid/)
})

test('only the initial v0.1.0 release may use a root commit', () => {
  const fixture =
    (parents = 'root', subject = 'Initial public release v0.1.0', type = 'tag') =>
    (...args) => {
      if (args[0] === 'cat-file') return type
      if (args[0] === 'rev-parse') return 'root'
      if (args[0] === 'rev-list') return parents
      if (args[0] === 'show') return subject
      return ''
    }
  const read = () => JSON.stringify({ version: '0.1.0' })
  assert.equal(validateTag('v0.1.0', fixture(), read), '0.1.0')
  assert.throws(() => validateTag('v0.1.0', fixture('root parent'), read), /git-flow finish/)
  assert.throws(() => validateTag('v0.1.0', fixture('root', 'Other root'), read), /git-flow finish/)
  assert.throws(
    () => validateTag('v0.1.0', fixture('root', undefined, 'commit'), read),
    /annotated/,
  )
  assert.throws(
    () => validateTag('v0.1.1', fixture(), () => JSON.stringify({ version: '0.1.1' })),
    /git-flow finish/,
  )
  assert.throws(
    () =>
      validateTag(
        'v0.1.0',
        (...args) => {
          if (args[0] === 'merge-base') throw new Error('Not on main')
          return fixture()(...args)
        },
        read,
      ),
    /Not on main/,
  )
})

test('current version rejects drift between packages', () => {
  assert.equal(
    currentVersion(() => JSON.stringify({ version: '0.2.1' })),
    '0.2.1',
  )
  let index = 0
  assert.throws(
    () => currentVersion(() => JSON.stringify({ version: index++ ? '0.2.2' : '0.2.1' })),
    /not aligned/,
  )
})
