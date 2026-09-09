# Free Disk Space Management Visualizer

An interactive educational web prototype demonstrating how an Operating System tracks free and allocated disk blocks using **Bit Maps (Bit Vectors)** and **Free Block Linked Lists**.

---

## 🌟 Key Features

1. **Dual Free-Space Tracking Architectures**:
   - **Bit Map (Bit Vector)**: 1 bit per block (`0 = FREE`, `1 = ALLOCATED`), with byte grouping and hex summary for authentic OS simulation.
   - **Linked List of Free Blocks**: Chain of pointers starting from `HEAD` (stored in the Superblock) connecting all free disk blocks to `NULL`.
2. **Interactive Disk Block Grid**:
   - Visual grid supporting 32, 64, 100, and 128 disk blocks.
   - Real-time pulse animations when blocks change state.
   - Interactive multi-block selection by clicking directly on the grid or typing comma-separated ranges (`e.g., 2, 4, 7-9`).
   - Hover tooltips showing Block ID, Status, Bitmap Bit, and Next Pointer.
3. **Kernel Operations Hub**:
   - **Allocation**: Request $N$ blocks with validation and error messaging for out-of-space conditions.
   - **Deallocation**: Release blocks with automatic prepend to `HEAD` in the Free List and bit flip in the Bitmap.
4. **Real-time OS Metrics Bar**:
   - Total capacity, Free vs. Allocated counts & percentages, dynamic space distribution bar.
   - Memory overhead calculations: RAM footprint for Bitmap vs. Linked List Superblock pointer.
5. **Automated "Run Viva Demo" Mode**:
   - One-click scripted demonstration sequence with timed narration, ideal for college viva and lab examinations.
6. **Operating Systems Theory & Viva Reference**:
   - In-depth explanations of both techniques.
   - Comprehensive Comparison Table (Representation, Overhead, Search Time, Contiguous Allocation, Disk I/O).
   - Interactive Viva Q&A Accordion.
7. **Modern OS Dashboard Aesthetics**:
   - Dark/Light mode switcher with persistence.
   - Pure HTML5, CSS3, and Vanilla JavaScript (Client-side, 0 dependencies).

---

## 🚀 How to Run Locally

Simply open `index.html` in any modern web browser:

```bash
# Option 1: Double-click index.html or open via browser
start index.html

# Option 2: Run a local static server
python -m http.server 8080
# Then visit: http://localhost:8080
```

---

## 📁 File Structure

```
OS prototype/
├── index.html     # Semantic HTML5 layout and modal structures
├── style.css      # Modern CS theme, animations, dark/light styles
├── script.js      # Simulation engine and data structure logic
└── README.md      # Documentation and Viva reference
```

---

## 🎓 Viva Quick-Reference Summary

| Feature | Bit Map (Bit Vector) | Free Block Linked List |
| :--- | :--- | :--- |
| **Physical Storage** | Continuous array of 1-bit flags (0 = Free, 1 = Alloc) | Pointers embedded inside unallocated disk blocks |
| **Memory Overhead** | $D / 8$ bytes in RAM ($D$ = total blocks) | **0 extra bytes** (only 1 `HEAD` pointer in RAM) |
| **Finding 1 Free Block** | Fast bitwise scan via CPU hardware | **$O(1)$** instant pop from `HEAD` |
| **Contiguous Allocation** | **Excellent** (scans bits in RAM) | **Poor** (requires reading disk blocks, high I/O) |
| **Deallocation** | $O(1)$ — flip bit to `0` | $O(1)$ — push freed block to `HEAD` |
