---
---

CI-only: require explicit release preparation, bound job durations and report publication stages separately. Keep Pages deployment independent of software publication; verification and CodeQL still gate releases. Limit push-triggered CI to main and develop; work branches use PR validation to avoid duplicate runs.
