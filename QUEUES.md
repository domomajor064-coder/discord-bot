# Discord Bot with Queue System

## Architecture

Two queue files (JSONL format) with status tracking:
- `queues/minimax-queue.jsonl` — Repo/issue URLs for Minimax
- `queues/kimi-queue.jsonl` — PR URLs for Kimi

## Queue Entry Format

```json
{
  "id": "uuid",
  "url": "https://github.com/user/repo",
  "status": "pending|processing|done",
  "added_at": "2026-03-02T22:00:00Z",
  "started_at": "2026-03-02T22:01:00Z",
  "completed_at": "2026-03-02T22:05:00Z",
  "result": "pr_url or error"
}
```

## Status Flow

```
pending → processing → done
   ↓
spawn worker
```

## Deduplication

Same URL cannot be added twice while in `pending` or `processing` state.

## Cron Job

Every 1 minute:
1. Read minimax-queue
2. Find entries with `status: pending`
3. Spawn Minimax, update to `processing`
4. Read kimi-queue  
5. Find entries with `status: pending`
6. Spawn Kimi, update to `processing`

## Discord Flow

1. User: `/dev <url>`
2. Bot: Check if URL exists in queue (any status)
3. If new: Add to queue (`pending`), post "Queued" to #dev
4. If exists: Post "Already queued/processing" to #dev

## Worker Flow

**Minimax:**
1. Reads repo URL from task
2. Implements, creates PR
3. Adds PR URL to kimi-queue (`pending`)
4. Updates own entry to `done`

**Kimi:**
1. Reads PR URL from task
2. Reviews on GitHub
3. Updates own entry to `done`