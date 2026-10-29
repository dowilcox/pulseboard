# Automation

Automation rules react to events on a board: **when** something happens (the trigger, optionally narrowed by a condition), **then** do something (the action). Each rule has exactly one trigger and one action.

## Managing rules

- Rules live in **Board settings → Automation**, so only team **admins and owners** can create, edit, enable/disable, or delete them.
- Rules apply to one board. New rules are active; use the switch to pause a rule without deleting it.
- Rules are not part of the REST API v1. The board settings page uses session-authenticated JSON routes (`/{team}/{board}/automation-rules`).

## Triggers

| Trigger (`trigger_type`) | UI label               | Fires when                                                                                                                                         | Optional condition (`trigger_config`)                                                                                                                             |
| ------------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `task_moved`             | Task moved             | A task changes column (including moves into this board from another board). Reordering within a column does not count.                             | `from_column_id`, `to_column_id`: columns on this board. Either or both.                                                                                          |
| `task_created`           | Task created           | A task is created on the board (UI, API, template, or recurring copy).                                                                             | —                                                                                                                                                                 |
| `task_completed`         | Task completed         | A task is marked complete, including by moving it into the done column.                                                                            | —                                                                                                                                                                 |
| `task_uncompleted`       | Task reopened          | A completed task is reopened, including by moving it out of the done column.                                                                       | —                                                                                                                                                                 |
| `task_assigned`          | Task assigned          | Someone is added as an assignee. Fires once per added person.                                                                                      | `user_id`: only when this team member is assigned.                                                                                                                |
| `label_added`            | Label added            | A label is added by editing the task's labels or by an `add_label` action. Fires once per added label. Labels set at creation time do not fire it. | `label_id`: only for this label.                                                                                                                                  |
| `priority_changed`       | Priority changed       | The priority field changes.                                                                                                                        | `priority`: only when the **new** priority is this value.                                                                                                         |
| `comment_added`          | Comment added          | A top-level comment is posted. Replies do not fire it.                                                                                             | —                                                                                                                                                                 |
| `due_date_reached`       | Due date reached       | The scheduled check finds the task due today or overdue. See [Due-date schedule](#due-date-schedule).                                              | —                                                                                                                                                                 |
| `gitlab_mr_merged`       | GitLab MR merged       | A merge request linked to the task becomes merged (webhook or background sync).                                                                    | —                                                                                                                                                                 |
| `gitlab_pipeline_status` | GitLab pipeline status | The pipeline status recorded for one of the task's GitLab refs changes.                                                                            | `status`: GitLab pipeline status string. The UI offers `success`, `failed` and `canceled`; the API accepts any value up to 50 characters (for example `running`). |

A trigger with no condition matches every occurrence.

## Actions

| Action (`action_type`) | UI label           | Config (`action_config`)                                                                                                      | Notes                                                                                                                                                                                       |
| ---------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `move_to_column`       | Move to column     | `column_id` (required): a column on this board                                                                                | Behaves like a normal move: WIP limits apply, moving into or out of the done column completes or reopens the task, activity is logged. Does nothing if the task is already there.           |
| `mark_complete`        | Mark as complete   | —                                                                                                                             | Does nothing if already complete. Respects the board's auto-move-to-Done setting.                                                                                                           |
| `mark_incomplete`      | Mark as incomplete | —                                                                                                                             | Does nothing if not complete.                                                                                                                                                               |
| `assign_user`          | Assign user        | `user_id` (required): a team member                                                                                           | Adds the person (existing assignees stay). Logs activity and sends the normal assignment notification.                                                                                      |
| `unassign_user`        | Unassign user      | `user_id` (required)                                                                                                          | Removes only this person if they are assigned. Logs an "unassigned" activity entry and updates other viewers live.                                                                          |
| `add_label`            | Add label          | `label_id` (required): a team label                                                                                           | Adds the label (existing labels stay) like a manual label change: logs activity, updates viewers live and fires `label_added` rules.                                                        |
| `remove_label`         | Remove label       | `label_id` (required)                                                                                                         | Removes the label like a manual label change: logs activity and updates viewers live.                                                                                                       |
| `update_field`         | Update field       | `field`: `priority`, `due_date` or `effort_estimate`; `value`: a priority value, a date (`YYYY-MM-DD`), or a whole number ≥ 0 | Logs a field change and can fire `priority_changed`. `due_date` sets a fixed date, not a relative one.                                                                                      |
| `send_notification`    | Send notification  | `target`: `assignees`, `watchers`, `creator`, or a team member's user ID; `message` (optional, up to 1,000 characters)        | In-app notification only. It is always delivered, regardless of the recipient's preferences, and is never emailed. Default message: `Automation "<rule name>" triggered on "<task title>"`. |
| `add_watcher`          | Add watcher        | `user_id` (required): a team member                                                                                           | Logs a "added … as a watcher" activity entry and updates viewers live. Does nothing if they already watch.                                                                                  |
| `remove_watcher`       | Remove watcher     | `user_id` (required)                                                                                                          | Logs a "removed … as a watcher" activity entry and updates viewers live. Does nothing if they don't watch.                                                                                  |

Referenced users must be active members of the team, and referenced columns and labels must belong to the board/team; the rule form validates this when you save. If a referenced item is later deleted, the action quietly does nothing.

## How rules run

- Rules run synchronously, right after the event that triggered them, in the same request or scheduled command.
- Every active rule on the board whose trigger and condition match runs. There is no ordering between rules.
- Every action except `send_notification` goes through the normal task code, logs activity and updates other viewers live, and can trigger further rules (for example `add_label` fires `label_added`). To prevent loops, automation chains stop at a **depth of 3**; deeper triggers are skipped and a warning is written to the log.
- If an action fails (for example, a move blocked by a WIP limit), the failure is logged as a warning and the remaining rules still run.

## Due-date schedule

The scheduler runs `automations:run-due-date` **every hour**. Each run:

1. Looks only at boards that have at least one active `due_date_reached` rule.
2. Selects tasks with a due date of today or earlier that are not completed and not in a done column.
3. Fires the trigger at most **once per task per calendar day** (app timezone, UTC by default). The de-duplication key is stored in the cache, so the cache must be shared and persistent across runs (Redis in the default setup).

Because the check repeats daily, a task that stays overdue fires the trigger again each day until it is completed or moved to a done column. Design actions accordingly (for example, `send_notification` will notify every day).

## Examples

**Move to Review when a merge request is merged**

- When: GitLab MR merged
- Then: Move to column → _In Review_

**Escalate overdue work**

- When: Due date reached
- Then: Update field → Priority → `urgent`

Combine it with a second rule "When: Priority changed to `urgent` → Then: Send notification to Assignees" to notify people when the escalation happens. (This is a chain of depth 2, within the limit.)

**Hand off for QA**

- When: Task moved, to column _QA_
- Then: Assign user → _Dana_

**Reopen on a failed pipeline**

- When: GitLab pipeline status `failed`
- Then: Mark as incomplete

**Rule JSON** (the body accepted by `POST /{team}/{board}/automation-rules`):

```json
{
    "name": "Merged MRs go to review",
    "trigger_type": "gitlab_mr_merged",
    "trigger_config": {},
    "action_type": "move_to_column",
    "action_config": { "column_id": "9d1c2f3e-0000-4000-8000-000000000000" }
}
```
