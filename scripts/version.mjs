import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const manifests = [
  'app/package.json',
  'packages/core/package.json',
  'packages/components/package.json',
  'packages/infrastructure/package.json',
]

const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const runGit = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

export function bump(version, type) {
  if (!semver.test(version) || !['patch', 'minor', 'major'].includes(type)) {
    throw new Error(`Cannot apply ${type} to ${version}`)
  }
  const [major, minor, patch] = version.split('.').map(Number)
  if (type === 'major') return `${major + 1}.0.0`
  if (type === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

export function nextVersion(kind, requested, git = runGit) {
  if (!['release', 'hotfix'].includes(kind)) throw new Error(`Unknown delivery kind: ${kind}`)
  const baseKey = kind === 'hotfix' ? 'master' : 'develop'
  const base = git('config', '--get', `gitflow.branch.${baseKey}`)
  const current = JSON.parse(git('show', `${base}:app/package.json`)).version
  if (['patch', 'minor', 'major'].includes(requested)) return bump(current, requested)
  if (!semver.test(current) || !semver.test(requested)) {
    throw new Error('Use patch, minor, major or an explicit X.Y.Z')
  }
  const order = (version) => version.split('.').map(Number)
  const before = order(current)
  const after = order(requested)
  const increases = after.findIndex((part, index) => part !== before[index])
  if (increases < 0 || after[increases] < before[increases]) {
    throw new Error(`Version ${requested} must increase from ${current}`)
  }
  return requested
}

export function readVersions(read = readFileSync) {
  return manifests.map((path) => JSON.parse(read(path, 'utf8')).version)
}

export function currentVersion(read = readFileSync) {
  const versions = readVersions(read)
  if (!semver.test(versions[0]) || versions.some((version) => version !== versions[0])) {
    throw new Error(`Package versions are not aligned: ${versions.join(', ')}`)
  }
  return versions[0]
}

export function setVersion(
  kind,
  tag,
  {
    read = readFileSync,
    write = writeFileSync,
    git = runGit,
    stagedStatus = () => spawnSync('git', ['diff', '--cached', '--quiet']).status,
  } = {},
) {
  if (!['release', 'hotfix'].includes(kind)) throw new Error(`Unknown delivery kind: ${kind}`)
  const version = tag.replace(/^v/, '')
  if (!semver.test(version)) throw new Error(`Invalid release tag: ${tag}`)
  currentVersion(read)
  const expected = `${kind}/${version}`
  if (git('branch', '--show-current') !== expected) throw new Error(`Expected branch ${expected}`)
  for (const path of manifests) {
    const value = JSON.parse(read(path, 'utf8'))
    value.version = version
    write(path, `${JSON.stringify(value, null, 2)}\n`)
  }
  git('add', ...manifests)
  const staged = stagedStatus()
  if (staged === 1) git('commit', '-m', `chore(${kind}): v${version}`)
  else if (staged !== 0) throw new Error('Unable to inspect staged version changes')
  return version
}

export function validateTag(tag, git = runGit, read = readFileSync) {
  const version = tag.replace(/^v/, '')
  if (!semver.test(version)) throw new Error(`Invalid release tag: ${tag}`)
  const versions = readVersions(read)
  if (versions.some((candidate) => candidate !== version)) {
    throw new Error(`Tag ${tag} does not match all package versions: ${versions.join(', ')}`)
  }
  if (git('cat-file', '-t', tag) !== 'tag') throw new Error(`${tag} must be an annotated tag`)
  if (git('rev-parse', `${tag}^{}`) !== git('rev-parse', 'HEAD')) {
    throw new Error(`${tag} does not point to the checked-out commit`)
  }
  git('merge-base', '--is-ancestor', 'HEAD', 'origin/main')
  const parents = git('rev-list', '--parents', '-n', '1', 'HEAD').split(' ')
  const subject = git('show', '-s', '--format=%s', 'HEAD')
  // Bootstrap only: the first public release has no Gitflow merge parents yet.
  if (tag === 'v0.1.0' && parents.length === 1 && subject === 'Initial public release v0.1.0') {
    return version
  }
  if (
    parents.length !== 3 ||
    (!subject.includes(`'release/${version}'`) && !subject.includes(`'hotfix/${version}'`))
  ) {
    throw new Error(`${tag} must identify a local git-flow finish merge`)
  }
  return version
}

async function cli(args) {
  const [command, kind, value] = args
  if (command === 'next') process.stdout.write(`${nextVersion(kind, value)}\n`)
  else if (command === 'current') process.stdout.write(`${currentVersion()}\n`)
  else if (command === 'set') setVersion(kind, value)
  else if (command === 'validate-tag') validateTag(kind)
  else
    throw new Error(
      'Usage: version.mjs next <release|hotfix> <patch|minor|major|X.Y.Z> | current | set <release|hotfix> <vX.Y.Z> | validate-tag <vX.Y.Z>',
    )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  cli(process.argv.slice(2)).catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
