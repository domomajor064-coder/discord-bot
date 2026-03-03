#!/bin/bash
# Discord Bot Launcher with Auto-Webhook Update
# Runs bot server and ngrok in tmux sessions for visibility

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGROK_LOG="/tmp/ngrok.log"

# Kill existing sessions and any stale ngrok processes
# This ensures we don't have ngrok pointing to the wrong port (e.g., 5000 instead of 3002)
tmux kill-session -t discord-bot 2>/dev/null
tmux kill-session -t ngrok 2>/dev/null
pkill -f "ngrok http" 2>/dev/null
sleep 1

# Check Discord credentials
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo "❌ Error: .env file not found"
    echo "Create $SCRIPT_DIR/.env with:"
    echo "  DISCORD_APPLICATION_ID=your_app_id"
    echo "  DISCORD_BOT_TOKEN=your_bot_token"
    exit 1
fi

source "$SCRIPT_DIR/.env"

if [ -z "$DISCORD_APPLICATION_ID" ] || [ -z "$DISCORD_BOT_TOKEN" ]; then
    echo "❌ Error: Missing DISCORD_APPLICATION_ID or DISCORD_BOT_TOKEN in .env"
    exit 1
fi

# Start the bot server in tmux
echo "🤖 Starting Discord bot server in tmux session 'discord-bot'..."
tmux new-session -d -s discord-bot "cd '$SCRIPT_DIR' && npm start 2>&1 | tee bot.log"
sleep 2

# Check if bot server started
if ! tmux ls | grep -q "discord-bot"; then
    echo "❌ Failed to start bot server. Check tmux session: tmux attach -t discord-bot"
    exit 1
fi

echo "✅ Bot server running in tmux:discord-bot (port 3002)"

# Start ngrok in tmux
echo "🌐 Starting ngrok in tmux session 'ngrok'..."
tmux new-session -d -s ngrok "ngrok http 3002 --log=stdout 2>&1 | tee ngrok.log"
sleep 2

# Wait for ngrok to establish tunnel
echo "⏳ Waiting for ngrok tunnel..."
NGROK_URL=""
for i in {1..30}; do
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*' | grep -o 'https://[^"]*' | head -1)
    if [ -n "$NGROK_URL" ]; then
        break
    fi
    sleep 1
done

if [ -z "$NGROK_URL" ]; then
    echo "❌ Failed to get ngrok URL"
    echo "   Check ngrok session: tmux attach -t ngrok"
    exit 1
fi

echo "✅ ngrok tunnel: $NGROK_URL"

# Update Discord webhook URL
WEBHOOK_URL="${NGROK_URL}/discord/webhook"
echo "🔗 Updating Discord Interactions Endpoint..."

UPDATE_RESPONSE=$(curl -s -X PATCH \
    "https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}" \
    -H "Authorization: Bot ${DISCORD_BOT_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"interactions_endpoint_url\":\"${WEBHOOK_URL}\"}")

if echo "$UPDATE_RESPONSE" | grep -q "interactions_endpoint_url"; then
    echo "✅ Discord webhook updated: $WEBHOOK_URL"
    echo ""
    echo "🎉 Bot is ready!"
    echo "   Try: /dev https://github.com/user/repo"
    echo ""
    echo "📺 Monitor sessions:"
    echo "   Bot logs:   tmux attach -t discord-bot"
    echo "   Ngrok logs: tmux attach -t ngrok"
    echo "   Ngrok URL:  http://localhost:4040"
    echo ""
    echo "🛑 Stop: ~/clawd/discord-bot/stop-bot.sh"
else
    echo "⚠️  Warning: Discord update may have failed"
    echo "   Response: $UPDATE_RESPONSE"
    echo "   You may need to manually set webhook to: $WEBHOOK_URL"
fi