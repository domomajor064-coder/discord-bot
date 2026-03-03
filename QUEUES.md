# Discord Bot Queue System

## Architecture

Two queue files (JSONL format) with status tracking:
- `queues/minimax-queue.jsonl` — Repo/issue URLs for Minimax
- `queues/kimi-queue.jsonl` — PR URLs for Kimi

## Queue Entry Format

```json
{
  "id": "uuid",
  "url": "https://github.com/user/repo",
  "status": "pending|processing|done|changes_requested|pending_review",
  "added_at": "2026-03-02T22:00:00Z",
  "started_at": null,
  "completed_at": null,
  "result": null
}
```

## Status Flow

### Initial Review Cycle
```
pending → processing → done
                    ↓
            changes_requested
                    ↓
            pending_review → processing → done
```

### Status Definitions
- `pending` — New item, waiting for worker
- `processing` — Worker currently active
- `done` — Completed successfully
- `changes_requested` — Reviewer found issues, needs fixes
- `pending_review` — Fixes made, ready for re-review

### Re-review Flow
1. **Kimi reviews** → marks `changes_requested` with feedback
2. **Minimax sees `changes_requested`** → makes fixes → marks `pending_review`
3. **Kimi sees `pending_review`** → re-reviews → marks `done` (or `changes_requested` again)

### State Transitions
| From | To | Trigger |
|------|-----|---------|
| pending | processing | Worker spawned |
| processing | done | Work completed |
| processing | changes_requested | Reviewer found issues |
| changes_requested | pending_review | Fixes pushed |
| pending_review | processing | Re-review started |
| processing | done | Re-review approved |

## Deduplication

Same URL cannot be added while status is `pending` or `processing`.

## Cron Job

Every 1 minute:
1. Read minimax-queue for `pending` or `changes_requested` items
2. Spawn Minimax worker (tracks by status to prevent duplicates)
3. Read kimi-queue for `pending` or `pending_review` items
4. Spawn Kimi reviewer (tracks by status to prevent duplicates)

## Worker Flow

**Minimax:**
1. Reads repo URL from task
2. Implements, creates PR
3. Adds PR URL to kimi-queue (`pending`)
4. Updates own entry to `done`

**Kimi:**
1. Reads PR URL from task
2. Reviews on GitHub
3. If approved → marks `done`
4. If changes needed → marks `changes_requested`