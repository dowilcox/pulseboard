# Keyboard Shortcuts

PulseBoard can be driven almost entirely from the keyboard: jump between pages, move a focus cursor across the board, and change, move or open tasks without reaching for the mouse. This guide lists every shortcut and explains how the focus cursor, the help overlay and the single-key preference work.

## Overview

- **Single keys** (`j`, `x`, `?`) work whenever you are not typing. They pause automatically while focus is in a text field, a select, the rich-text editor, or a menu, dialog or popover.
- **Modifier shortcuts** use `⌘` on macOS and `Ctrl` on Windows and Linux (shown below as **Mac** and **Windows / Linux**). The quick switcher's `⌘K` / `Ctrl+K` works even while you are typing.
- **Sequences** such as `g` then `d` are pressed one after the other, not together. The second key must follow within about a second.
- Shortcuts are **scoped**. Some work everywhere, some only on a board, and some only on an open task. When two scopes share a key, the more specific one wins (open task, then board, then everywhere). For example, `c` creates a task on a board and opens the comment box on a task page.
- Press `?` at any time to see the shortcuts available on the current page.

## Everywhere

| Action                           | Mac            | Windows / Linux   |
| -------------------------------- | -------------- | ----------------- |
| Open or close the quick switcher | `⌘` `K`        | `Ctrl` `K`        |
| Search boards, teams and tasks   | `/`            | `/`               |
| Go to dashboard                  | `g` then `d`   | `g` then `d`      |
| Go to notifications              | `g` then `n`   | `g` then `n`      |
| Go to the current team's boards¹ | `g` then `b`   | `g` then `b`      |
| Show keyboard shortcuts          | `?` or `⌘` `/` | `?` or `Ctrl` `/` |

¹ On a page that belongs to a team (a board, a task, team settings) this opens that team's page; elsewhere it opens the list of all teams.

## Board (Kanban and List views)

These work on a board page. The navigation and task shortcuts apply to the Board (Kanban) and List views; the Workload view supports the "Board" group only.

### Navigate

| Action                                   | Mac        | Windows / Linux |
| ---------------------------------------- | ---------- | --------------- |
| Next task in the column (List: next row) | `j` or `↓` | `j` or `↓`      |
| Previous task in the column (List: row)  | `k` or `↑` | `k` or `↑`      |
| Column to the left (Kanban)              | `h` or `←` | `h` or `←`      |
| Column to the right (Kanban)             | `l` or `→` | `l` or `→`      |
| Open the focused task                    | `↩` or `o` | `Enter` or `o`  |
| Clear the focused task                   | `Esc`      | `Esc`           |

### Task actions (on the focused task)

| Action                                        | Mac                 | Windows / Linux     |
| --------------------------------------------- | ------------------- | ------------------- |
| Create a task in the focused column²          | `c`                 | `c`                 |
| Mark complete / reopen                        | `x`                 | `x`                 |
| Watch / unwatch                               | `w`                 | `w`                 |
| Assignees… (searchable picker)                | `a`                 | `a`                 |
| Assign / unassign me                          | `i`                 | `i`                 |
| Labels… (searchable picker)                   | `t`                 | `t`                 |
| Priority… (picker)                            | `p`                 | `p`                 |
| Set priority: urgent, high, medium, low, none | `1` `2` `3` `4` `0` | `1` `2` `3` `4` `0` |
| Due date…                                     | `d`                 | `d`                 |

² In the Kanban view this opens the quick-add field at the top of the focused column (or the first column when nothing is focused). In the List view it opens the **New task** dialog with the focused task's column preselected. A column at its WIP limit can't take a new task; you'll see a message instead.

### Move (the focused task)

| Action                               | Mac     | Windows / Linux |
| ------------------------------------ | ------- | --------------- |
| Move to column… (searchable picker)  | `m`     | `m`             |
| Move to the previous column          | `⇧` `H` | `Shift` `H`     |
| Move to the next column              | `⇧` `L` | `Shift` `L`     |
| Move down within the column (Kanban) | `⇧` `J` | `Shift` `J`     |
| Move up within the column (Kanban)   | `⇧` `K` | `Shift` `K`     |

Keyboard moves go through the same move endpoint as drag and drop, update the board immediately, and respect WIP limits: moving into a full column is refused with a message, and full columns are disabled in the move picker. With filters active, the card moves past the cards you can see; hidden cards keep their place.

### Board

| Action                                   | Mac          | Windows / Linux |
| ---------------------------------------- | ------------ | --------------- |
| Search and filter tasks                  | `f`          | `f`             |
| Switch view (Board → List → Workload)    | `v`          | `v`             |
| Go to board settings (owners and admins) | `g` then `s` | `g` then `s`    |
| Create a task (Workload view)            | `c`          | `c`             |

## Open task

These work on a task's page.

| Action                                                   | Mac     | Windows / Linux |
| -------------------------------------------------------- | ------- | --------------- |
| Back to the board                                        | `Esc`   | `Esc`           |
| Previous task                                            | `[`     | `[`             |
| Next task                                                | `]`     | `]`             |
| Edit the description                                     | `e`     | `e`             |
| Write a comment                                          | `c`     | `c`             |
| Mark complete / reopen                                   | `x`     | `x`             |
| Watch / unwatch                                          | `w`     | `w`             |
| Save description / post comment or reply (while writing) | `⌘` `↩` | `Ctrl` `Enter`  |

`[` and `]` step through the tasks in the order the board showed them when you opened the task: the same column in the Kanban view, or the list order (including its sort and filters) in the List view. If you opened the task some other way (a link, a notification), they step through the task's column by task number. `Esc` returns to the board with the view and filters you left it with, and the focus cursor lands on the task you were viewing.

## The focus cursor

On a board, one task at a time can carry the **focus cursor**: a blue ring around the card (Kanban) or a highlighted row (List). Task shortcuts such as `x`, `a` or `m` act on that task.

- Press `j`, `k`, `h`, `l` (or the arrow keys once a task is focused) to place and move the cursor. With nothing focused, the first key lands on the first task.
- Pressing `Tab` into the board also places the cursor. The board is a single tab stop: `Tab` enters it on the focused task (or the first task) and the next `Tab` leaves it, so you don't have to tab through every card. Use the navigation keys to move between cards.
- The arrow keys only move the cursor while focus is on the board, or once a task is focused. Otherwise they keep scrolling the page as usual.
- The cursor follows the task, not its position. It survives real-time updates from other people, reloads and switching between the Board and List views. If the focused task disappears (deleted, moved away by someone else, or hidden by a filter) the cursor moves to the task that took its place in the same column, then to the nearest column with tasks.
- `Esc` clears the cursor. Clicking a card with the mouse does not move it.

### Drag and drop from the keyboard

The existing drag-and-drop keyboard support still works and doesn't clash with these shortcuts. Focus a card, press `Space` to pick it up, use the arrow keys to move it, then `Space` (or `Enter`) to drop it or `Esc` to cancel. While a card is picked up, the board shortcuts are paused. For most moves, `⇧H` / `⇧L` / `⇧J` / `⇧K` or the `m` picker are quicker.

## The help overlay

Press `?` (or `⌘/` on a Mac, `Ctrl+/` on Windows and Linux) to open the **Keyboard shortcuts** overlay. It lists only the shortcuts that are available on the current page, grouped by scope, with key labels for your platform. Press `?` again or `Esc` to close it.

You can also open it from:

- the **keyboard icon** in the top bar, next to the connection status, and
- **Keyboard shortcuts** in the account menu (your avatar, top right).

Tooltips on some buttons show their shortcut too, for example **New task (c)** and **Board settings (g then s)** on a board.

## Turning off single-key shortcuts

If single-key shortcuts get in your way (for example with speech input or some screen reader modes), switch them off with the **Single-key shortcuts** toggle at the top of the help overlay.

- The setting is stored in this browser only (local storage). Other browsers and devices keep their own setting. If the browser blocks storage, the setting lasts until you reload.
- With single keys off, shortcuts that use `⌘` / `Ctrl` keep working: the quick switcher (`⌘K` / `Ctrl+K`), the help overlay (`⌘/` / `Ctrl+/`) and submitting with `⌘↩` / `Ctrl+Enter`. `Esc` keeps working as well.
- The board goes back to its normal tab order (every card is its own tab stop), and the arrow keys no longer move a cursor.
- The help overlay still lists the single-key shortcuts, marked "(off)", so you can see what you'd get by turning them back on.

## Accessibility notes

- **Screen readers.** The focused card is announced by its full description (title, number, priority, assignees, due date and so on) when it receives focus, and carries `aria-current`. Actions that don't move focus, such as completing, assigning yourself, setting a priority or moving a card, are announced through a polite live region (for example "Moved #12 Fix login to Done"). Watching or unwatching from the board, and refused moves, also show a message on screen.
- **Not just colour.** The focus cursor is a 2px outline in the accent colour plus a raised shadow (Kanban) or a tinted row with an outline (List), so it doesn't depend on colour alone.
- **Typing is safe.** Single-key shortcuts never fire while you type in fields, selects, the rich-text editor or a menu, dialog or popover, so they don't interfere with text entry or with the built-in keyboard handling of those controls.
- **Native keys win.** `Enter` on a focused card or link follows it, and `Space` on a card picks it up for drag and drop, exactly as before.
- **Pickers.** The assignee, label, priority, due date and move pickers are small dialogs anchored to the focused card. Each opens with focus in its search field or list, is fully keyboard operable, and returns focus to the card when closed with `Esc`.
- **Keyboard layouts.** Shortcuts follow the character a key types, so they work with Dvorak, AZERTY and other layouts. On non-Latin layouts (for example Cyrillic) the letter shortcuts fall back to the physical key position. Punctuation shortcuts such as `?`, `/`, `[` and `]` work whether or not your layout needs `Shift` for them.
- **Speech input and switch access.** If single-key shortcuts conflict with your assistive technology, turn them off as described above. Every shortcut has an equivalent button or menu in the interface.
