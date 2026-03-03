# Worker Task Template Helpers
# Include this at the START of every worker task

## Minimax Worker Task Template

```
AT START OF TASK - Load helpers and find your work item:

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const QUEUE_DIR = path.join(process.cwd(), 'queues');
const MINIMAX_QUEUE = path.join(QUEUE_DIR, 'minimax-queue.jsonl');
const KIMI_QUEUE = path.join(QUEUE_DIR, 'kimi-queue.jsonl');

function readQueue(queueFile) {
    if (!fs.existsSync(queueFile)) return [];
    return fs.readFileSync(queueFile, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}

function writeQueue(queueFile, entries) {
    fs.writeFileSync(queueFile, entries.map(e => JSON.stringify(e)).join('\n') + '\n');
}

function markDone(queueFile, itemId, result) {
    const queue = readQueue(queueFile);
    const updated = queue.map(item => item.id === itemId ? {...item, status: 'done', completed_at: new Date().toISOString(), result} : item);
    writeQueue(queueFile, updated);
}

function addToKimiQueue(prUrl) {
    const entry = {id: uuidv4(), url: prUrl, status: 'pending', added_at: new Date().toISOString()};
    fs.appendFileSync(KIMI_QUEUE, JSON.stringify(entry) + '\n');
}

// Find your work item by URL
const queue = readQueue(MINIMAX_QUEUE);
const myItem = queue.find(item => item.url === 'REPO_URL_HERE' && item.status === 'processing');
const itemId = myItem ? myItem.id : null;

AT END OF TASK - After creating PR:
if (itemId) {
    addToKimiQueue(PR_URL_HERE);
    markDone(MINIMAX_QUEUE, itemId, PR_URL_HERE);
}
```

## Kimi Worker Task Template

```
AT START OF TASK - Load helpers:

const fs = require('fs');
const path = require('path');

const QUEUE_DIR = path.join(process.cwd(), 'queues');
const KIMI_QUEUE = path.join(QUEUE_DIR, 'kimi-queue.jsonl');
const MINIMAX_QUEUE = path.join(QUEUE_DIR, 'minimax-queue.jsonl');

function readQueue(queueFile) {
    if (!fs.existsSync(queueFile)) return [];
    return fs.readFileSync(queueFile, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}

function writeQueue(queueFile, entries) {
    fs.writeFileSync(queueFile, entries.map(e => JSON.stringify(e)).join('\n') + '\n');
}

function markDone(queueFile, itemId, result) {
    const queue = readQueue(queueFile);
    const updated = queue.map(item => item.id === itemId ? {...item, status: 'done', completed_at: new Date().toISOString(), result} : item);
    writeQueue(queueFile, updated);
}

function markChangesRequested(queueFile, itemId, feedback) {
    const queue = readQueue(queueFile);
    let prUrl = null;
    const updated = queue.map(item => {
        if (item.id === itemId) {
            prUrl = item.url;
            return {...item, status: 'changes_requested', feedback};
        }
        return item;
    });
    writeQueue(queueFile, updated);
    
    // Re-open minimax item
    if (queueFile === KIMI_QUEUE && prUrl) {
        const repoUrl = prUrl.replace(/\/pull\/\d+$/, '');
        const minimaxQueue = readQueue(MINIMAX_QUEUE);
        const minimaxUpdated = minimaxQueue.map(item => 
            item.url === repoUrl && item.status === 'done' 
                ? {...item, status: 'changes_requested', feedback} 
                : item
        );
        writeQueue(MINIMAX_QUEUE, minimaxUpdated);
    }
}

function mergePR(prUrl) {
    const {execSync} = require('child_process');
    const match = prUrl.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
    if (match) execSync(`gh pr merge ${match[2]} --squash --repo ${match[1]}`, {stdio: 'inherit'});
}

// Find your work item
const queue = readQueue(KIMI_QUEUE);
const myItem = queue.find(item => item.url === 'PR_URL_HERE' && item.status === 'processing');
const itemId = myItem ? myItem.id : null;

AT END OF TASK - After reviewing:
if (itemId) {
    if (approved) {
        mergePR(PR_URL_HERE);
        markDone(KIMI_QUEUE, itemId, "Approved and merged");
    } else {
        markChangesRequested(KIMI_QUEUE, itemId, "Feedback: ...");
    }
}
```