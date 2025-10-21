# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **browser-only, GitHub Pages-deployable EDA (Exploratory Data Analysis) web application** for credit card default datasets. It's a pure client-side application with no build step - just HTML, CSS, and vanilla JavaScript.

**Key principle**: All processing happens in the browser using PapaParse for CSV parsing and Chart.js for visualizations.

## Architecture

### File Structure
- **`index.html`** (445 lines): Complete UI with embedded CSS, all sections, and Chart.js canvas elements
- **`app.js`** (1,450+ lines): All JavaScript logic organized into sections (see below)
- **`README.md`**: User-facing documentation
- **`.gitignore`**: Excludes documentation files (IMPLEMENTATION_PLAN.md, VERIFICATION.md) and CSV data

### app.js Code Organization

The code is organized into clearly marked sections (search for `// ========================================`):

1. **DATASET CONFIGURATION** (lines 6-50): `CONFIG` object - modify this for different datasets
2. **GLOBAL STATE** (lines 52-67): Data storage (`trainData`, `testData`, `mergedData`, `isSingleFileMode`, `statistics`, `chartInstances`)
3. **UTILITY FUNCTIONS** (lines 68-165): UI helpers, column detection
4. **HELPER FUNCTIONS** (lines 175-247): `shuffleArray()`, `cloneRow()`, `splitDataset()`
5. **DATA LOADING FUNCTIONS** (lines 248-400): CSV parsing, file handling, auto-split logic
6. **STATISTICAL ANALYSIS FUNCTIONS** (lines 401-633): Missing values, descriptive stats, correlation
7. **DATA RENDERING FUNCTIONS** (lines 634-895): Tables, overview, statistics display
8. **VISUALIZATION FUNCTIONS** (lines 896-1168): Chart.js charts, heatmaps
9. **EXPORT FUNCTIONS** (lines 1169-1377): CSV/JSON export with DRY helper
10. **MAIN EDA RUNNER** (lines 1378-1406): `runEDA()` orchestration
11. **EVENT LISTENERS** (lines 1407-1450): DOM event wiring

## Critical Architecture Decisions

### Single-File vs Two-File Mode

**This is the most important architectural pattern:**

**Single-File Mode** (only train.csv uploaded):
- `mergedData = rawData` (full original dataset used for ALL EDA)
- Auto-split creates `trainData` (80%, with target) and `testData` (20%, without target) **for export only**
- Split is NOT used for analysis - it's purely for ML workflow downloads
- `isSingleFileMode = true`

**Two-File Mode** (train.csv + test.csv uploaded):
- `mergedData = trainData + testData` (concatenated)
- No auto-split performed
- `isSingleFileMode = false`

### Dataset Configuration (CONFIG object)

To adapt for other datasets, modify **only the CONFIG object** (lines 9-47):

```javascript
schema: {
    identifier: 'ID',           // Column to exclude
    target: 'dpnm',             // Target variable (actual column name!)
    demographics: [...],         // Feature groups
    // ... etc
},
categorical: [...],             // Columns treated as categorical
labels: {...},                  // Human-readable category labels
autoSplit: {                    // Auto-split settings
    enabled: true,
    testRatio: 0.2,
    minRows: 10
}
```

**IMPORTANT**: Column names in CONFIG must match the actual CSV column names exactly. Do NOT rename columns during data loading.

## Common Tasks

### Testing Locally
Open `index.html` directly in a browser (no server needed). Upload CSV files via the UI.

### Syntax Validation
```bash
node -c app.js
```

### Deploying to GitHub Pages
```bash
git add index.html app.js README.md .gitignore
git commit -m "Your message"
git push origin main  # or dev branch
```
Then enable Pages in GitHub repo settings: Settings → Pages → Source: main branch, / (root)

### Git Workflow
- `main` branch: Stable releases
- `dev` branch: Development work
- Always amend commits when fixing issues in the same logical change

## Key Implementation Details

### Data Flow
1. **Load**: CSV → PapaParse → JavaScript array of objects
2. **Process**:
   - Single file: `mergedData = rawData`, then split for export
   - Two files: `mergedData = concat(train, test)`
3. **Analyze**: All EDA runs on `mergedData`
4. **Export**:
   - "Export Full CSV" (single-file) or "Export Merged CSV" (two-file)
   - "Export Train CSV" / "Export Test CSV" (single-file mode only)

### Chart.js Memory Management
Always destroy previous chart instances before creating new ones:
```javascript
destroyChart('chart-id');
chartInstances['chart-id'] = new Chart(ctx, {...});
```

### CSV Export Pattern
Use the DRY helper `exportDataAsCSV(data, filename)` for all CSV exports. It handles:
- Column headers
- Null values
- Comma quoting
- Blob creation and download

### Correlation Heatmap
Chart.js doesn't natively support heatmaps, so it's implemented as an **HTML table with color-coded cells**. Limited to 10 features for readability.

## Dataset Constraints

### Expected Column Names
- **Identifier**: `ID` (excluded from analysis)
- **Target**: `dpnm` (default payment next month)
- **Demographics**: `SEX`, `EDUCATION`, `MARRIAGE`, `AGE`
- **Financial**: `LIMIT_BAL`
- **Payment Status**: `PAY_1` through `PAY_6` (6 months)
- **Bill Amounts**: `BILL_AMT1` through `BILL_AMT6`
- **Payment Amounts**: `PAY_AMT1` through `PAY_AMT6`

**Note**: `PAY_1` (not `PAY_0`) is the correct column name. Never rename columns during loading.

### CSV Format Requirements
- Header row required
- PapaParse config: `{header: true, dynamicTyping: true, skipEmptyLines: true, quotes: true}`
- Max recommended size: 50MB (browser memory limitations)

## UI/UX Patterns

### Status Messages
Use `showMessage(elementId, message, type)` where type is:
- `'success'` - Green background
- `'error'` - Red background
- `'info'` - Blue background

### Section Visibility
Sections are hidden by default. Use `toggleSection(sectionId, true)` to show them after EDA completes.

### Dynamic UI Elements
`updateExportSection()` changes button text and descriptions based on `isSingleFileMode`:
- Single-file: "Export Full CSV"
- Two-file: "Export Merged CSV"

## Edge Cases to Handle

1. **Dataset too small (<10 rows)**: Skip auto-split, warn user
2. **Missing target column**: Grouped stats and default rate charts won't render
3. **Empty CSV**: loadCSV rejects with error
4. **Large datasets (>100K rows)**: Performance warning (acceptable but slow)

## External Dependencies (CDN)

- PapaParse 5.4.1: `https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js`
- Chart.js 4.4.0: `https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js`

No npm, no webpack, no build step.

## Code Style

- ES6+ features (arrow functions, destructuring, template literals)
- JSDoc comments for all functions
- Clear section markers with `// ========================================`
- DRY principle: generic helpers over duplication (e.g., `exportDataAsCSV`, `renderBarChart`)
- No external state mutations - use function parameters and return values

## What NOT to Do

❌ **Don't rename CSV columns during loading** - Use actual column names from the dataset
❌ **Don't use mergedData for auto-split** - In single-file mode, mergedData = rawData (full dataset)
❌ **Don't create Chart.js instances without cleanup** - Always destroyChart() first
❌ **Don't assume PAY_0 exists** - The column is PAY_1
❌ **Don't use the split data for EDA** - trainData/testData are for export only in single-file mode

## Debugging

Open browser DevTools (F12):
- Console logs show: load progress, split info, chart creation, export status
- Check `mergedData`, `trainData`, `testData` in console
- Verify `isSingleFileMode` flag
- Check `CONFIG.schema.target` matches actual column name
