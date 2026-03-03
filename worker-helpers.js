#!/usr/bin/env node
/**
 * Worker Task Helpers - Functions for workers to update queue status
 * Workers should require this module and call functions when completing work
 */

const fs = require('fs');
const path = require('path');

const QUEUE_DIR = path.join(__dirname, 'queues');
const MINIMAX_QUEUE = path.join(QUEUE_DIR, 'minimax-queue.jsonl');
const KIMI_QUEUE = path.join(QUEUE_DIR, 'kimi-queue.jsonl');

// Read queue
function readQueue(queueFile) {
    if (!fs.existsSync(queueFile)) return [];
    return fs.readFileSync(queueFile, 'utf8')
        .split('\n')
        .filter(l => l.trim())
        .map(l => JSON.parse(l));
}

// Write queue
function writeQueue(queueFile, entries) {
    const data = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
    fs.writeFileSync(queueFile, data);
}

// Mark item as done in queue
function markDone(queueFile, itemId, result) {
    const queue = readQueue(queueFile);
    const updated = queue.map(item => {
        if (item.id === itemId) {
            return { 
                ...item, 
                status: 'done', 
                completed_at: new Date().toISOString(),
                result: result
            };
        }
        return item;
    });
    writeQueue(queueFile, updated);
    console.log(`Marked ${itemId} as done`);
}

// Mark item as changes_requested
function markChangesRequested(queueFile, itemId, feedback) {
    const queue = readQueue(queueFile);
    const updated = queue.map(item => {
        if (item.id === itemId) {
            return { 
                ...item, 
                status: 'changes_requested',
                feedback: feedback
            };
        }
        return item;
    });
    writeQueue(queueFile, updated);
    console.log(`Marked ${itemId} as changes_requested`);
}

// Add PR to kimi queue (called by Minimax after creating PR)
function addToKimiQueue(prUrl) {
    const { v4: uuidv4 } = require('uuid');
    const entry = {
        id: uuidv4(),
        url: prUrl,
        status: 'pending',
        added_at: new Date().toISOString(),
        started_at: null,
        completed_at: null,
        result: null
    };
    fs.appendFileSync(KIMI_QUEUE, JSON.stringify(entry) + '\n');
    console.log(`Added PR to kimi-queue: ${prUrl}`);
    return entry.id;
}

module.exports = {
    markDone,
    markChangesRequested,
    addToKimiQueue,
    MINIMAX_QUEUE,
    KIMI_QUEUE
};