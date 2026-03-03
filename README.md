# Discord Bot Webhook Server

Express server to receive Discord slash commands and trigger the dual worker workflow.

## Quick Start

1. **Get Discord credentials** from https://discord.com/developers/applications:
   - Application ID (General Information)
   - Public Key (General Information)
   - Bot Token (Bot tab → Reset Token)

2. **Create .env file**:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Install auto-start service** (runs on boot, manages ngrok):
   ```bash
   ./install-service.sh
   ```

5. **Or run manually**:
   ```bash
   ./start-bot.sh
   ```

## Commands

- `/dev <url> [task]` - Trigger worker for GitHub repo/issue/PR

## Monitoring

```bash
# View bot logs
tmux attach -t discord-bot

# View ngrok logs (shows URL)
tmux attach -t ngrok

# Ngrok web UI
open http://localhost:4040

# Check status
tmux ls
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Bot not responding | Check `launcher.log`, verify credentials in `.env` |
| Ngrok URL changed | Script auto-updates Discord on restart |
| Session died | `launchctl start com.major.discordbot` |
| Manual restart | `./stop-bot.sh && ./start-bot.sh` |

## Environment Variables

```
DISCORD_PUBLIC_KEY=your_discord_public_key_here
DISCORD_APPLICATION_ID=your_application_id_here
DISCORD_BOT_TOKEN=your_bot_token_here
WORKER_CHANNEL_ID=1478125129577009332
PORT=3002
```