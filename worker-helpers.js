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
// For Kimi: also re-opens the corresponding Minimax item
function markChangesRequested(queueFile, itemId, feedback) {
    const queue = readQueue(queueFile);
    let prUrl = null;
    
    const updated = queue.map(item => {
        if (item.id === itemId) {
            prUrl = item.url; // Save PR URL to find Minimax item
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
    
    // If this is kimi-queue, also re-open the minimax item
    if (queueFile === KIMI_QUEUE && prUrl) {
        // Extract repo URL from PR URL
        // PR: https://github.com/user/repo/pull/123
        // Repo: https://github.com/user/repo
        const repoUrl = prUrl.replace(/\/pull\/\d+$/, '');
        
        // Find and update corresponding minimax item
        const minimaxQueue = readQueue(MINIMAX_QUEUE);
        const minimaxUpdated = minimaxQueue.map(item => {
            if (item.url === repoUrl && item.status === 'done') {
                console.log(`Re-opening Minimax item for ${repoUrl}`);
                return {
                    ...item,
                    status: 'changes_requested',
                    feedback: feedback,
                    kimi_review: feedback
                };
            }
            return item;
        });
        writeQueue(MINIMAX_QUEUE, minimaxUpdated);
    }
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

// Merge PR using gh CLI
function mergePR(prUrl) {
    const { execSync } = require('child_process');
    try {
        // Extract owner/repo and PR number from URL
        const match = prUrl.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
        if (match) {
            const repo = match[1];
            const prNumber = match[2];
            execSync(`gh pr merge ${prNumber} --squash --repo ${repo}`, { stdio: 'inherit' });
            console.log(`Merged PR: ${prUrl}`);
            return true;
        }
    } catch (e) {
        console.error('Failed to merge PR:', e.message);
        return false;
    }
}

module.exports = {
    markDone,
    markChangesRequested,
    addToKimiQueue,
    mergePR,
    MINIMAX_QUEUE,
    KIMI_QUEUE
};