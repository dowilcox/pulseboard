# Resume: bugfix batch (platform/API/GitLab/Docker/README)

Branch `worktree-agent-a98b12185e5c75614`, based on `feat/custom-fields-mcp-keyboard-oidc` at 7334795 (that branch has moved on since).

Tests here must be run with `-e APP_BASE_PATH=/var/www/html`, because the `vendor` symlink makes Laravel infer the wrong base path:
`docker compose -p pulseboard --profile test run --rm -e APP_BASE_PATH=/var/www/html test --filter=...`

## Status

| #                                      | Status                                                                                           | Commit  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ | ------- |
| 1 Token escalation                     | Done; TokenApiTest passes (11 tests)                                                             | a027f01 |
| 2 Public user shape in API             | Done; PublicUserSerializationTest fails before the fix and passes after; related API suites pass | 99d9900 |
| 3 User delete FKs                      | Done; migration checked on SQLite (tests) and MySQL 8.4 (up, down, up)                           | 6bab60a |
| 4 Done column / WIP limit on bulk save | Done and tested                                                                                  | f23f815 |
| 5 GitLab MR description                | Done and tested (unit and feature)                                                               | 47d8e0c |
| 6 GitLab unlink                        | Done and tested (refs deleted, also on connection delete)                                        | 0098363 |
| 7 AutoLink excludes archived boards    | Done; tests fail before the fix and pass after                                                   | 513e836 |
| 8 Templates comment and permissions    | Docs only (the admin rule is intentional)                                                        | fd15179 |
| 9 Task template label validation       | Done and tested (web and API)                                                                    | 71dd503 |
| 10 API create-template idempotent      | Done and tested                                                                                  | b44cf90 |
| 11 APP_KEY in Docker                   | Done; entrypoint fail-fast checked in a throwaway container (exit 1)                             | 64cc0f7 |
| 12 Dev Reverb port                     | Done; checked with `docker compose config` only                                                  | 12b4d7a |
| 13 README errors                       | Done (docs)                                                                                      | 04a27bb |

## Next steps

1. Run the full backend suite (not yet run after the fixes): `cd` to this worktree, then run the command above without `--filter`.
2. Run `npx tsc --noEmit` (last passed after #3) and `npm run test:run`.
3. Report back.

## Judgement calls

- #1: a token can create, or revoke, only tokens whose abilities it holds itself. A token can always revoke itself. Session requests and `*` tokens are unrestricted.
- #2: `App\Support\PublicUser::scrub()` is applied to API responses that contain users. Members are returned flat (`id, name, email, avatar_url, is_bot, role`). Membership POST/PUT responses keep the TeamMember shape with a public `user`.
- #3: `comments.user_id` is left as cascade (comment UI is out of scope).
- #4: two done columns in one payload return 422.
- #5: mentions are rendered as `@Name` as requested; GitLab may link these to a GitLab user with a matching username.
- #6: refs are cleaned up rather than kept.
- #8: documented, not changed.
- #12: the dev compose file pins the server-side `REVERB_*` values to the in-container Reverb, and the browser uses `VITE_REVERB_*`.

## New bugs noticed (not fixed)

- `app/Console/Commands/ProcessRecurringTasks.php:59`: throws when the creator is null, which can now happen after #3. The error is logged and recurrence stops for that task.
- `resources/js/Components/Tasks/ActivityFeed.tsx:1136`: entries by deleted users show as "System".
- `resources/js/types/index.d.ts:110`: pre-existing prettier drift from the custom-fields work.
