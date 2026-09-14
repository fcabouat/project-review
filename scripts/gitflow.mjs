const versionPattern = '(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)'

export function route(base, head, sameRepository, author) {
  if (base === 'develop' && /^(feature|bugfix)\/.+/.test(head)) return 'work'
  if (base === 'develop' && head.startsWith('dependabot/') && author === 'dependabot[bot]') {
    return 'dependency'
  }
  throw new Error(
    `Gitflow refuses ${head} → ${base}. Merge feature/* or bugfix/* into develop; finish release/* and hotfix/* locally with git-flow AVH.`,
  )
}

export async function checkGitflow({ github, context }) {
  const pr = context.payload.pull_request
  if (!pr) return
  route(pr.base.ref, pr.head.ref, true, pr.user.login)
  if (pr.head.repo?.full_name !== `${context.repo.owner}/${context.repo.repo}`) return
  const readVersion = async (ref) => {
    const file = await github.rest.repos.getContent({
      ...context.repo,
      path: 'app/package.json',
      ref,
    })
    return JSON.parse(Buffer.from(file.data.content, 'base64').toString()).version
  }
  const comparison = await github.rest.repos.compareCommitsWithBasehead({
    ...context.repo,
    basehead: `${pr.base.sha}...${pr.head.sha}`,
  })
  const baseVersion = await readVersion(comparison.data.merge_base_commit.sha)
  const headVersion = await readVersion(pr.head.sha)
  if (!new RegExp(`^${versionPattern}$`).test(headVersion) || headVersion !== baseVersion) {
    throw new Error('Feature, bugfix and dependency PRs must not change package versions.')
  }
}
