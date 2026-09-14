import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const source = resolve(import.meta.dirname, '..')
const avh = process.env.GITFLOW_AVH_PATH

test('real git-flow AVH runs local feature, release and hotfix cycles', { skip: !avh }, () => {
  const root = mkdtempSync(join(tmpdir(), 'project-review-gitflow-'))
  const env = { ...process.env, PATH: `${avh}:${process.env.PATH}` }
  const run = (...args) =>
    execFileSync(args.shift(), args, { cwd: root, env, encoding: 'utf8' }).trim()
  const fails = (...args) => spawnSync(args.shift(), args, { cwd: root, env, encoding: 'utf8' })
  try {
    mkdirSync(join(root, 'scripts'), { recursive: true })
    cpSync(join(source, 'scripts/version.mjs'), join(root, 'scripts/version.mjs'))
    cpSync(join(source, 'scripts/gitflow-init.mjs'), join(root, 'scripts/gitflow-init.mjs'))
    cpSync(join(source, '.gitflow'), join(root, '.gitflow'), { recursive: true })
    for (const path of ['app', 'packages/core', 'packages/components', 'packages/infrastructure']) {
      mkdirSync(join(root, path), { recursive: true })
      writeFileSync(
        join(root, path, 'package.json'),
        `${JSON.stringify({ name: path, private: true, version: '0.2.1' }, null, 2)}\n`,
      )
    }
    writeFileSync(
      join(root, 'package.json'),
      `${JSON.stringify({ private: true, scripts: { verify: 'node -e "process.exit(process.env.FAIL_VERIFY ? 1 : 0)"', 'gitflow:init': 'node scripts/gitflow-init.mjs' } }, null, 2)}\n`,
    )
    run('git', 'init', '-b', 'main')
    run('git', 'config', 'user.name', 'Test Maintainer')
    run('git', 'config', 'user.email', 'test@example.invalid')
    run('git', 'add', '.')
    run('git', 'commit', '-m', 'initial')
    run('git', 'switch', '-c', 'develop')
    run('pnpm', 'gitflow:init')
    run('pnpm', 'gitflow:init')
    assert.equal(run('git', 'config', '--get', 'gitflow.branch.master'), 'main')
    assert.equal(run('git', 'config', '--get', 'gitflow.release.finish.nobackmerge'), 'true')
    assert.equal(run('git', 'config', '--get', 'gitflow.feature.finish.no-ff'), 'true')

    run('git', 'flow', 'feature', 'start', 'sample')
    writeFileSync(join(root, 'feature.txt'), 'feature\n')
    run('git', 'add', 'feature.txt')
    run('git', 'commit', '-m', 'feat: sample')
    run('git', 'flow', 'feature', 'finish', 'sample')
    assert.equal(
      run('git', 'rev-list', '--parents', '-n', '1', 'develop').trim().split(' ').length,
      3,
    )

    run('git', 'switch', 'main')
    run('git', 'flow', 'release', 'start', 'patch')
    assert.equal(JSON.parse(readFileSync(join(root, 'app/package.json'))).version, '0.2.2')
    const releaseHead = run('git', 'rev-parse', 'HEAD')
    const blocked = spawnSync('git', ['flow', 'release', 'finish', '0.2.2'], {
      cwd: root,
      env: { ...env, FAIL_VERIFY: '1' },
      encoding: 'utf8',
    })
    assert.notEqual(blocked.status, 0)
    assert.equal(run('git', 'branch', '--show-current'), 'release/0.2.2')
    const releaseFinish = run('git', 'flow', 'release', 'finish', '0.2.2')
    assert.match(releaseFinish, /git push --atomic origin main develop refs\/tags\/v0\.2\.2/)
    assert.equal(run('git', 'cat-file', '-t', 'v0.2.2'), 'tag')
    assert.match(
      run('git', 'for-each-ref', '--format=%(contents)', 'refs/tags/v0.2.2'),
      /Project Review v0\.2\.2/,
    )
    assert.equal(run('git', 'rev-parse', 'develop^2'), releaseHead)
    assert.equal(JSON.parse(run('git', 'show', 'main:app/package.json')).version, '0.2.2')
    assert.equal(JSON.parse(run('git', 'show', 'develop:app/package.json')).version, '0.2.2')

    run('git', 'flow', 'hotfix', 'start', 'patch')
    assert.equal(JSON.parse(readFileSync(join(root, 'app/package.json'))).version, '0.2.3')
    const hotfixFinish = run('git', 'flow', 'hotfix', 'finish', '0.2.3')
    assert.match(hotfixFinish, /git push --atomic origin main develop refs\/tags\/v0\.2\.3/)
    assert.equal(run('git', 'cat-file', '-t', 'v0.2.3'), 'tag')

    const hook = join(root, '.git/hooks/filter-flow-release-start-version')
    unlinkSync(hook)
    writeFileSync(hook, '#!/bin/sh\nexit 0\n')
    const refusal = fails('pnpm', 'gitflow:init')
    assert.notEqual(refusal.status, 0)
    assert.match(readFileSync(hook, 'utf8'), /exit 0/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
