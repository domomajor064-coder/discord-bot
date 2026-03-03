#!/usr/bin/env node
/**
 * Queue Processor - Monitors queue files and spawns workers
 * Called by cron every 1 minute
 */

const fs = require('fs');
const path = require('path');

const QUEUE_DIR = path.join(__dirname, 'queues');
const MINIMAX_QUEUE = path.join(QUEUE_DIR, 'minimax-queue.jsonl');
const KIMI_QUEUE = path.join(QUEUE_DIR, 'kimi-queue.jsonl');
const SPAWNED_FILE = path.join(QUEUE_DIR, '.spawned');

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

// Write queue (for status updates)
function writeQueue(queueFile, entries) {
    const data = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
    fs.writeFileSync(queueFile, data);
}

// Load already spawned items
function loadSpawned() {
    if (!fs.existsSync(SPAWNED_FILE)) return new Set();
    return new Set(fs.readFileSync(SPAWNED_FILE, 'utf8').split('\n').filter(l => l.trim()));
}

// Mark as spawned
function markSpawned(id) {
    fs.appendFileSync(SPAWNED_FILE, id + '\n');
}

// Process minimax queue
function processMinimaxQueue() {
    const queue = readQueue(MINIMAX_QUEUE);
    const spawned = loadSpawned();
    let spawnedCount = 0;

    for (const item of queue) {
        if (item.status === 'pending' && !spawned.has(item.id)) {
            console.log(`SPAWN_MINIMAX:${item.url}:${item.id}`);
            markSpawned(item.id);
            spawnedCount++;
            
            // Note: In production, this would actually spawn the worker
            // For now, we output the command for OpenClaw to capture
        }
    }

    return spawnedCount;
}

// Process kimi queue
function processKimiQueue() {
    const queue = readQueue(KIMI_QUEUE);
    const spawned = loadSpawned();
    let spawnedCount = 0;

    for (const item of queue) {
        if (item.status === 'pending' && !spawned.has(item.id)) {
            console.log(`SPAWN_KIMI:${item.url}:${item.id}`);
            markSpawned(item.id);
            spawnedCount++;
        }
    }

    return spawnedCount;
}

// Main
console.log(`[${new Date().toISOString()}] Checking queues...`);

const minimaxCount = processMinimaxQueue();
const kimiCount = processKimiQueue();

if (minimaxCount === 0 && kimiCount === 0) {
    console.log('No pending work items found.');
} else {
    console.log(`Spawned: ${minimaxCount} Minimax, ${kimiCount} Kimi`);
}