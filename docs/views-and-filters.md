# Views, Filters and Search

## Board views

Every board has three views. Switch with the **Board / List / Workload** control in the board header. The board remembers the last view you used (per board, in your browser), and the view is part of the URL (`?view=board`, `?view=list`, `?view=workload`), so links open in the same view.

### Kanban view (Board)

- Columns in order, with drag-and-drop for cards within and between columns.
- Each column header shows the task count, or `visible of total` while a filter is active. Columns with a WIP limit show `count/limit WIP`, highlighted when at or over the limit.
- Columns can be collapsed; collapsed state is remembered per board in your browser.
- The first 20 tasks of each column load with the page and more load as needed. When a filter is active, the board fetches all of its tasks (up to 1,000) so counts and results cover the whole board.
- Cards show the task number, title, priority, labels, assignees, due date, checklist and subtask progress, comment count, GitLab project prefix, merge request number and state, and a blocked indicator.

### List view

A sortable table of every task on the board (up to 1,000). Sort by **#**, **Title**, **Status** (column), **Priority**, **Due date**, or **Assignees**. The footer shows how many tasks match the current filters.

### Workload view

Groups the board's **active** tasks (not completed and not in a done column) by assignee:

- Each person shows their task count and total effort points; tasks without an effort estimate are counted as "unestimated". A task with several assignees counts toward each of them.
- People are ordered by points, then by task count. Tasks within a person are ordered by priority, then due date, then number.
- An **Unassigned** group collects tasks with no assignee, and members with no active tasks are listed as idle.
- With an assignee filter active, only the selected people are shown.

## Filters

The filter bar above the board applies to all three views. Filtering happens in the browser.

| Filter    | Matches                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------- |
| Search    | Title contains the text (case-insensitive), or the task number when you type `12` or `#12`.             |
| Assignees | Tasks assigned to any of the selected people.                                                           |
| Labels    | Tasks with any of the selected labels.                                                                  |
| Priority  | Any of the selected priorities.                                                                         |
| Status    | Tasks in any of the selected columns.                                                                   |
| Due date  | Due date within the inclusive From/To range. Tasks without a due date are excluded once a range is set. |

Different filters combine with AND; multiple values within one filter combine with OR. Active filters are written to the URL (`q`, `assignees`, `labels`, `priority`, `columns`, `due_from`, `due_to`), so you can bookmark or share a filtered view.

### Saved filters

- **Save filter** stores the current filters under a name. Saved filters are **personal** and per board; teammates don't see yours.
- Pick a saved filter from the saved-filters menu to apply it.
- Mark one saved filter as the **default** (the star, or "Apply when I open this board" when saving). The default filter is applied automatically whenever you open the board without filters in the URL. Clearing all filters records `filter=none` in the URL, so going Back doesn't re-apply the default.
- Only one default per board per user.

## Quick switcher

Press **Ctrl+K** (**⌘K** on macOS), or **/** when you are not typing in a field, to open the quick switcher from any page.

- With an empty query it shows your **Starred** boards, **Recent** boards (remembered in your browser), and **Pages** (Dashboard, All teams, Profile, and Admin for administrators).
- As you type it matches **Boards**, **Teams** and **Pages** by name, and searches **Tasks** on the server once the query has at least 2 characters (or is a task number such as `#12`).
- Task search covers titles (substring match) and task numbers on non-archived boards of every team you belong to. Exact number matches rank first, then open tasks, then the most recently updated. Up to 10 tasks are returned.
- Use the arrow keys and Enter to open a result; Ctrl/⌘+Enter opens it in a new tab.

For the full list of keyboard shortcuts, see [Keyboard shortcuts](keyboard-shortcuts.md).

## Dashboard

The dashboard (`/dashboard`) is your personal start page. It covers active (non-archived) boards in all of your teams.

- **Stats**: your open tasks, overdue tasks, tasks due in the next 7 days, and tasks you completed in the last 7 days compared with the 7 days before. "Open" means assigned to you, not completed, and not in a done column.
- **My tasks**: up to 200 of your open tasks, ordered by due date (undated last), then priority, then most recently updated.
- **Deadlines**: your overdue tasks and tasks due in the next 14 days.
- **Your boards**: boards across your teams with total, done and open counts, your open tasks on each, and last activity. Starred boards come first, then recently visited ones.
- **Recent activity**: the latest 8 activity entries across your boards.

## Team page

Each team page (`/{team}`) lists its boards with open, overdue and completed counts and last activity, the team's members, archived boards, and team totals. It also offers **Export tasks (CSV)** to every member (see [CSV export](api.md#csv-export)).

The team page also shows an **average cycle time** stat, read from `GET /{team}/dashboard/stats`: the average number of days from creation to completion for tasks completed in the last 30 days on the team's active boards. It shows "—" when no task was completed in that window.
