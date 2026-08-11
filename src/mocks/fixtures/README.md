# Mock fixtures

Mock handlers live in `src/mocks/handlers` and fixture data belongs in this
directory when a feature needs it. Components must call the same API modules
as production code; they must not import fixture data directly.

The current foundation only exposes `GET /api/health`. Feature-specific task,
Agent, Skill, and deliverable mocks will be added with their corresponding API
contracts.
