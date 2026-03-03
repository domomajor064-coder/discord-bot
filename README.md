# Discord Bot with Queue System

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your Discord credentials

# 3. Start bot server
npm start

# 4. Add cron job for queue processing
crontab -e
# Add: * * * * * /Users/majordomo/clawd/discord-bot/process-queues.sh
```

## How It Works

1. **User types `/dev <url>`**
   - Bot detects URL type (repo/issue vs PR)
   - Adds to appropriate queue with `status: pending`
   - Deduplicates if URL already pending/processing

2. **Cron runs every 1 minute**
   - Reads `minimax-queue.jsonl` for `pending` items
   - Spawns Minimax worker
   - Reads `kimi-queue.jsonl` for `pending` items
   - Spawns Kimi reviewer

3. **Workers update queue**
   - Minimax: Changes status to `processing` → `done`
   - When PR created, adds PR URL to kimi-queue
   - Kimi: Changes status to `processing` → `done`

## Queue Files

Location: `queues/`
- `minimax-queue.jsonl` — Repo/issue URLs
- `kimi-queue.jsonl` — PR URLs

## Deduplication

Same URL cannot be added while status is `pending` or `processing`.

## Status Flow

```
pending → processing → done
```