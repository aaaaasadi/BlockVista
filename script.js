/**
 * FREE DISK SPACE MANAGEMENT VISUALIZER
 * Operating Systems Educational Prototype
 *
 * Core Data Structures:
 * 1. diskBlocks: Array of Block objects { id: number, status: 'FREE' | 'ALLOCATED', next: number | null }
 * 2. bitmap: Array of 0s and 1s (0 = Free, 1 = Allocated)
 * 3. freeListHead: Number | null (Disk address of first free block in chain)
 */

// Application State
const state = {
  totalBlocks: 64,
  diskBlocks: [],        // Array of block objects
  bitmap: [],            // 0 = Free, 1 = Allocated
  freeListHead: null,    // Pointer to first free block
  selectedBlocks: new Set(), // Set of block indices selected on UI for freeing
  isDemoRunning: false,  // Demo execution lock
  demoTimeoutId: null
};

// DOM Element References
const elements = {
  // Stats
  statTotalBlocks: document.getElementById('statTotalBlocks'),
  statFreeBlocks: document.getElementById('statFreeBlocks'),
  statFreePct: document.getElementById('statFreePct'),
  statAllocBlocks: document.getElementById('statAllocBlocks'),
  statAllocPct: document.getElementById('statAllocPct'),
  pctFreeLabel: document.getElementById('pctFreeLabel'),
  distAllocatedBar: document.getElementById('distAllocatedBar'),
  distFreeBar: document.getElementById('distFreeBar'),
  statBitmapOverhead: document.getElementById('statBitmapOverhead'),
  statLLOverhead: document.getElementById('statLLOverhead'),

  // Config
  blockCountSelect: document.getElementById('blockCountSelect'),
  initModeSelect: document.getElementById('initModeSelect'),
  btnInitDisk: document.getElementById('btnInitDisk'),
  btnResetSimulation: document.getElementById('btnResetSimulation'),

  // Allocation
  allocCountInput: document.getElementById('allocCountInput'),
  btnAllocate: document.getElementById('btnAllocate'),
  allocFeedback: document.getElementById('allocFeedback'),

  // Deallocation
  freeBlocksInput: document.getElementById('freeBlocksInput'),
  btnFreeBlocks: document.getElementById('btnFreeBlocks'),
  freeFeedback: document.getElementById('freeFeedback'),
  selectedCountBadge: document.getElementById('selectedCountBadge'),
  btnClearSelection: document.getElementById('btnClearSelection'),
  btnSelectAllAlloc: document.getElementById('btnSelectAllAlloc'),

  // Visualizers
  diskGrid: document.getElementById('diskGrid'),
  bitmapVisual: document.getElementById('bitmapVisual'),
  bitmapByteSummary: document.getElementById('bitmapByteSummary'),
  bitmapRamBadge: document.getElementById('bitmapRamBadge'),
  linkedListVisual: document.getElementById('linkedListVisual'),
  llNodeCountBadge: document.getElementById('llNodeCountBadge'),

  // Logs
  simulationLog: document.getElementById('simulationLog'),
  btnClearLog: document.getElementById('btnClearLog'),

  // Demo & Tour
  btnRunDemo: document.getElementById('btnRunDemo'),
  btnQuickTour: document.getElementById('btnQuickTour'),
  demoBanner: document.getElementById('demoBanner'),
  demoStepText: document.getElementById('demoStepText'),
  demoStepCounter: document.getElementById('demoStepCounter'),
  btnStopDemo: document.getElementById('btnStopDemo'),
  guideModal: document.getElementById('guideModal'),
  btnCloseGuide: document.getElementById('btnCloseGuide'),
  btnCloseGuideBtn: document.getElementById('btnCloseGuideBtn'),
  btnStartDemoFromModal: document.getElementById('btnStartDemoFromModal'),
  themeToggle: document.getElementById('themeToggle'),
  blockTooltip: document.getElementById('blockTooltip')
};

// ==========================================
// 1. DISK INITIALIZATION & STATE MANAGEMENT
// ==========================================

/**
 * Initializes the disk with a specified number of blocks and an initial distribution mode.
 * @param {number} totalCount - 32, 64, 100, or 128
 * @param {string} mode - 'random', 'mostly_free', 'mostly_allocated', 'alternating', 'all_free'
 */
function initializeDisk(totalCount = 64, mode = 'random') {
  state.totalBlocks = totalCount;
  state.diskBlocks = [];
  state.bitmap = [];
  state.selectedBlocks.clear();

  // Create disk block array based on distribution strategy
  for (let i = 0; i < totalCount; i++) {
    let isAllocated = false;

    if (mode === 'random') {
      isAllocated = Math.random() < 0.5;
    } else if (mode === 'mostly_free') {
      isAllocated = Math.random() < 0.15; // 85% free
    } else if (mode === 'mostly_allocated') {
      isAllocated = Math.random() < 0.85; // 85% allocated
    } else if (mode === 'alternating') {
      isAllocated = i % 2 !== 0;
    } else if (mode === 'all_free') {
      isAllocated = false;
    }

    state.diskBlocks.push({
      id: i,
      status: isAllocated ? 'ALLOCATED' : 'FREE',
      next: null // Will be chained in updateFreeList()
    });

    state.bitmap.push(isAllocated ? 1 : 0);
  }

  // Build Free Block Linked List Chain
  updateFreeList();

  // Synchronize All Visuals & Statistics
  renderDisk();
  renderBitmap();
  renderLinkedList();
  updateStatistics();
  updateSelectionUI();

  addLog('init', `Disk initialized with ${totalCount} blocks (${mode.replace('_', ' ')} mode).`);
}

/**
 * Resets the entire simulation to default initial state.
 */
function resetSimulation() {
  const count = parseInt(elements.blockCountSelect.value, 10) || 64;
  const mode = elements.initModeSelect.value || 'random';
  initializeDisk(count, mode);
  showFeedback(elements.allocFeedback, '', '');
  showFeedback(elements.freeFeedback, '', '');
  addLog('system', 'Simulation reset to baseline configuration.');
}

// ==========================================
// 2. ALLOCATION LOGIC (Kernel Space Search)
// ==========================================

/**
 * Allocates 'count' free blocks.
 * Employs Bitmap scan or Linked List pop logic and keeps both structures fully synchronized.
 * @param {number} count - Number of blocks requested
 * @returns {Array<number>} List of allocated block IDs
 */
function allocateBlocks(count) {
  if (count <= 0 || isNaN(count)) {
    showFeedback(elements.allocFeedback, 'Please enter a valid positive number of blocks.', 'error');
    return [];
  }

  // Count available free blocks
  const freeBlockIds = state.diskBlocks
    .filter(b => b.status === 'FREE')
    .map(b => b.id);

  if (freeBlockIds.length < count) {
    const errorMsg = `Insufficient free space! Requested ${count} blocks, but only ${freeBlockIds.length} blocks are free.`;
    showFeedback(elements.allocFeedback, errorMsg, 'error');
    addLog('alloc', `Allocation FAILED: ${errorMsg}`);
    return [];
  }

  // Allocate the first 'count' free blocks (First-Fit from free list)
  const allocatedIds = freeBlockIds.slice(0, count);

  allocatedIds.forEach(id => {
    state.diskBlocks[id].status = 'ALLOCATED';
    state.diskBlocks[id].next = null;
    state.bitmap[id] = 1; // 1 = Allocated
    state.selectedBlocks.delete(id);
  });

  // Re-link remaining free blocks
  updateFreeList();

  // Update UI and trigger animations
  renderDisk(allocatedIds, 'highlight-alloc');
  renderBitmap(allocatedIds);
  renderLinkedList();
  updateStatistics();
  updateSelectionUI();

  const successMsg = `Successfully allocated ${count} block(s): [${allocatedIds.join(', ')}]`;
  showFeedback(elements.allocFeedback, successMsg, 'success');
  addLog('alloc', `Allocated ${count} block(s): ${allocatedIds.join(', ')}`);

  return allocatedIds;
}

// ==========================================
// 3. DEALLOCATION LOGIC (Freeing Blocks)
// ==========================================

/**
 * Frees a list of block IDs, returning them to the free space pool.
 * @param {Array<number>} blockIds - Array of block IDs to release
 */
function freeBlocks(blockIds) {
  if (!blockIds || blockIds.length === 0) {
    showFeedback(elements.freeFeedback, 'No blocks selected or entered to free.', 'error');
    return;
  }

  // Filter valid allocated blocks
  const validToFree = [];
  const alreadyFree = [];
  const outOfRange = [];

  blockIds.forEach(id => {
    if (id < 0 || id >= state.totalBlocks) {
      outOfRange.push(id);
    } else if (state.diskBlocks[id].status === 'FREE') {
      alreadyFree.push(id);
    } else {
      validToFree.push(id);
    }
  });

  if (validToFree.length === 0) {
    let msg = 'No allocated blocks were freed.';
    if (alreadyFree.length > 0) msg += ` Block(s) [${alreadyFree.join(', ')}] are already FREE.`;
    if (outOfRange.length > 0) msg += ` Block(s) [${outOfRange.join(', ')}] are out of disk range.`;
    showFeedback(elements.freeFeedback, msg, 'error');
    return;
  }

  // Free the valid blocks
  validToFree.forEach(id => {
    state.diskBlocks[id].status = 'FREE';
    state.bitmap[id] = 0; // 0 = Free
    state.selectedBlocks.delete(id);
  });

  // In OS Free List semantics, freed blocks are prepended to HEAD (O(1) release)
  updateFreeList();

  // Update UI
  renderDisk(validToFree, 'highlight-free');
  renderBitmap(validToFree);
  renderLinkedList();
  updateStatistics();
  updateSelectionUI();

  elements.freeBlocksInput.value = '';

  let feedback = `Freed ${validToFree.length} block(s): [${validToFree.join(', ')}]`;
  if (alreadyFree.length > 0) {
    feedback += ` (${alreadyFree.length} already free skipped)`;
  }
  showFeedback(elements.freeFeedback, feedback, 'success');
  addLog('free', `Freed ${validToFree.length} block(s): ${validToFree.join(', ')}`);
}

/**
 * Parses user string input like "2, 4, 7-10, 15" into an array of integer block IDs.
 * @param {string} inputStr
 * @returns {Array<number>}
 */
function parseBlockRangeInput(inputStr) {
  if (!inputStr || !inputStr.trim()) return [];
  const parts = inputStr.split(',').map(s => s.trim()).filter(Boolean);
  const result = new Set();

  parts.forEach(part => {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map(s => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.min(start, end);
        const max = Math.max(start, end);
        for (let i = min; i <= max; i++) {
          result.add(i);
        }
      }
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num)) {
        result.add(num);
      }
    }
  });

  return Array.from(result);
}

// ==========================================
// 4. DATA STRUCTURE SYNCHRONIZATION
// ==========================================

/**
 * Updates the Bitmap array from the current disk blocks.
 */
function updateBitmap() {
  state.bitmap = state.diskBlocks.map(b => (b.status === 'ALLOCATED' ? 1 : 0));
}

/**
 * Updates the Free Block Linked List pointers.
 * Connects all FREE blocks in a chain: HEAD -> BlockA -> BlockB -> ... -> NULL
 */
function updateFreeList() {
  const freeBlocks = state.diskBlocks.filter(b => b.status === 'FREE');

  if (freeBlocks.length === 0) {
    state.freeListHead = null;
    return;
  }

  state.freeListHead = freeBlocks[0].id;

  for (let i = 0; i < freeBlocks.length; i++) {
    const currentBlock = freeBlocks[i];
    if (i < freeBlocks.length - 1) {
      currentBlock.next = freeBlocks[i + 1].id;
    } else {
      currentBlock.next = null; // End of chain
    }
  }
}

/**
 * Updates all real-time counters, percentages, and progress bars.
 */
function updateStatistics() {
  const total = state.totalBlocks;
  const freeCount = state.diskBlocks.filter(b => b.status === 'FREE').length;
  const allocCount = total - freeCount;

  const freePct = total > 0 ? ((freeCount / total) * 100).toFixed(1) : 0;
  const allocPct = total > 0 ? ((allocCount / total) * 100).toFixed(1) : 0;

  // DOM Stats
  elements.statTotalBlocks.textContent = total;
  elements.statFreeBlocks.textContent = freeCount;
  elements.statFreePct.textContent = `(${freePct}%)`;
  elements.statAllocBlocks.textContent = allocCount;
  elements.statAllocPct.textContent = `(${allocPct}%)`;
  elements.pctFreeLabel.textContent = `${freePct}%`;

  // Distribution bar widths
  elements.distAllocatedBar.style.width = `${allocPct}%`;
  elements.distFreeBar.style.width = `${freePct}%`;

  // Memory Overhead Calculation
  // Bitmap: TotalBlocks / 8 bytes
  const bitmapBytes = Math.ceil(total / 8);
  elements.statBitmapOverhead.textContent = `${bitmapBytes} Byte${bitmapBytes > 1 ? 's' : ''}`;
  elements.bitmapRamBadge.textContent = `RAM: ${bitmapBytes} Byte${bitmapBytes > 1 ? 's' : ''}`;

  // Linked List: 0 RAM overhead in main memory (except 4-byte head pointer)
  elements.statLLOverhead.textContent = `4 Bytes (HEAD)`;
  elements.llNodeCountBadge.textContent = `Free Nodes: ${freeCount}`;
}

// ==========================================
// 5. RENDERING VISUALIZATIONS
// ==========================================

/**
 * Renders the interactive physical disk block grid.
 * @param {Array<number>} highlightedIds - Optional block IDs to pulse-animate
 * @param {string} animationClass - 'highlight-alloc' or 'highlight-free'
 */
function renderDisk(highlightedIds = [], animationClass = '') {
  elements.diskGrid.innerHTML = '';

  state.diskBlocks.forEach(block => {
    const blockEl = document.createElement('div');
    const isFree = block.status === 'FREE';
    const isSelected = state.selectedBlocks.has(block.id);

    blockEl.className = `disk-block ${isFree ? 'state-free' : 'state-alloc'}`;
    if (isSelected) blockEl.classList.add('selected');

    if (highlightedIds.includes(block.id) && animationClass) {
      blockEl.classList.add(animationClass);
    }

    blockEl.setAttribute('data-id', block.id);
    blockEl.setAttribute('role', 'gridcell');
    blockEl.setAttribute('aria-label', `Block ${block.id}: ${block.status}`);

    blockEl.innerHTML = `
      <span class="block-num">${block.id}</span>
      <span class="block-state-badge">${isFree ? '0' : '1'}</span>
    `;

    // Click handler for toggling selection for freeing
    blockEl.addEventListener('click', () => handleBlockClick(block.id));

    // Hover tooltip
    blockEl.addEventListener('mouseenter', (e) => showTooltip(e, block));
    blockEl.addEventListener('mouseleave', hideTooltip);

    elements.diskGrid.appendChild(blockEl);
  });
}

/**
 * Renders the 1-bit per block Bitmap data structure.
 * @param {Array<number>} pulseIds - Indices of flipped bits to animate
 */
function renderBitmap(pulseIds = []) {
  elements.bitmapVisual.innerHTML = '';
  elements.bitmapByteSummary.innerHTML = '';

  state.bitmap.forEach((bit, idx) => {
    const colEl = document.createElement('div');
    colEl.className = 'bitmap-col';

    const bitEl = document.createElement('div');
    bitEl.className = `bitmap-bit bit-${bit}`;
    bitEl.textContent = bit;

    if (pulseIds.includes(idx)) {
      bitEl.classList.add('bit-pulse');
    }

    colEl.innerHTML = `<span class="bitmap-idx">${idx}</span>`;
    colEl.appendChild(bitEl);
    elements.bitmapVisual.appendChild(colEl);
  });

  // Render Byte-level Hex Representation (Real OS Byte View)
  const byteCount = Math.ceil(state.totalBlocks / 8);
  for (let b = 0; b < byteCount; b++) {
    const byteBits = state.bitmap.slice(b * 8, b * 8 + 8);
    // Pad to 8 bits if last byte is partial
    while (byteBits.length < 8) byteBits.push(0);

    const binaryStr = byteBits.join('');
    const hexVal = parseInt(binaryStr, 2).toString(16).toUpperCase().padStart(2, '0');

    const byteCard = document.createElement('div');
    byteCard.className = 'byte-card';
    byteCard.innerHTML = `
      <span class="byte-title">Byte ${b} (Blks ${b * 8}-${Math.min((b + 1) * 8 - 1, state.totalBlocks - 1)})</span>
      <span class="byte-hex">0x${hexVal} (${binaryStr})</span>
    `;
    elements.bitmapByteSummary.appendChild(byteCard);
  }
}

/**
 * Renders the Free Block Linked List chain with HEAD and NULL nodes.
 */
function renderLinkedList() {
  elements.linkedListVisual.innerHTML = '';

  const freeBlocks = state.diskBlocks.filter(b => b.status === 'FREE');

  // 1. HEAD Node
  const headEl = document.createElement('div');
  headEl.className = 'll-head-node';
  headEl.innerHTML = `
    <span class="ll-head-label">SUPERBLOCK</span>
    <span>HEAD: ${state.freeListHead !== null ? `[${state.freeListHead}]` : 'NULL'}</span>
  `;
  elements.linkedListVisual.appendChild(headEl);

  if (freeBlocks.length === 0) {
    // Empty list
    const arrow = createArrowElement();
    elements.linkedListVisual.appendChild(arrow);

    const nullNode = document.createElement('div');
    nullNode.className = 'll-null-node';
    nullNode.textContent = 'NULL (Disk Full)';
    elements.linkedListVisual.appendChild(nullNode);
    return;
  }

  // 2. Chain Nodes
  freeBlocks.forEach((block) => {
    const arrow = createArrowElement();
    elements.linkedListVisual.appendChild(arrow);

    const nodeEl = document.createElement('div');
    nodeEl.className = 'll-block-node';
    nodeEl.innerHTML = `
      <div class="ll-node-id">
        <span class="ll-node-id-sub">BLOCK</span>
        <span>${block.id}</span>
      </div>
      <div class="ll-node-ptr">
        <span class="ll-node-ptr-sub">NEXT</span>
        <span>${block.next !== null ? block.next : 'NULL'}</span>
      </div>
    `;
    elements.linkedListVisual.appendChild(nodeEl);
  });

  // 3. Final Arrow to NULL
  const finalArrow = createArrowElement();
  elements.linkedListVisual.appendChild(finalArrow);

  const nullNode = document.createElement('div');
  nullNode.className = 'll-null-node';
  nullNode.textContent = 'NULL';
  elements.linkedListVisual.appendChild(nullNode);
}

function createArrowElement() {
  const arrow = document.createElement('div');
  arrow.className = 'll-arrow';
  arrow.innerHTML = '→';
  return arrow;
}

// ==========================================
// 6. SELECTION & USER INTERACTION
// ==========================================

function handleBlockClick(blockId) {
  const block = state.diskBlocks[blockId];
  if (!block) return;

  if (block.status === 'ALLOCATED') {
    if (state.selectedBlocks.has(blockId)) {
      state.selectedBlocks.delete(blockId);
    } else {
      state.selectedBlocks.add(blockId);
    }
  } else {
    // If user clicks a free block, offer quick allocation feedback
    showFeedback(elements.freeFeedback, `Block ${blockId} is already FREE (bit = 0). Click allocated (red) blocks to select for freeing.`, 'info');
  }

  updateSelectionUI();
  renderDisk();
}

function updateSelectionUI() {
  const count = state.selectedBlocks.size;
  elements.selectedCountBadge.textContent = `${count} allocated block${count === 1 ? '' : 's'} selected on grid`;

  // Update input text with selected IDs
  if (count > 0) {
    const sorted = Array.from(state.selectedBlocks).sort((a, b) => a - b);
    elements.freeBlocksInput.value = sorted.join(', ');
  } else {
    elements.freeBlocksInput.value = '';
  }
}

function showFeedback(el, msg, type) {
  if (!msg) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.className = `feedback-msg ${type}`;
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ==========================================
// 7. TOOLTIP LOGIC
// ==========================================

function showTooltip(e, block) {
  const tooltip = elements.blockTooltip;
  const isFree = block.status === 'FREE';

  tooltip.innerHTML = `
    <div><strong>Block #${block.id}</strong></div>
    <div>Status: <span style="color:${isFree ? 'var(--color-free)' : 'var(--color-alloc)'}">${block.status}</span></div>
    <div>Bitmap Bit: <strong>${isFree ? '0' : '1'}</strong></div>
    <div>Linked List Next: <strong>${isFree ? (block.next !== null ? block.next : 'NULL') : 'N/A (In Use)'}</strong></div>
  `;

  tooltip.classList.remove('hidden');

  const x = e.clientX + 12;
  const y = e.clientY + 12;
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function hideTooltip() {
  elements.blockTooltip.classList.add('hidden');
}

// ==========================================
// 8. SIMULATION ACTIVITY LOG
// ==========================================

function addLog(type, message) {
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS

  const entry = document.createElement('div');
  entry.className = 'log-entry';

  let tagClass = 'tag-system';
  let tagLabel = 'SYS';

  if (type === 'init') { tagClass = 'tag-init'; tagLabel = 'INIT'; }
  else if (type === 'alloc') { tagClass = 'tag-alloc'; tagLabel = 'ALLOC'; }
  else if (type === 'free') { tagClass = 'tag-free'; tagLabel = 'FREE'; }

  entry.innerHTML = `
    <span class="log-time">[${timeStr}]</span>
    <span class="log-tag ${tagClass}">${tagLabel}</span>
    <span class="log-msg">${message}</span>
  `;

  // Newest event at the top
  elements.simulationLog.insertBefore(entry, elements.simulationLog.firstChild);
}

// ==========================================
// 9. AUTOMATED VIVA DEMONSTRATION RUNNER
// ==========================================

const demoSteps = [
  {
    text: "Step 1/5: Initializing clean disk with 32 blocks (Alternating pattern)...",
    action: () => initializeDisk(32, 'alternating'),
    delay: 2800
  },
  {
    text: "Step 2/5: Examining structures: Bitmap has 0/1 bits; Free Linked List tracks all green blocks.",
    action: () => {
      addLog('system', 'Demo: Pointing out HEAD pointer and linked list chain.');
    },
    delay: 3200
  },
  {
    text: "Step 3/5: Allocating 4 blocks. Watch Bitmap turn 0 → 1 and Linked List nodes detach!",
    action: () => allocateBlocks(4),
    delay: 3500
  },
  {
    text: "Step 4/5: Freeing blocks [1, 3, 5]. Watch Bitmap flip 1 → 0 and nodes re-attach to HEAD!",
    action: () => freeBlocks([1, 3, 5]),
    delay: 3500
  },
  {
    text: "Step 5/5: Demo complete! Bitmap and Linked List are synchronized in real-time.",
    action: () => {
      addLog('system', 'Demo sequence successfully finished. Ready for manual questions!');
    },
    delay: 3000
  }
];

function runDemo() {
  if (state.isDemoRunning) return;
  state.isDemoRunning = true;

  elements.demoBanner.classList.remove('hidden');
  elements.btnRunDemo.disabled = true;

  let currentStep = 0;

  function executeNextStep() {
    if (!state.isDemoRunning || currentStep >= demoSteps.length) {
      stopDemo();
      return;
    }

    const step = demoSteps[currentStep];
    elements.demoStepText.textContent = step.text;
    elements.demoStepCounter.textContent = `Step ${currentStep + 1} of ${demoSteps.length}`;

    step.action();

    currentStep++;
    state.demoTimeoutId = setTimeout(executeNextStep, step.delay);
  }

  executeNextStep();
}

function stopDemo() {
  state.isDemoRunning = false;
  if (state.demoTimeoutId) {
    clearTimeout(state.demoTimeoutId);
    state.demoTimeoutId = null;
  }
  elements.demoBanner.classList.add('hidden');
  elements.btnRunDemo.disabled = false;
}

// ==========================================
// 10. EVENT LISTENERS & INITIALIZATION
// ==========================================

function attachEventListeners() {
  // Disk Config Buttons
  elements.btnInitDisk.addEventListener('click', () => {
    const count = parseInt(elements.blockCountSelect.value, 10);
    const mode = elements.initModeSelect.value;
    initializeDisk(count, mode);
  });

  elements.btnResetSimulation.addEventListener('click', resetSimulation);

  // Allocation
  elements.btnAllocate.addEventListener('click', () => {
    const count = parseInt(elements.allocCountInput.value, 10);
    allocateBlocks(count);
  });

  // Quick Chips
  document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.getAttribute('data-val'), 10);
      elements.allocCountInput.value = val;
      allocateBlocks(val);
    });
  });

  // Deallocation
  elements.btnFreeBlocks.addEventListener('click', () => {
    let ids = [];
    if (state.selectedBlocks.size > 0) {
      ids = Array.from(state.selectedBlocks);
    } else {
      ids = parseBlockRangeInput(elements.freeBlocksInput.value);
    }
    freeBlocks(ids);
  });

  elements.btnClearSelection.addEventListener('click', () => {
    state.selectedBlocks.clear();
    updateSelectionUI();
    renderDisk();
  });

  elements.btnSelectAllAlloc.addEventListener('click', () => {
    state.selectedBlocks.clear();
    state.diskBlocks.forEach(b => {
      if (b.status === 'ALLOCATED') {
        state.selectedBlocks.add(b.id);
      }
    });
    updateSelectionUI();
    renderDisk();
    addLog('system', `Selected all ${state.selectedBlocks.size} allocated blocks for freeing.`);
  });

  // Clear Log
  elements.btnClearLog.addEventListener('click', () => {
    elements.simulationLog.innerHTML = '';
    addLog('system', 'Log buffer cleared.');
  });

  // Demo Controls
  elements.btnRunDemo.addEventListener('click', runDemo);
  elements.btnStopDemo.addEventListener('click', stopDemo);

  // Guide Modal
  elements.btnQuickTour.addEventListener('click', () => {
    elements.guideModal.classList.remove('hidden');
  });

  elements.btnCloseGuide.addEventListener('click', () => {
    elements.guideModal.classList.add('hidden');
  });

  elements.btnCloseGuideBtn.addEventListener('click', () => {
    elements.guideModal.classList.add('hidden');
  });

  elements.btnStartDemoFromModal.addEventListener('click', () => {
    elements.guideModal.classList.add('hidden');
    runDemo();
  });

  // Tabs in Educational Section
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // Dark/Light Theme Switcher
  elements.themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    try {
      localStorage.setItem('os-visualizer-theme', newTheme);
    } catch (e) {}
  });

  // Restore Theme Preference
  try {
    const savedTheme = localStorage.getItem('os-visualizer-theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  } catch (e) {}
}

// Bootstrap Application on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  attachEventListeners();
  initializeDisk(64, 'random');
  addLog('system', 'Free Disk Space Management Visualizer initialized ready for demonstration.');
});
