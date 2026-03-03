require('dotenv').config();
const express = require('express');
const nacl = require('tweetnacl');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const WORKER_CHANNEL_ID = process.env.WORKER_CHANNEL_ID || '1478125129577009332';

// Queue paths
const QUEUE_DIR = path.join(__dirname, 'queues');
const MINIMAX_QUEUE = path.join(QUEUE_DIR, 'minimax-queue.jsonl');
const KIMI_QUEUE = path.join(QUEUE_DIR, 'kimi-queue.jsonl');

// Ensure queue directory exists
if (!fs.existsSync(QUEUE_DIR)) {
    fs.mkdirSync(QUEUE_DIR, { recursive: true });
}

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

// Read queue file
function readQueue(queueFile) {
    if (!fs.existsSync(queueFile)) return [];
    const lines = fs.readFileSync(queueFile, 'utf8').split('\n').filter(l => l.trim());
    return lines.map(l => JSON.parse(l));
}

// Check if URL already exists in queue (pending or processing)
function urlExists(url, queueFile) {
    const queue = readQueue(queueFile);
    return queue.find(item => 
        item.url === url && 
        (item.status === 'pending' || item.status === 'processing')
    );
}

// Add to queue with dedup
function addToQueue(url, queueFile) {
    // Check for duplicates
    const existing = urlExists(url, queueFile);
    if (existing) {
        return { added: false, id: existing.id, status: existing.status };
    }

    // Add new entry
    const entry = {
        id: uuidv4(),
        url: url,
        status: 'pending',
        added_at: new Date().toISOString(),
        started_at: null,
        completed_at: null,
        result: null
    };
    
    fs.appendFileSync(queueFile, JSON.stringify(entry) + '\n');
    return { added: true, id: entry.id };
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
                type: 3,
                required: true
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
            console.log('✅ Slash command /dev registered');
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

    // Handle Ping
    if (type === 1) {
        return res.json({ type: 1 });
    }

    // Handle Slash Command
    if (type === 2 && data.name === 'dev') {
        const url = data.options.find(opt => opt.name === 'url')?.value;

        if (!url || !url.match(/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/i)) {
            return res.json({
                type: 4,
                data: { content: '❌ Invalid GitHub URL' }
            });
        }

        // Detect if PR or issue
        const isPR = url.includes('/pull/');
        
        if (isPR) {
            // PRs go to kimi queue
            const result = addToQueue(url, KIMI_QUEUE);
            
            if (result.added) {
                return res.json({
                    type: 4,
                    data: { 
                        content: `🚀 Queued PR review for ${url}\nID: \`${result.id}\`\nCheck <#${WORKER_CHANNEL_ID}> for updates.` 
                    }
                });
            } else {
                return res.json({
                    type: 4,
                    data: { 
                        content: `⏳ PR already ${result.status}: ${url}\nID: \`${result.id}\`` 
                    }
                });
            }
        } else {
            // Repos/issues go to minimax queue
            const result = addToQueue(url, MINIMAX_QUEUE);
            
            if (result.added) {
                return res.json({
                    type: 4,
                    data: { 
                        content: `🚀 Queued development for ${url}\nID: \`${result.id}\`\nCheck <#${WORKER_CHANNEL_ID}> for updates.` 
                    }
                });
            } else {
                return res.json({
                    type: 4,
                    data: { 
                        content: `⏳ Already ${result.status}: ${url}\nID: \`${result.id}\`` 
                    }
                });
            }
        }
    }

    res.status(400).send('Unknown interaction');
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`🤖 Bot server on port ${PORT}`);
    if (APPLICATION_ID && BOT_TOKEN) {
        registerCommand();
    }
});