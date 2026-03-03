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

// Track re-reviews separately (same ID, new spawn)
function markSpawnedWithStatus(id, status) {
    fs.appendFileSync(SPAWNED_FILE, `${id}:${status}\n`);
}

function wasSpawnedWithStatus(id, status) {
    if (!fs.existsSync(SPAWNED_FILE)) return false;
    const content = fs.readFileSync(SPAWNED_FILE, 'utf8');
    return content.includes(`${id}:${status}`);
}

// Process minimax queue
// Spawns for: pending (new work), changes_requested (need fixes)
function processMinimaxQueue() {
    const queue = readQueue(MINIMAX_QUEUE);
    let spawnedCount = 0;

    for (const item of queue) {
        // New work: pending status, never spawned
        if (item.status === 'pending' && !wasSpawnedWithStatus(item.id, 'pending')) {
            console.log(`SPAWN_MINIMAX:${item.url}:${item.id}:new`);
            markSpawnedWithStatus(item.id, 'pending');
            spawnedCount++;
        }
        // Fixes needed: changes_requested status, not yet processed for fixes
        else if (item.status === 'changes_requested' && !wasSpawnedWithStatus(item.id, 'changes_requested')) {
            console.log(`SPAWN_MINIMAX:${item.url}:${item.id}:fix`);
            markSpawnedWithStatus(item.id, 'changes_requested');
            spawnedCount++;
        }
    }

    return spawnedCount;
}

// Process kimi queue
// Spawns for: pending (new PR), pending_review (re-review after fixes)
function processKimiQueue() {
    const queue = readQueue(KIMI_QUEUE);
    let spawnedCount = 0;

    for (const item of queue) {
        // New review: pending status, never spawned
        if (item.status === 'pending' && !wasSpawnedWithStatus(item.id, 'pending')) {
            console.log(`SPAWN_KIMI:${item.url}:${item.id}:new`);
            markSpawnedWithStatus(item.id, 'pending');
            spawnedCount++;
        }
        // Re-review: pending_review status, not yet processed for re-review
        else if (item.status === 'pending_review' && !wasSpawnedWithStatus(item.id, 'pending_review')) {
            console.log(`SPAWN_KIMI:${item.url}:${item.id}:rereview`);
            markSpawnedWithStatus(item.id, 'pending_review');
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