#!/bin/bash
# Install Discord Bot Service
# Sets up auto-start on boot with tmux sessions

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST_NAME="com.major.discordbot.plist"
PLIST_SRC="$SCRIPT_DIR/$PLIST_NAME"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"

echo "🔧 Installing Discord Bot Service..."

# Check credentials exist
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo "❌ Error: .env file not found!"
    echo ""
    echo "Create $SCRIPT_DIR/.env with your Discord credentials:"
    echo "  DISCORD_PUBLIC_KEY=your_public_key"
    echo "  DISCORD_APPLICATION_ID=your_app_id"
    echo "  DISCORD_BOT_TOKEN=your_bot_token"
    echo "  WORKER_CHANNEL_ID=1478125129577009332"
    exit 1
fi

# Copy LaunchAgent
cp "$PLIST_SRC" "$PLIST_DEST"
chmod 644 "$PLIST_DEST"

# Load and start
launchctl unload "$PLIST_DEST" 2>/dev/null
launchctl load "$PLIST_DEST"
launchctl start "$PLIST_NAME" 2>/dev/null

echo "✅ Service installed and started!"
echo ""
echo "📋 Commands:"
echo "  Start:   launchctl start $PLIST_NAME"
echo "  Stop:    launchctl stop $PLIST_NAME"
echo "  Restart: launchctl stop $PLIST_NAME && launchctl start $PLIST_NAME"
echo ""
echo "📺 View sessions:"
echo "  Bot logs:   tmux attach -t discord-bot"
echo "  Ngrok logs: tmux attach -t ngrok"
echo ""
echo "📄 Logs:"
echo "  Launcher: $SCRIPT_DIR/launcher.log"
echo "  Bot:      $SCRIPT_DIR/bot.log"
echo "  Ngrok:    $SCRIPT_DIR/ngrok.log"
echo ""
echo "🌐 Ngrok web UI: http://localhost:4040"
echo ""
echo "⚙️  To uninstall:"
echo "  launchctl unload $PLIST_DEST"
echo "  rm $PLIST_DEST"