/** Maintainer release driver. You merge the PRs; this handles the sequencing.
 * No force push, admin bypass, automatic merge, or rewrite of an existing tag.
 * State is read from GitHub on every invocation, so an interrupted run resumes.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = 'fcabouat/project-review'
const REMOTE = `https://github.com/${REPO}.git`

export async function release(io, version, { dryRun = false } = {}) {
  if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error('La version doit être une version stable x.y.z dans les cinq package.json.')
  }
  const git = (...args) => io.run('git', args).trim()
  const gh = (...args) => io.run('gh', [...args, '--repo', REPO]).trim()
  const json = (...args) => JSON.parse(gh(...args))
  const api = (path, ...args) => {
    const output = io.run('gh', ['api', `repos/${REPO}/${path}`, ...args]).trim()
    return output ? JSON.parse(output) : undefined
  }
  const tag = `v${version}`
  const source = `release/${tag}`
  const candidate = git('rev-parse', 'HEAD')
  const tree = (sha) => git('rev-parse', `${sha}^{tree}`)
  const sameTree = (a, b) => tree(a) === tree(b)
  const ancestor = (a, b) => git('merge-base', a, b) === a
  const clean = () => {
    if (git('status', '--porcelain') || git('rev-parse', 'HEAD') !== candidate) {
      throw new Error('Le dépôt local a changé. Enregistrer les modifications avant de relancer.')
    }
  }
  clean()
  if (git('branch', '--show-current') !== 'develop') {
    throw new Error('Lancer la release depuis develop, avec un arbre de travail propre.')
  }
  io.log(`${REPO} — ${tag} — candidat ${candidate.slice(0, 12)}`)
  if (dryRun) {
    io.log(
      'Plan sans accès réseau : PR → develop, CI, PR → main, CI/Pages/CodeQL, tag et release, PR de synchronisation → develop. Vous validez les merges.',
    )
    return
  }
  io.run('gh', ['auth', 'status', '--hostname', 'github.com'])
  const repo = JSON.parse(io.run('gh', ['api', `repos/${REPO}`]))
  if (!repo.permissions?.push || !repo.allow_merge_commit) {
    throw new Error(
      'Accès en écriture et merges classiques nécessaires. Aucune protection ne sera contournée.',
    )
  }
  const remoteRef = (ref) => {
    const rows = git('ls-remote', REMOTE, ref, `${ref}^{}`).split('\n').filter(Boolean)
    return (
      rows.find((row) => row.endsWith(`${ref}^{}`))?.split('\t')[0] ??
      rows.find((row) => row.endsWith(`\t${ref}`))?.split('\t')[0]
    )
  }
  const branch = (name) => {
    git('fetch', '--no-tags', REMOTE, `refs/heads/${name}`)
    return git('rev-parse', 'FETCH_HEAD')
  }
  const requireCandidate = (sha, releasedAncestor = false) => {
    if (
      (!ancestor(candidate, sha) && !(releasedAncestor && ancestor(sha, candidate))) ||
      !sameTree(candidate, sha)
    ) {
      throw new Error(
        'Contenu ou historique inattendu sur GitHub. Arrêt sans publier ni écraser : utiliser des merges classiques et relancer depuis le bon develop.',
      )
    }
  }
  const wait = async (label, read) => {
    io.log(label)
    const deadline = io.now() + 45 * 60_000
    while (io.now() < deadline) {
      const done = read()
      if (done) return done
      await io.pause(10_000)
    }
    throw new Error('Attente limitée à 45 minutes. Relancer pnpm release pour reprendre.')
  }
  const pull = async (head, base, sha, title) => {
    const pulls = json(
      'pr',
      'list',
      '--head',
      head,
      '--base',
      base,
      '--state',
      'all',
      '--limit',
      '100',
      '--json',
      'number,state,headRefOid,url',
    )
    let pr = pulls.find((p) => p.state === 'OPEN') ?? pulls.find((p) => p.headRefOid === sha)
    if (pr && (pr.headRefOid !== sha || pr.state === 'CLOSED')) {
      throw new Error(`PR modifiée ou fermée : ${pr.url}. Vérification humaine nécessaire.`)
    }
    if (!pr) {
      const url = gh(
        'pr',
        'create',
        '--head',
        head,
        '--base',
        base,
        '--title',
        title,
        '--body',
        `Publication ${tag}. Merci de choisir **Merge pull request**, pas Squash ni Rebase, pour conserver les commits distincts. La commande locale attend votre validation ; elle vérifiera ensuite la CI sur le commit intégré.`,
      )
      pr = json('pr', 'view', url, '--json', 'number,url,headRefOid,state')
    }
    await wait(`À valider avec « Merge pull request » : ${pr.url}`, () => {
      const current = json('pr', 'view', String(pr.number), '--json', 'state,headRefOid')
      if (current.headRefOid !== sha || current.state === 'CLOSED') {
        throw new Error(`PR modifiée ou refusée : ${pr.url}`)
      }
      return current.state === 'MERGED'
    })
    const merged = branch(base)
    requireCandidate(merged)
    if (!ancestor(sha, merged)) throw new Error('Le merge ne conserve pas les commits attendus.')
    return merged
  }
  const ci = async (name, sha) => {
    for (const workflow of repo.private ? ['ci.yml'] : ['ci.yml', 'codeql.yml']) {
      await wait(`CI ${workflow} sur ${name} (${sha.slice(0, 12)})…`, () => {
        if (remoteRef(`refs/heads/${name}`) !== sha)
          throw new Error(`${name} a avancé pendant la validation. Relancer après vérification.`)
        const [run] = json(
          'run',
          'list',
          '--workflow',
          workflow,
          '--branch',
          name,
          '--commit',
          sha,
          '--event',
          'push',
          '--limit',
          '1',
          '--json',
          'databaseId,status,conclusion,url',
        )
        if (!run || run.status !== 'completed') return false
        if (run.conclusion !== 'success')
          throw new Error(
            `CI non verte : ${run.url}. Corriger ou relancer ce run, puis pnpm release.`,
          )
        const { jobs } = json('run', 'view', String(run.databaseId), '--json', 'jobs')
        const required =
          workflow === 'codeql.yml'
            ? ['analyze']
            : name === 'main'
              ? ['verify', 'deploy']
              : ['verify']
        for (const job of required) {
          if (!jobs.some((j) => j.name === job && j.conclusion === 'success')) {
            throw new Error(
              `${job} doit avoir réussi, pas être ignoré : ${run.url}. Vérifier notamment PAGES_ENABLED et l’environnement github-pages.`,
            )
          }
        }
        return true
      })
    }
  }

  let develop = branch('develop')
  let main = branch('main')
  const existingTag = remoteRef(`refs/tags/${tag}`)
  // Refuse an already-used version before writing a branch or opening a PR.
  if (existingTag && (existingTag !== main || !sameTree(candidate, main))) {
    throw new Error(`${tag} existe déjà pour une autre version. Aucun tag ne sera déplacé.`)
  }
  if (existingTag && !ancestor(candidate, develop)) {
    throw new Error(
      `${tag} est déjà publié. De nouveaux commits locaux nécessitent une nouvelle version.`,
    )
  }
  if (!ancestor(main, candidate) && !(ancestor(candidate, main) && sameTree(candidate, main))) {
    throw new Error(
      'main contient des commits absents du candidat. Synchroniser develop avant cette release.',
    )
  }
  if (!ancestor(candidate, develop)) {
    if (!ancestor(develop, candidate))
      throw new Error('develop a divergé. Aucun historique ne sera écrasé.')
    const head = remoteRef(`refs/heads/${source}`)
    if (head && head !== candidate) throw new Error(`${source} existe avec un autre commit.`)
    if (!head) {
      clean()
      // One invocation only: do not rewrite the user's global credential helpers.
      git(
        '-c',
        'credential.helper=',
        '-c',
        'credential.helper=!gh auth git-credential',
        'push',
        REMOTE,
        `${candidate}:refs/heads/${source}`,
      )
    }
    develop = await pull(source, 'develop', candidate, `chore: prepare ${tag}`)
  }
  requireCandidate(develop)
  await ci('develop', develop)
  main = branch('main')
  if (!ancestor(develop, main) && !sameTree(develop, main)) {
    main = await pull('develop', 'main', develop, `release: ${tag}`)
  }
  requireCandidate(main, Boolean(existingTag))
  await ci('main', main)
  clean()
  // Pin the tag to the exact commit whose verification AND deployment passed.
  if (remoteRef('refs/heads/main') !== main) throw new Error('main a changé avant publication.')
  const beforeTag = remoteRef(`refs/tags/${tag}`)
  if (beforeTag && beforeTag !== main) throw new Error(`${tag} existe sur un autre commit.`)
  if (!beforeTag) {
    const object = api(
      'git/tags',
      '--method',
      'POST',
      '-f',
      `tag=${tag}`,
      '-f',
      `message=project-review ${tag}`,
      '-f',
      `object=${main}`,
      '-f',
      'type=commit',
    )
    api('git/refs', '--method', 'POST', '-f', `ref=refs/tags/${tag}`, '-f', `sha=${object.sha}`)
  }
  if (remoteRef(`refs/tags/${tag}`) !== main)
    throw new Error('Le tag distant ne correspond pas au commit validé.')
  const releases = json('release', 'list', '--limit', '100', '--json', 'tagName,isDraft')
  const published = releases.find((r) => r.tagName === tag)
  if (published?.isDraft)
    throw new Error('Un brouillon de release existe déjà : le vérifier et le publier manuellement.')
  if (!published)
    gh(
      'release',
      'create',
      tag,
      '--verify-tag',
      '--title',
      `project-review ${tag}`,
      '--generate-notes',
    )
  io.log(`Publié : https://github.com/${REPO}/releases/tag/${tag}`)

  develop = branch('develop')
  requireCandidate(develop)
  if (!ancestor(main, develop)) {
    develop = await pull('main', 'develop', main, `chore: sync ${tag} back to develop`)
    await ci('develop', develop)
  }
  clean()
  // Local refs are fast-forwarded only; never reset someone's local branch.
  if (!ancestor(git('rev-parse', 'main'), main))
    throw new Error(
      'main local a divergé ; publication terminée, synchronisation locale à vérifier.',
    )
  git('switch', 'main')
  git('merge', '--ff-only', main)
  git('switch', 'develop')
  git('merge', '--ff-only', develop)
  git('fetch', '--no-tags', REMOTE, `refs/tags/${tag}:refs/tags/${tag}`)
  // Delete only our exact candidate branch after its commits are on both branches.
  if (remoteRef(`refs/heads/${source}`) === candidate) {
    api(`git/refs/heads/${source}`, '--method', 'DELETE')
  }
  io.log('Terminé : main, develop et tag synchronisés. Aucune protection modifiée.')
}

function main() {
  const args = process.argv.slice(2)
  if (args.some((arg) => arg !== '--dry-run')) throw new Error('Usage : pnpm release [--dry-run]')
  const root = resolve(import.meta.dirname, '..')
  const versions = [
    '.',
    'app',
    'packages/core',
    'packages/components',
    'packages/infrastructure',
  ].map((dir) => JSON.parse(readFileSync(resolve(root, dir, 'package.json'), 'utf8')).version)
  if (new Set(versions).size !== 1)
    throw new Error('Aligner les versions des cinq package.json avant la release.')
  return release(
    {
      run(file, args) {
        const result = spawnSync(file, args, {
          cwd: root,
          encoding: 'utf8',
          timeout: 120_000,
          env: {
            ...process.env,
            GH_HOST: 'github.com',
            GH_PROMPT_DISABLED: '1',
            GIT_TERMINAL_PROMPT: '0',
          },
        })
        if (result.error || result.status !== 0) {
          throw new Error(
            `${file} ${args[0]} : ${result.error?.message ?? result.stderr.trim()}. Pré-requis : GitHub CLI installé et gh auth login effectué.`,
          )
        }
        return result.stdout
      },
      pause: (ms) => new Promise((done) => setTimeout(done, ms)),
      now: Date.now,
      log: console.log,
    },
    versions[0],
    { dryRun: args.includes('--dry-run') },
  )
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  Promise.resolve()
    .then(main)
    .catch((error) => {
      console.error(`Release arrêtée : ${error.message}`)
      process.exitCode = 1
    })
}
