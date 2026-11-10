# SpeechImprover

Notes for the coding agent that works on this repo.

## House standards (shared across every app by this maker)

@../CoworkSyncHub/HOUSE-STANDARDS.md

For this app:
- Check the standards: `node ../CoworkSyncHub/standards.mjs speech -v`. Keep it all `ok` before pushing.
- Test: `cd speechimprover && npm run lint && npm test && npm run audit:content && npm run build`
- Deploy: push to main: deploy.yml checks, publishes, live-checks and tags
- Work on `main`, push your own work when it passes, and add user-visible changes to `whatsnew.json`.
