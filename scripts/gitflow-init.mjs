import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, readlinkSync, symlinkSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const root = git('rev-parse', '--show-toplevel')

// AVH 1.12.3 evaluates this hyphenated key as an invalid shell variable,
// even when configured false. Its unconfigured default is already false.
const brokenKey = 'gitflow.release.finish.ff-master'
const removed = spawnSync('git', ['config', '--local', '--unset-all', brokenKey])
if (removed.status !== 0 && removed.status !== 5) {
  throw new Error(`Unable to remove the local ${brokenKey} setting`)
}
const inherited = spawnSync('git', ['config', '--show-origin', '--get-all', brokenKey], {
  encoding: 'utf8',
})
if (inherited.status === 0) {
  throw new Error(
    `Remove ${brokenKey} from its inherited/included configuration first:\n${inherited.stdout}`,
  )
}
if (inherited.status !== 1) throw new Error(`Unable to inspect ${brokenKey}`)

try {
  const version = git('flow', 'version')
  if (!version.includes('1.12.3')) throw new Error(`Expected git-flow AVH 1.12.3, found ${version}`)
} catch (error) {
  throw new Error(`git-flow AVH 1.12.3 is required (${error.message})`)
}

for (const branch of ['main', 'develop']) {
  try {
    git('show-ref', '--verify', '--quiet', `refs/heads/${branch}`)
  } catch {
    git('branch', '--track', branch, `origin/${branch}`)
  }
}

const settings = {
  'gitflow.branch.master': 'main',
  'gitflow.branch.develop': 'develop',
  'gitflow.prefix.feature': 'feature/',
  'gitflow.prefix.bugfix': 'bugfix/',
  'gitflow.prefix.release': 'release/',
  'gitflow.prefix.hotfix': 'hotfix/',
  'gitflow.prefix.support': 'support/',
  'gitflow.prefix.versiontag': 'v',
  'gitflow.origin': 'origin',
  'gitflow.feature.finish.no-ff': 'true',
  'gitflow.feature.finish.push': 'false',
  'gitflow.bugfix.finish.no-ff': 'true',
  'gitflow.bugfix.finish.push': 'false',
  'gitflow.release.finish.nobackmerge': 'true',
  'gitflow.release.finish.push': 'false',
  'gitflow.release.finish.message': 'Project Review release',
  'gitflow.hotfix.finish.nobackmerge': 'true',
  'gitflow.hotfix.finish.push': 'false',
  'gitflow.hotfix.finish.message': 'Project Review hotfix',
}
for (const [key, value] of Object.entries(settings)) git('config', '--local', key, value)

const configured = git('rev-parse', '--git-path', 'hooks')
const hooksDir = isAbsolute(configured) ? configured : resolve(root, configured)
mkdirSync(hooksDir, { recursive: true })
git('config', '--local', 'gitflow.path.hooks', configured)

const sourceDir = resolve(root, '.gitflow/hooks')
for (const name of [
  'filter-flow-release-start-version',
  'filter-flow-hotfix-start-version',
  'filter-flow-release-finish-tag-message',
  'filter-flow-hotfix-finish-tag-message',
  'gitflow-common.sh',
  'post-flow-release-start',
  'post-flow-hotfix-start',
  'pre-flow-release-finish',
  'pre-flow-hotfix-finish',
  'post-flow-release-finish',
  'post-flow-hotfix-finish',
]) {
  const destination = resolve(hooksDir, name)
  const target = relative(dirname(destination), resolve(sourceDir, name))
  if (existsSync(destination)) {
    if (lstatSync(destination).isSymbolicLink() && readlinkSync(destination) === target) continue
    throw new Error(`Refusing to replace existing hook: ${destination}`)
  }
  symlinkSync(target, destination)
}
console.log(`Gitflow configured; versioned hooks linked in ${hooksDir}`)
