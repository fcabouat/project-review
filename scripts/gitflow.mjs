/** Read-only Gitflow guard. Changesets, not this module, computes versions. */
const versionPattern = '(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)'
const delivery = new RegExp(`^(release|hotfix)/(${versionPattern})$`)

export function route(base, head, sameRepository, author) {
  if (/^feature\/.+/.test(head)) {
    if (base === 'develop') return 'feature'
    if (delivery.test(base)) return 'stabilize'
  }
  if (base === 'develop' && head.startsWith('dependabot/') && author === 'dependabot[bot]') {
    return 'dependency'
  }
  if (sameRepository && delivery.test(head)) {
    if (base === 'main') return 'ship'
    if (base === 'develop') return 'backport'
  }
  throw new Error(
    `Gitflow refuses ${head} → ${base}. Use feature/* → develop, release/* or hotfix/* → main, then the same delivery branch → develop.`,
  )
}

export async function mergedDelivery(github, repo, sha) {
  const prs = await github.rest.repos.listPullRequestsAssociatedWithCommit({
    ...repo,
    commit_sha: sha,
  })
  const pr = prs.data.find(
    (p) =>
      p.merged_at &&
      p.merge_commit_sha === sha &&
      p.base.ref === 'main' &&
      p.head.repo?.full_name === `${repo.owner}/${repo.repo}` &&
      delivery.test(p.head.ref),
  )
  const commit = await github.rest.repos.getCommit({ ...repo, ref: sha })
  if (!pr || commit.data.parents.length !== 2 || commit.data.parents[1].sha !== pr.head.sha) {
    throw new Error(
      'main must receive a release/* or hotfix/* PR using Create a merge commit, not a direct push, squash or rebase.',
    )
  }
  return pr
}

export async function checkGitflow({ github, context, core }) {
  const repo = context.repo
  const read = async (path, ref) => {
    const file = await github.rest.repos.getContent({ ...repo, path, ref })
    return Buffer.from(file.data.content, 'base64').toString()
  }
  let pr = context.payload.pull_request
  if (!pr) {
    if (context.ref !== 'refs/heads/main') return
    pr = await mergedDelivery(github, repo, context.sha)
  }
  const mode = route(
    pr.base.ref,
    pr.head.ref,
    pr.head.repo?.full_name === `${repo.owner}/${repo.repo}`,
    pr.user.login,
  )
  core.setOutput('changeset-required', mode === 'feature')
  const manifests = await Promise.all(
    ['app', 'packages/core', 'packages/components', 'packages/infrastructure'].map(async (dir) =>
      JSON.parse(await read(`${dir}/package.json`, pr.head.sha)),
    ),
  )
  const version = manifests[0].version
  if (
    !new RegExp(`^${versionPattern}$`).test(version) ||
    manifests.some((p) => p.version !== version || p.private !== true)
  ) {
    throw new Error('All four private packages must share one stable Changesets version.')
  }
  if (mode === 'feature' || mode === 'dependency') {
    const comparison = await github.rest.repos.compareCommitsWithBasehead({
      ...repo,
      basehead: `${pr.base.sha}...${pr.head.sha}`,
    })
    const baseline = JSON.parse(
      await read('app/package.json', comparison.data.merge_base_commit.sha),
    )
    if (baseline.version !== version)
      throw new Error(
        'Keep package versions unchanged on feature/dependency PRs; add a changeset instead.',
      )
    return
  }
  const expected = delivery.exec(mode === 'stabilize' ? pr.base.ref : pr.head.ref)[2]
  if (version !== expected) throw new Error('Delivery branch name must match the package version.')
  const changesets = await github.rest.repos.getContent({
    ...repo,
    path: '.changeset',
    ref: pr.head.sha,
  })
  if (changesets.data.some((f) => f.name.endsWith('.md') && f.name !== 'README.md')) {
    throw new Error('Run pnpm changeset version on the delivery branch: pending changesets remain.')
  }
  if (!(await read('app/CHANGELOG.md', pr.head.sha)).includes(`\n## ${version}\n`)) {
    throw new Error('Missing Changesets changelog for this release.')
  }
  if (mode === 'ship' && context.payload.pull_request) {
    if (pr.head.ref.startsWith('hotfix/')) {
      const comparison = await github.rest.repos.compareCommitsWithBasehead({
        ...repo,
        basehead: `${pr.base.sha}...${pr.head.sha}`,
      })
      if (comparison.data.merge_base_commit.sha !== pr.base.sha) {
        throw new Error('A hotfix must start from main and include its current changes.')
      }
    }
    const baseline = JSON.parse(await read('app/package.json', pr.base.sha))
    const next = version.split('.').map(Number)
    const previous = baseline.version.split('.').map(Number)
    const different = next.findIndex((part, i) => part !== previous[i])
    if (different < 0) {
      // Resume an untagged delivery after a failed publication, never reopen
      // a published version or bypass the original delivery's provenance.
      const original = await mergedDelivery(github, repo, pr.base.sha)
      if (original.head.ref !== pr.head.ref)
        throw new Error('Resume publication from the original delivery branch.')
      let tagged = false
      try {
        await github.rest.git.getRef({ ...repo, ref: `tags/v${version}` })
        tagged = true
      } catch (error) {
        if (error.status !== 404) throw error
      }
      if (tagged) throw new Error('This version is already tagged; prepare a new version.')
    } else if (next[different] < previous[different])
      throw new Error('Release version must increase relative to main.')
  }
  if (mode === 'backport') {
    const released = await github.rest.repos.getReleaseByTag({ ...repo, tag: `v${version}` })
    if (released.data.draft || released.data.prerelease)
      throw new Error('Publish on main before merging back into develop.')
    const comparison = await github.rest.repos.compareCommitsWithBasehead({
      ...repo,
      basehead: `${pr.head.sha}...v${version}`,
    })
    if (!['ahead', 'identical'].includes(comparison.data.status))
      throw new Error('This branch contains changes absent from the published release.')
  }
}
