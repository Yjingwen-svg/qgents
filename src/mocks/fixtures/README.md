# Mock fixtures

Mock handlers live in `src/mocks/handlers` and fixture data belongs in this
directory when a feature needs it. Components must call the same API modules
as production code; they must not import fixture data directly.

The task domain fixtures support the following scenarios through the optional
`scenario` query parameter: `QUEUED`, `PLANNING`, `RUNNING`, `WAITING_INPUT`,
`WAITING_APPROVAL`, `BLOCKED`, `FAILED`, `SUCCEEDED`, `CANCELLING`,
`CANCELLED`, and `EMPTY`.

Use `?error=FORBIDDEN` or `?error=INVALID` on a task-domain request to verify
the `403` permission and `422` validation error paths.

For example, `/api/projects/demo-project/orchestration-runs?scenario=FAILED`
loads the failed scenario. State transitions are implemented separately in
`src/mocks/task-domain/stateTransitions.ts` so they can be tested without a
browser or a page.
