#!/bin/bash
# Process queues - wrapper for cron
# Add to crontab: * * * * * /Users/majordomo/clawd/discord-bot/process-queues.sh

cd "$(dirname "$0")"
source .env 2>/dev/null || true
node process-queues.js 2>&1 | tee -a logs/queue-processor.log