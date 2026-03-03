#!/bin/bash
# Immediate worker spawner - watches queue and notifies Major via Discord
# This runs in tmux and ensures Major sees requests within seconds

QUEUE_FILE="$HOME/clawd/discord-bot/queue/requests.jsonl"
LAST_CHECK=$(date +%s)
CHECK_INTERVAL=3

echo "👀 Major Worker Watcher started"
echo "   Watching: $QUEUE_FILE"
echo "   Check interval: ${CHECK_INTERVAL}s"
echo ""

# Initialize position
if [ -f "$QUEUE_FILE" ]; then
    LAST_LINES=$(wc -l < "$QUEUE_FILE" 2>/dev/null || echo 0)
else
    LAST_LINES=0
fi

while true; do
    sleep $CHECK_INTERVAL
    
    if [ ! -f "$QUEUE_FILE" ]; then
        continue
    fi
    
    CURRENT_LINES=$(wc -l < "$QUEUE_FILE" 2>/dev/null || echo 0)
    
    if [ "$CURRENT_LINES" -gt "$LAST_LINES" ]; then
        # New entries detected
        NEW_COUNT=$((CURRENT_LINES - LAST_LINES))
        
        # Extract the new entries
        tail -n "$NEW_COUNT" "$QUEUE_FILE" | while read line; do
            URL=$(echo "$line" | python3 -c "import sys, json; print(json.load(sys.stdin).get('url',''))" 2>/dev/null)
            ID=$(echo "$line" | python3 -c "import sys, json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
            
            if [ -n "$URL" ]; then
                echo ""
                echo "🚀 NEW REQUEST: $URL"
                echo "   ID: $ID"
                echo "   Time: $(date '+%H:%M:%S')"
                echo ""
                
                # Send Discord notification to Major
                openclaw message send \
                    --channel discord \
                    --target "1465906260045074659" \
                    --message "🚨 WORKER REQUEST\n\nURL: $URL\nID: $ID\n\nSpawn worker now." \
                    2>/dev/null
            fi
        done
        
        LAST_LINES=$CURRENT_LINES
    fi
done