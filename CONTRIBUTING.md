# Contributing

Project Review uses `develop` for integration and `main` for published versions.
Use `feature/*` or `bugfix/*` branches for ordinary work. Maintainers finish
them locally into `develop`; external contributions may instead open a pull
request against `develop`. Package versions change only on release or hotfix
branches.

## One-time Gitflow setup

Install **git-flow AVH 1.12.3**, then run this once in each clone:

```sh
pnpm gitflow:init
```

AVH 1.12.3 is the version tested by this repository. The upstream project was
archived in June 2023 and is not actively maintained. The initializer configures
`main`, `develop`, the `v` tag prefix, no automatic push, `--no-ff` feature
finishes, and release/hotfix back-merges from the delivery branch itself. It
links the versioned `.gitflow/hooks` into Git's effective hooks directory and
refuses to overwrite an existing hook.

## Everyday work

```sh
git flow feature start concise-name
# edit and commit
git flow feature finish concise-name
git push origin develop
```

`bugfix/*` follows the same integration route. When review is needed, publish
the work branch and open its pull request into `develop` instead of finishing
it locally. Do not change package versions in work pull requests.

## Releasing

Start from clean, current local `main` and `develop`. Choose the semantic impact;
the hook computes the version from `develop`, not from an arbitrary checkout:

```sh
git flow release start patch   # or minor / major
# optional stabilization commits on release/X.Y.Z
git flow release finish X.Y.Z
git push --atomic origin main develop refs/tags/vX.Y.Z
```

The post-start hook updates all four private package manifests together and
commits `chore(release): vX.Y.Z`. Before finish, another hook checks their
alignment and runs `pnpm verify`; a failed verification blocks the finish.
Gitflow then merges the release into both `main` and `develop` and creates an
annotated `Project Review vX.Y.Z` tag. The post-finish hook only prints the push
command; AVH ignores post-hook failures, so publication is always the explicit
atomic push shown above.

GitHub independently verifies `main`, `develop`, and the tag. The tag run checks
that all versions match, that the tag is annotated, and that its commit belongs
to `main`; it then creates or resumes the GitHub Release, generates its notes,
and attaches the standalone app, license notices and sample portfolios. Reruns
upload only missing assets and never replace a tag.

The initial `v0.1.0` tag is the sole bootstrap exception: it may identify the
root commit titled `Initial public release v0.1.0`. It must still be annotated,
match all package versions and belong to `main`. Subsequent releases require
the normal Gitflow finish merge.

## Hotfixes

A hotfix starts from `main`; `patch` is calculated from that branch:

```sh
git flow hotfix start patch
# edit and commit
git flow hotfix finish X.Y.Z
git push --atomic origin main develop refs/tags/vX.Y.Z
```

The same verification and publication rules apply. Resolve any active release
before finishing a colliding hotfix.

## GitHub repository settings

Keep `develop` as the default branch. Protect `main` and `develop` against force
push and deletion, but do not require pull requests or status checks that would
reject local git-flow finishes. Keep Dependabot monthly and targeting `develop`.
Protect `v*` tags against updates and deletion with a tag ruleset. Use one
CodeQL configuration only. For Pages, select GitHub Actions, set
`PAGES_ENABLED=true`, and allow `main` in the `github-pages` environment.

No PAT or GitHub App is required. `GITHUB_TOKEN` receives write permission only
inside the tag publication job. Repository settings must be changed manually;
the project scripts do not alter remote configuration.
