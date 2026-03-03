require('dotenv').config();
const express = require('express');
const nacl = require('tweetnacl');
const { exec } = require('child_process');
const path = require('path');

const app = express();
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const WORKER_CHANNEL_ID = process.env.WORKER_CHANNEL_ID || '1478125129577009332';

// Verify Discord signature
function verifySignature(req) {
    const signature = req.headers['x-signature-ed25519'];
    const timestamp = req.headers['x-signature-timestamp'];
    const body = req.rawBody;

    if (!signature || !timestamp || !body) return false;

    try {
        return nacl.sign.detached.verify(
            Buffer.from(timestamp + body),
            Buffer.from(signature, 'hex'),
            Buffer.from(PUBLIC_KEY, 'hex')
        );
    } catch (e) {
        return false;
    }
}

// Register slash command
async function registerCommand() {
    const url = `https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`;
    
    const command = {
        name: 'dev',
        description: 'Trigger developer workflow for a GitHub repository',
        options: [
            {
                name: 'url',
                description: 'GitHub repository, issue, or PR URL',
                type: 3, // STRING
                required: true
            },
            {
                name: 'task',
                description: 'Optional task description',
                type: 3, // STRING
                required: false
            }
        ]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${BOT_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(command)
        });

        if (response.ok) {
            console.log('✅ Slash command /dev registered successfully');
        } else {
            console.error('❌ Failed to register command:', await response.text());
        }
    } catch (e) {
        console.error('❌ Error registering command:', e.message);
    }
}

// Handle Discord interactions
app.post('/discord/webhook', async (req, res) => {
    if (!verifySignature(req)) {
        return res.status(401).send('Invalid signature');
    }

    const { type, data, id } = req.body;

    // Handle Ping (Discord verification)
    if (type === 1) {
        return res.json({ type: 1 });
    }

    // Handle Slash Command
    if (type === 2 && data.name === 'dev') {
        const url = data.options.find(opt => opt.name === 'url')?.value;
        const task = data.options.find(opt => opt.name === 'task')?.value;

        if (!url) {
            return res.json({
                type: 4,
                data: { content: '❌ Please provide a GitHub URL' }
            });
        }

        // Validate GitHub URL
        if (!url.match(/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/i)) {
            return res.json({
                type: 4,
                data: { content: '❌ Invalid GitHub URL' }
            });
        }

        // Trigger workflow
        const triggerScript = path.join(__dirname, '..', 'workers', 'trigger-workflow.sh');
        const cmd = task 
            ? `"${triggerScript}" "${url}" "${task}"`
            : `"${triggerScript}" "${url}"`;

        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error('Trigger error:', error);
                // Send error to channel
                exec(`openclaw message send --channel discord --target ${WORKER_CHANNEL_ID} "❌ Failed to trigger workflow: ${error.message}"`);
            } else {
                console.log('Trigger output:', stdout);
            }
        });

        // Respond immediately (Discord requires response within 3 seconds)
        return res.json({
            type: 4,
            data: { 
                content: `🚀 Triggering workflow for ${url}...\nCheck <#${WORKER_CHANNEL_ID}> for progress updates.` 
            }
        });
    }

    res.status(400).send('Unknown interaction');
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`🤖 Discord bot server listening on port ${PORT}`);
    
    // Register slash command on startup
    if (APPLICATION_ID && BOT_TOKEN) {
        registerCommand();
    } else {
        console.warn('⚠️ Missing APPLICATION_ID or BOT_TOKEN - command not registered');
    }
});