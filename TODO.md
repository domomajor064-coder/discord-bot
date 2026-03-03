# TODO: Worker Queue Integration

## Current Issue
Workers (Minimax/Kimi) don't automatically update queue status when they complete work.

## Current Flow (Broken)
1. Item added to queue with `status: "pending"`
2. Heartbeat spawns worker, updates to `status: "processing"`
3. **Worker finishes but doesn't update queue** ← PROBLEM
4. Queue still shows `status: "processing"`

## Needed Fix
Workers need to update queue status when they complete:

**Minimax Worker should:**
1. When PR created → update queue item to `status: "done"`
2. Add PR URL to kimi-queue with `status: "pending"`

**Kimi Worker should:**
1. After reviewing → update queue item to `status: "done"` OR `status: "changes_requested"`

## Implementation Options

### Option 1: Worker updates queue directly
Add code to worker task that updates the JSONL file after completion.

### Option 2: Worker reports completion
Worker posts completion message to Discord, heartbeat parses it and updates queue.

### Option 3: Separate completion tracker
Worker creates a `completed.jsonl` entry, another script processes it.

## Current Workaround
Manually update queue status after worker completes:
```bash
cd ~/clawd/discord-bot
node -e "update_queue_status.js"
```