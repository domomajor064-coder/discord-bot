#!/usr/bin/env node
/**
 * Queue Spawner - Called by Major during heartbeat to spawn workers
 * Usage: node spawn-from-queue.js
 * Updates queue status after spawning
 */

const fs = require('fs');
const path = require('path');

const QUEUE_DIR = path.join(__dirname, 'queues');
const MINIMAX_QUEUE = path.join(QUEUE_DIR, 'minimax-queue.jsonl');
const KIMI_QUEUE = path.join(QUEUE_DIR, 'kimi-queue.jsonl');

// Ensure queue dir exists
if (!fs.existsSync(QUEUE_DIR)) {
    fs.mkdirSync(QUEUE_DIR, { recursive: true });
}

// Read queue
function readQueue(queueFile) {
    if (!fs.existsSync(queueFile)) return [];
    return fs.readFileSync(queueFile, 'utf8')
        .split('\n')
        .filter(l => l.trim())
        .map(l => JSON.parse(l));
}

// Write queue (update status)
function writeQueue(queueFile, entries) {
    const data = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
    fs.writeFileSync(queueFile, data);
}

// Check for items to spawn and output commands
function checkQueues() {
    const commands = [];
    
    // Check minimax queue
    const minimaxQueue = readQueue(MINIMAX_QUEUE);
    for (const item of minimaxQueue) {
        if (item.status === 'pending') {
            commands.push({
                worker: 'MINIMAX',
                url: item.url,
                id: item.id,
                type: 'new',
                reason: 'New implementation request'
            });
        } else if (item.status === 'changes_requested') {
            commands.push({
                worker: 'MINIMAX',
                url: item.url,
                id: item.id,
                type: 'fix',
                reason: 'Fix requested changes'
            });
        }
    }
    
    // Check kimi queue
    const kimiQueue = readQueue(KIMI_QUEUE);
    for (const item of kimiQueue) {
        if (item.status === 'pending') {
            commands.push({
                worker: 'KIMI',
                url: item.url,
                id: item.id,
                type: 'new',
                reason: 'New PR review'
            });
        } else if (item.status === 'pending_review') {
            commands.push({
                worker: 'KIMI',
                url: item.url,
                id: item.id,
                type: 'rereview',
                reason: 'Re-review after fixes'
            });
        }
    }
    
    return commands;
}

// Update status in queue after spawning
function markAsProcessing(queueFile, itemId) {
    const queue = readQueue(queueFile);
    const updated = queue.map(item => {
        if (item.id === itemId && (item.status === 'pending' || item.status === 'changes_requested' || item.status === 'pending_review')) {
            return { ...item, status: 'processing', started_at: new Date().toISOString() };
        }
        return item;
    });
    writeQueue(queueFile, updated);
}

// Main - output spawn commands
const commands = checkQueues();

if (commands.length === 0) {
    console.log('No workers to spawn.');
} else {
    commands.forEach(cmd => {
        console.log(`SPAWN_${cmd.worker}:${cmd.url}:${cmd.id}:${cmd.type}:${cmd.reason}`);
    });
}

module.exports = { checkQueues, markAsProcessing };