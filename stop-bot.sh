#!/bin/bash
# Stop Discord Bot

echo "🛑 Stopping Discord bot..."
tmux kill-session -t discord-bot 2>/dev/null
tmux kill-session -t ngrok 2>/dev/null
echo "✅ Bot stopped"
echo ""
echo "To restart: ~/clawd/discord-bot/start-bot.sh"