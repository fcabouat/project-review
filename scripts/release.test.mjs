import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')

test('GitHub verifies integration branches and tags but only publishes tags', () => {
  assert.match(
    ci,
    /branches: \[main, develop, 'release\/\*\*', 'hotfix\/\*\*'\]\n\s+tags: \['v\*'\]/,
  )
  assert.match(ci, /startsWith\(github\.ref, 'refs\/tags\/v'\)/)
  assert.match(ci, /node scripts\/version\.mjs validate-tag/)
  assert.doesNotMatch(ci, /prepare_release|release_pr|resume_release/)
  assert.doesNotMatch(ci, /pull-requests: write/)
  assert.equal(existsSync(new URL('../.github/workflows/release.yml', import.meta.url)), false)
  assert.equal(existsSync(new URL('../.changeset/config.json', import.meta.url)), false)
})

test('release publication is resumable and never creates Git objects', () => {
  const release = ci.split('\n  release:\n')[1]
  assert.match(release, /getReleaseByTag/)
  assert.match(release, /if \(error\.status !== 404\) throw error/)
  assert.match(release, /expected\.filter\(name => !existing\.has\(name\)\)/)
  assert.match(release, /tag === 'v0\.1\.0' \? \{body: 'Initial public release\.'\}/)
  assert.doesNotMatch(release, /createRef|createTag|pulls\.create|git push/)
})
