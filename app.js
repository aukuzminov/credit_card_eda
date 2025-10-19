// ========================================
// CREDIT CARD DEFAULT EDA - APP.JS
// Browser-only interactive EDA tool
// ========================================

// ========================================
// DATASET CONFIGURATION - SWAP FOR OTHER DATASETS
// ========================================
const CONFIG = {
    // Schema definition - modify these for different datasets
    schema: {
        identifier: 'ID',  // Column to exclude from analysis
        target: 'dpnm',  // Target variable name in CSV (default payment next month)

        // Feature groups
        demographics: ['SEX', 'EDUCATION', 'MARRIAGE', 'AGE'],
        financial: ['LIMIT_BAL'],
        paymentStatus: ['PAY_1', 'PAY_2', 'PAY_3', 'PAY_4', 'PAY_5', 'PAY_6'],  // Payment status for 6 months
        billAmounts: ['BILL_AMT1', 'BILL_AMT2', 'BILL_AMT3', 'BILL_AMT4', 'BILL_AMT5', 'BILL_AMT6'],
        paymentAmounts: ['PAY_AMT1', 'PAY_AMT2', 'PAY_AMT3', 'PAY_AMT4', 'PAY_AMT5', 'PAY_AMT6']
    },

    // Categorical columns (numeric but represent categories)
    categorical: ['SEX', 'EDUCATION', 'MARRIAGE', 'PAY_1', 'PAY_2', 'PAY_3', 'PAY_4', 'PAY_5', 'PAY_6'],

    // Age bins for histogram visualization
    ageBins: [0, 25, 35, 45, 55, 65, 100],
    ageBinLabels: ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'],

    // Number of rows to preview
    sampleSize: 10,

    // Category labels for better display
    labels: {
        SEX: {1: 'Male', 2: 'Female'},
        EDUCATION: {0: 'Unknown', 1: 'Graduate', 2: 'University', 3: 'High School', 4: 'Others', 5: 'Unknown', 6: 'Unknown'},
        MARRIAGE: {0: 'Unknown', 1: 'Married', 2: 'Single', 3: 'Others'},
        [undefined]: {0: 'No Default', 1: 'Default'}  // For target variable
    },

    // Auto-split configuration (for single-file mode)
    autoSplit: {
        enabled: true,           // Enable auto-split when only one file is loaded
        testRatio: 0.2,          // 20% test, 80% train
        minRows: 10              // Minimum rows required to perform split
    }
};
// ========================================
// END DATASET CONFIGURATION
// ========================================

// ========================================
// GLOBAL STATE
// ========================================
let trainData = null;
let testData = null;
let mergedData = null;
let isSingleFileMode = false;  // Track if auto-split was performed
let statistics = {
    missing: {},
    numeric: {},
    categorical: {},
    grouped: {},
    correlation: null
};
let chartInstances = {};  // Store Chart.js instances for cleanup

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Display status message to user
 * @param {string} elementId - ID of status message element
 * @param {string} message - Message to display
 * @param {string} type - Type: 'success', 'error', 'info'
 */
function showMessage(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `status-message ${type}`;
        element.style.display = 'block';
    }
}

/**
 * Hide status message
 * @param {string} elementId - ID of status message element
 */
function hideMessage(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'none';
    }
}

/**
 * Show/hide spinner
 * @param {string} spinnerId - ID of spinner element
 * @param {boolean} show - Show or hide
 */
function toggleSpinner(spinnerId, show) {
    const spinner = document.getElementById(spinnerId);
    if (spinner) {
        spinner.style.display = show ? 'block' : 'none';
    }
}

/**
 * Show/hide section
 * @param {string} sectionId - ID of section element
 * @param {boolean} show - Show or hide
 */
function toggleSection(sectionId, show) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.style.display = show ? 'block' : 'none';
    }
}

/**
 * Destroy existing Chart.js instance
 * @param {string} chartId - ID of chart instance
 */
function destroyChart(chartId) {
    if (chartInstances[chartId]) {
        chartInstances[chartId].destroy();
        delete chartInstances[chartId];
    }
}

/**
 * Get all numeric columns from data
 * @param {Array} data - Array of data objects
 * @returns {Array} - Array of numeric column names
 */
function getNumericColumns(data) {
    if (!data || data.length === 0) return [];

    const firstRow = data[0];
    const numericCols = [];

    for (let col in firstRow) {
        // Skip identifier and target, skip if in categorical list
        if (col === CONFIG.schema.identifier || col === CONFIG.schema.target) continue;
        if (CONFIG.categorical.includes(col)) continue;

        // Check if column has numeric values
        const sample = data.slice(0, 100).map(row => row[col]).filter(v => v != null);
        if (sample.length > 0 && sample.every(v => typeof v === 'number')) {
            numericCols.push(col);
        }
    }

    return numericCols;
}

/**
 * Get all categorical columns from data
 * @param {Array} data - Array of data objects
 * @returns {Array} - Array of categorical column names
 */
function getCategoricalColumns(data) {
    if (!data || data.length === 0) return [];

    const allCols = Object.keys(data[0]);
    return allCols.filter(col =>
        CONFIG.categorical.includes(col) &&
        col !== CONFIG.schema.identifier
    );
}

/**
 * Shuffle array in place using Fisher-Yates algorithm
 * Ensures truly random distribution for train/test split
 * @param {Array} array - Array to shuffle
 * @returns {Array} - Same array, shuffled in place
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];  // Swap elements
    }
    return array;
}

/**
 * Deep clone a data row object
 * Prevents reference issues when modifying test data
 * @param {Object} row - Row object to clone
 * @returns {Object} - Cloned row with no references to original
 */
function cloneRow(row) {
    // Use JSON parse/stringify for deep clone
    // Alternative: Object.assign({}, row) for shallow clone
    return JSON.parse(JSON.stringify(row));
}

/**
 * Split dataset into train and test sets
 * Train set keeps all columns, test set has target removed
 * @param {Array} data - Full dataset to split
 * @param {number} testRatio - Ratio for test set (e.g., 0.2 for 20%)
 * @returns {Object|null} - {train, test} or null if dataset too small
 */
function splitDataset(data, testRatio = 0.2) {
    if (!data || data.length === 0) {
        console.error('Cannot split empty dataset');
        return null;
    }

    // Check minimum size requirement
    if (data.length < CONFIG.autoSplit.minRows) {
        console.warn(`Dataset has only ${data.length} rows. Minimum ${CONFIG.autoSplit.minRows} required for split.`);
        return null;
    }

    // Clone and shuffle data to ensure random distribution
    const shuffled = shuffleArray([...data]);

    // Calculate split index (e.g., 80% for train)
    const splitIndex = Math.floor(data.length * (1 - testRatio));

    // Split into train and test
    const trainData = shuffled.slice(0, splitIndex);
    const testDataRaw = shuffled.slice(splitIndex);

    // Clone test data and remove target column
    const targetColumn = CONFIG.schema.target;
    const testData = testDataRaw.map(row => {
        const newRow = cloneRow(row);
        // Remove target column if it exists
        if (targetColumn in newRow) {
            delete newRow[targetColumn];
        }
        return newRow;
    });

    console.log(`Dataset split: ${trainData.length} train (${Math.round((1-testRatio)*100)}%) / ${testData.length} test (${Math.round(testRatio*100)}%)`);

    return {
        train: trainData,
        test: testData
    };
}

// ========================================
// DATA LOADING FUNCTIONS
// ========================================

/**
 * Load CSV file using PapaParse
 * @param {File} file - File object from input
 * @returns {Promise} - Promise resolving to parsed data
 */
function loadCSV(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('No file provided'));
            return;
        }

        Papa.parse(file, {
            header: true,  // First row is header
            dynamicTyping: true,  // Convert numbers automatically
            skipEmptyLines: true,  // Skip empty rows
            quotes: true,  // Handle quoted fields with commas
            complete: function(results) {
                if (results.errors.length > 0) {
                    console.warn('Parse warnings:', results.errors);
                }

                if (!results.data || results.data.length === 0) {
                    reject(new Error('File is empty or invalid'));
                    return;
                }

                resolve(results.data);
            },
            error: function(error) {
                reject(error);
            }
        });
    });
}

/**
 * Merge train and test datasets
 * @param {Array} train - Training data
 * @param {Array} test - Test data (optional)
 * @returns {Array} - Merged data
 */
function mergeDatasets(train, test) {
    if (!test || test.length === 0) {
        console.log('No test data provided, using only train data');
        return [...train];  // Return copy
    }

    console.log(`Merging ${train.length} train rows with ${test.length} test rows`);
    return [...train, ...test];
}

/**
 * Main function to handle file loading
 * Handles both single-file (auto-split) and two-file (merge) modes
 */
async function handleFileLoad() {
    const trainFile = document.getElementById('train-file').files[0];
    const testFile = document.getElementById('test-file').files[0];

    // Validate at least train file is selected
    if (!trainFile) {
        showMessage('load-status', 'Please select at least a train.csv file', 'error');
        return;
    }

    try {
        toggleSpinner('load-spinner', true);
        hideMessage('load-status');

        // Load the initial file
        console.log('Loading train file...');
        let rawData = await loadCSV(trainFile);
        console.log(`File loaded: ${rawData.length} rows`);

        if (!testFile && CONFIG.autoSplit.enabled) {
            // SINGLE FILE MODE - Use full data for EDA, split only for export
            console.log('Single file mode: using full dataset for EDA, preparing split for export...');

            // USE FULL ORIGINAL DATA FOR EDA
            mergedData = rawData;

            // Perform split only for future export (trainData/testData)
            const splitResult = splitDataset(rawData, CONFIG.autoSplit.testRatio);

            if (splitResult === null) {
                // Dataset too small for split
                console.warn('Dataset too small for auto-split');
                trainData = null;
                testData = null;
                isSingleFileMode = false;

                toggleSpinner('load-spinner', false);
                showMessage('load-status',
                    `✓ Data loaded! ${mergedData.length} rows, ${Object.keys(mergedData[0]).length} columns. (Dataset too small for auto-split - minimum ${CONFIG.autoSplit.minRows} rows required)`,
                    'success');
            } else {
                // Split successful - store for export only
                trainData = splitResult.train;
                testData = splitResult.test;
                isSingleFileMode = true;

                toggleSpinner('load-spinner', false);
                const trainPct = Math.round((1 - CONFIG.autoSplit.testRatio) * 100);
                const testPct = Math.round(CONFIG.autoSplit.testRatio * 100);
                showMessage('load-status',
                    `✓ Data loaded! ${mergedData.length} rows, ${Object.keys(mergedData[0]).length} columns. Auto-split prepared for export: ${trainData.length} train (${trainPct}%) / ${testData.length} test (${testPct}%)`,
                    'success');
            }

        } else if (testFile) {
            // TWO FILE MODE - Load and merge
            console.log('Two file mode: loading test file...');
            testData = await loadCSV(testFile);
            console.log(`Test data loaded: ${testData.length} rows`);

            trainData = rawData;
            mergedData = mergeDatasets(trainData, testData);
            isSingleFileMode = false;

            toggleSpinner('load-spinner', false);
            showMessage('load-status',
                `✓ Files merged! Train: ${trainData.length} rows | Test: ${testData.length} rows | Total: ${mergedData.length} rows, ${Object.keys(mergedData[0]).length} columns`,
                'success');

        } else {
            // Single file mode with auto-split disabled
            console.log('Auto-split disabled, using full dataset');
            trainData = rawData;
            testData = null;
            mergedData = rawData;
            isSingleFileMode = false;

            toggleSpinner('load-spinner', false);
            showMessage('load-status',
                `✓ Data loaded! ${mergedData.length} rows, ${Object.keys(mergedData[0]).length} columns`,
                'success');
        }

        // Run EDA automatically
        runEDA();

    } catch (error) {
        toggleSpinner('load-spinner', false);
        showMessage('load-status', `Error loading data: ${error.message}`, 'error');
        console.error('Load error:', error);
    }
}

// ========================================
// STATISTICAL ANALYSIS FUNCTIONS
// ========================================

/**
 * Calculate missing values per column
 * @param {Array} data - Array of data objects
 * @returns {Object} - {column: {count, percentage}}
 */
function calculateMissing(data) {
    if (!data || data.length === 0) return {};

    const totalRows = data.length;
    const columns = Object.keys(data[0]);
    const missing = {};

    columns.forEach(col => {
        const missingCount = data.filter(row =>
            row[col] === null ||
            row[col] === undefined ||
            row[col] === '' ||
            (typeof row[col] === 'number' && isNaN(row[col]))
        ).length;

        missing[col] = {
            count: missingCount,
            percentage: ((missingCount / totalRows) * 100).toFixed(2)
        };
    });

    return missing;
}

/**
 * Calculate descriptive statistics for numeric columns
 * @param {Array} data - Array of data objects
 * @param {Array} columns - Array of column names
 * @returns {Object} - {column: {mean, median, std, min, max, q25, q75}}
 */
function calculateNumericStats(data, columns) {
    const stats = {};

    columns.forEach(col => {
        // Filter out null/undefined values
        const values = data
            .map(row => row[col])
            .filter(v => v != null && typeof v === 'number' && !isNaN(v));

        if (values.length === 0) {
            stats[col] = {mean: 0, median: 0, std: 0, min: 0, max: 0, q25: 0, q75: 0, count: 0};
            return;
        }

        // Sort for median and quartiles
        const sorted = [...values].sort((a, b) => a - b);
        const n = sorted.length;

        // Mean
        const mean = values.reduce((sum, v) => sum + v, 0) / n;

        // Median
        const median = n % 2 === 0
            ? (sorted[n/2 - 1] + sorted[n/2]) / 2
            : sorted[Math.floor(n/2)];

        // Standard deviation
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
        const std = Math.sqrt(variance);

        // Min, Max
        const min = sorted[0];
        const max = sorted[n - 1];

        // Quartiles
        const q25Index = Math.floor(n * 0.25);
        const q75Index = Math.floor(n * 0.75);
        const q25 = sorted[q25Index];
        const q75 = sorted[q75Index];

        stats[col] = {
            mean: mean.toFixed(2),
            median: median.toFixed(2),
            std: std.toFixed(2),
            min: min.toFixed(2),
            max: max.toFixed(2),
            q25: q25.toFixed(2),
            q75: q75.toFixed(2),
            count: n
        };
    });

    return stats;
}

/**
 * Calculate frequency counts for categorical columns
 * @param {Array} data - Array of data objects
 * @param {Array} columns - Array of column names
 * @returns {Object} - {column: {value: count}}
 */
function calculateCategoricalStats(data, columns) {
    const stats = {};

    columns.forEach(col => {
        const counts = {};

        data.forEach(row => {
            const value = row[col];
            if (value != null && value !== '') {
                counts[value] = (counts[value] || 0) + 1;
            }
        });

        stats[col] = counts;
    });

    return stats;
}

/**
 * Group statistics by target variable
 * @param {Array} data - Array of data objects
 * @param {string} targetCol - Target column name
 * @returns {Object} - {0: stats, 1: stats}
 */
function groupByTarget(data, targetCol) {
    // Check if target column exists
    const hasTarget = data.some(row => row[targetCol] != null);
    if (!hasTarget) {
        console.log('Target column not found or all null, skipping grouped stats');
        return null;
    }

    // Split data by target value
    const group0 = data.filter(row => row[targetCol] === 0);
    const group1 = data.filter(row => row[targetCol] === 1);

    console.log(`Target groups: No Default=${group0.length}, Default=${group1.length}`);

    // Get numeric columns
    const numericCols = getNumericColumns(data);

    // Calculate stats for each group
    const stats0 = calculateNumericStats(group0, numericCols);
    const stats1 = calculateNumericStats(group1, numericCols);

    return {
        0: {label: 'No Default', count: group0.length, stats: stats0},
        1: {label: 'Default', count: group1.length, stats: stats1}
    };
}

/**
 * Calculate Pearson correlation coefficient between two arrays
 * @param {Array} x - First array
 * @param {Array} y - Second array
 * @returns {number} - Correlation coefficient
 */
function pearsonCorrelation(x, y) {
    const n = x.length;
    if (n === 0 || n !== y.length) return 0;

    const meanX = x.reduce((sum, v) => sum + v, 0) / n;
    const meanY = y.reduce((sum, v) => sum + v, 0) / n;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
        const dx = x[i] - meanX;
        const dy = y[i] - meanY;
        numerator += dx * dy;
        denomX += dx * dx;
        denomY += dy * dy;
    }

    const denom = Math.sqrt(denomX * denomY);
    return denom === 0 ? 0 : numerator / denom;
}

/**
 * Calculate correlation matrix for numeric columns
 * @param {Array} data - Array of data objects
 * @param {Array} columns - Array of column names
 * @returns {Object} - {matrix: 2D array, labels: column names}
 */
function calculateCorrelation(data, columns) {
    const n = columns.length;
    const matrix = Array(n).fill(0).map(() => Array(n).fill(0));

    // Extract column data
    const columnData = {};
    columns.forEach(col => {
        columnData[col] = data
            .map(row => row[col])
            .filter(v => v != null && typeof v === 'number' && !isNaN(v));
    });

    // Calculate pairwise correlations
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (i === j) {
                matrix[i][j] = 1.0;  // Perfect correlation with self
            } else {
                // Get common indices where both columns have values
                const col1 = columns[i];
                const col2 = columns[j];

                const pairs = [];
                data.forEach(row => {
                    const v1 = row[col1];
                    const v2 = row[col2];
                    if (v1 != null && v2 != null && !isNaN(v1) && !isNaN(v2)) {
                        pairs.push([v1, v2]);
                    }
                });

                if (pairs.length > 0) {
                    const x = pairs.map(p => p[0]);
                    const y = pairs.map(p => p[1]);
                    matrix[i][j] = pearsonCorrelation(x, y);
                } else {
                    matrix[i][j] = 0;
                }
            }
        }
    }

    return {matrix, labels: columns};
}

// ========================================
// DATA RENDERING FUNCTIONS
// ========================================

/**
 * Render preview table showing first N rows
 * @param {Array} data - Array of data objects
 * @param {number} limit - Number of rows to show
 */
function renderPreviewTable(data, limit = CONFIG.sampleSize) {
    const container = document.getElementById('preview-table');
    if (!container || !data || data.length === 0) return;

    const columns = Object.keys(data[0]);
    const rows = data.slice(0, limit);

    let html = '<table><thead><tr>';
    columns.forEach(col => {
        html += `<th>${col}</th>`;
    });
    html += '</tr></thead><tbody>';

    rows.forEach(row => {
        html += '<tr>';
        columns.forEach(col => {
            const value = row[col];
            const displayValue = value != null ? value : '<em>null</em>';
            html += `<td>${displayValue}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

/**
 * Update overview section
 */
function updateOverview() {
    if (!mergedData) return;

    const rows = mergedData.length;
    const cols = Object.keys(mergedData[0]).length;

    let shapeText = `${rows} rows × ${cols} columns`;

    // Add split info in single-file mode (split is for export only, not EDA)
    if (isSingleFileMode && trainData && testData) {
        shapeText += ` | Auto-split available for export: ${trainData.length} train (80%) / ${testData.length} test (20%)`;
    }

    document.getElementById('shape-text').textContent = shapeText;
    renderPreviewTable(mergedData);

    toggleSection('overview-section', true);
}

/**
 * Update missing values section
 */
function updateMissingValues() {
    if (!mergedData) return;

    statistics.missing = calculateMissing(mergedData);

    // Render table
    const tbody = document.getElementById('missing-tbody');
    tbody.innerHTML = '';

    Object.entries(statistics.missing).forEach(([col, data]) => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = col;
        row.insertCell(1).textContent = data.count;
        row.insertCell(2).textContent = data.percentage + '%';
    });

    // Render chart
    renderMissingChart();

    toggleSection('missing-section', true);
}

/**
 * Render missing values bar chart
 */
function renderMissingChart() {
    const ctx = document.getElementById('missing-chart');
    if (!ctx) return;

    destroyChart('missing-chart');

    const labels = Object.keys(statistics.missing);
    const data = labels.map(col => parseFloat(statistics.missing[col].percentage));

    chartInstances['missing-chart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Missing Values (%)',
                data: data,
                backgroundColor: 'rgba(231, 76, 60, 0.6)',
                borderColor: 'rgba(231, 76, 60, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',  // Horizontal bar chart
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Missing Values by Column (%)'
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Percentage'
                    }
                }
            }
        }
    });
}

/**
 * Update statistics section
 */
function updateStatistics() {
    if (!mergedData) return;

    const numericCols = getNumericColumns(mergedData);
    const categoricalCols = getCategoricalColumns(mergedData);

    // Calculate statistics
    statistics.numeric = calculateNumericStats(mergedData, numericCols);
    statistics.categorical = calculateCategoricalStats(mergedData, categoricalCols);
    statistics.grouped = groupByTarget(mergedData, CONFIG.schema.target);

    // Render numeric stats table
    renderNumericStatsTable();

    // Render categorical stats
    renderCategoricalStats();

    // Render grouped stats
    renderGroupedStats();

    toggleSection('stats-section', true);
}

/**
 * Render numeric statistics table
 */
function renderNumericStatsTable() {
    const container = document.getElementById('numeric-stats-table');
    if (!container) return;

    let html = '<table><thead><tr>';
    html += '<th>Feature</th><th>Count</th><th>Mean</th><th>Median</th><th>Std Dev</th><th>Min</th><th>Q25</th><th>Q75</th><th>Max</th>';
    html += '</tr></thead><tbody>';

    Object.entries(statistics.numeric).forEach(([col, stats]) => {
        html += '<tr>';
        html += `<td><strong>${col}</strong></td>`;
        html += `<td>${stats.count}</td>`;
        html += `<td>${stats.mean}</td>`;
        html += `<td>${stats.median}</td>`;
        html += `<td>${stats.std}</td>`;
        html += `<td>${stats.min}</td>`;
        html += `<td>${stats.q25}</td>`;
        html += `<td>${stats.q75}</td>`;
        html += `<td>${stats.max}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

/**
 * Render categorical statistics
 */
function renderCategoricalStats() {
    const container = document.getElementById('categorical-stats-container');
    if (!container) return;

    let html = '';

    Object.entries(statistics.categorical).forEach(([col, counts]) => {
        html += `<h4>${col}</h4>`;
        html += '<div class="table-container"><table>';
        html += '<thead><tr><th>Value</th><th>Label</th><th>Count</th><th>Percentage</th></tr></thead><tbody>';

        const total = Object.values(counts).reduce((sum, c) => sum + c, 0);

        Object.entries(counts).forEach(([value, count]) => {
            const percentage = ((count / total) * 100).toFixed(2);
            const label = CONFIG.labels[col] && CONFIG.labels[col][value]
                ? CONFIG.labels[col][value]
                : value;

            html += '<tr>';
            html += `<td>${value}</td>`;
            html += `<td>${label}</td>`;
            html += `<td>${count}</td>`;
            html += `<td>${percentage}%</td>`;
            html += '</tr>';
        });

        html += '</tbody></table></div>';
    });

    container.innerHTML = html;
}

/**
 * Render grouped statistics by target variable
 */
function renderGroupedStats() {
    const container = document.getElementById('grouped-stats-container');
    if (!container) return;

    if (!statistics.grouped) {
        container.innerHTML = '<p><em>Target variable not available in this dataset.</em></p>';
        return;
    }

    let html = '<div class="table-container"><table>';
    html += '<thead><tr><th>Feature</th><th>Metric</th>';
    html += `<th>No Default (n=${statistics.grouped[0].count})</th>`;
    html += `<th>Default (n=${statistics.grouped[1].count})</th>`;
    html += '</tr></thead><tbody>';

    const metrics = ['mean', 'median', 'std'];

    Object.keys(statistics.grouped[0].stats).forEach(col => {
        metrics.forEach((metric, idx) => {
            html += '<tr>';
            if (idx === 0) {
                html += `<td rowspan="${metrics.length}"><strong>${col}</strong></td>`;
            }
            html += `<td>${metric.toUpperCase()}</td>`;
            html += `<td>${statistics.grouped[0].stats[col][metric]}</td>`;
            html += `<td>${statistics.grouped[1].stats[col][metric]}</td>`;
            html += '</tr>';
        });
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// ========================================
// VISUALIZATION FUNCTIONS
// ========================================

/**
 * Update all visualizations
 */
function updateVisualizations() {
    if (!mergedData) return;

    // Demographics charts
    renderDemographicsCharts();

    // Financial charts
    renderFinancialCharts();

    // Default rate by category
    renderDefaultRateCharts();

    // Correlation heatmap
    renderCorrelationHeatmap();

    toggleSection('viz-section', true);
}

/**
 * Render demographics bar charts (SEX, EDUCATION, MARRIAGE, AGE)
 */
function renderDemographicsCharts() {
    // SEX
    const sexCounts = statistics.categorical['SEX'] || {};
    const sexLabels = Object.keys(sexCounts).map(v => CONFIG.labels.SEX[v] || v);
    const sexData = Object.values(sexCounts);

    renderBarChart('sex-chart', sexLabels, sexData, 'Gender Distribution', 'rgba(52, 152, 219, 0.6)');

    // EDUCATION
    const eduCounts = statistics.categorical['EDUCATION'] || {};
    const eduLabels = Object.keys(eduCounts).map(v => CONFIG.labels.EDUCATION[v] || v);
    const eduData = Object.values(eduCounts);

    renderBarChart('education-chart', eduLabels, eduData, 'Education Level Distribution', 'rgba(46, 204, 113, 0.6)');

    // MARRIAGE
    const marCounts = statistics.categorical['MARRIAGE'] || {};
    const marLabels = Object.keys(marCounts).map(v => CONFIG.labels.MARRIAGE[v] || v);
    const marData = Object.values(marCounts);

    renderBarChart('marriage-chart', marLabels, marData, 'Marital Status Distribution', 'rgba(155, 89, 182, 0.6)');

    // AGE - Histogram with bins
    renderAgeHistogram();
}

/**
 * Render age histogram with bins
 */
function renderAgeHistogram() {
    const ageValues = mergedData
        .map(row => row['AGE'])
        .filter(v => v != null && !isNaN(v));

    // Create bins
    const bins = CONFIG.ageBins;
    const binCounts = Array(bins.length - 1).fill(0);

    ageValues.forEach(age => {
        for (let i = 0; i < bins.length - 1; i++) {
            if (age >= bins[i] && age < bins[i + 1]) {
                binCounts[i]++;
                break;
            }
        }
    });

    renderBarChart('age-chart', CONFIG.ageBinLabels, binCounts, 'Age Distribution', 'rgba(230, 126, 34, 0.6)');
}

/**
 * Render financial charts (LIMIT_BAL histogram)
 */
function renderFinancialCharts() {
    const limitValues = mergedData
        .map(row => row['LIMIT_BAL'])
        .filter(v => v != null && !isNaN(v));

    // Create bins for credit limit (0-1M in 100k increments)
    const maxLimit = Math.max(...limitValues);
    const binSize = 100000;
    const numBins = Math.ceil(maxLimit / binSize);
    const bins = Array(numBins).fill(0);
    const binLabels = [];

    for (let i = 0; i < numBins; i++) {
        binLabels.push(`${i * binSize / 1000}k-${(i + 1) * binSize / 1000}k`);
    }

    limitValues.forEach(val => {
        const binIndex = Math.min(Math.floor(val / binSize), numBins - 1);
        bins[binIndex]++;
    });

    renderBarChart('limit-chart', binLabels, bins, 'Credit Limit Distribution (NT$)', 'rgba(241, 196, 15, 0.6)');
}

/**
 * Render default rate by category charts
 */
function renderDefaultRateCharts() {
    // Check if target exists
    const hasTarget = mergedData.some(row => row[CONFIG.schema.target] != null);
    if (!hasTarget) {
        console.log('Target variable not available, skipping default rate charts');
        return;
    }

    // Default rate by SEX
    renderDefaultRateByCategory('SEX', 'default-by-sex-chart', 'Default Rate by Gender');

    // Default rate by EDUCATION
    renderDefaultRateByCategory('EDUCATION', 'default-by-education-chart', 'Default Rate by Education');
}

/**
 * Generic function to render default rate by a categorical variable
 * @param {string} column - Column name
 * @param {string} canvasId - Canvas element ID
 * @param {string} title - Chart title
 */
function renderDefaultRateByCategory(column, canvasId, title) {
    const categoryCounts = {};

    mergedData.forEach(row => {
        const category = row[column];
        const defaultFlag = row[CONFIG.schema.target];

        if (category != null && defaultFlag != null) {
            if (!categoryCounts[category]) {
                categoryCounts[category] = {total: 0, defaults: 0};
            }
            categoryCounts[category].total++;
            if (defaultFlag === 1) {
                categoryCounts[category].defaults++;
            }
        }
    });

    const labels = Object.keys(categoryCounts).map(v => CONFIG.labels[column] && CONFIG.labels[column][v] || v);
    const defaultRates = Object.values(categoryCounts).map(c => (c.defaults / c.total * 100).toFixed(2));

    renderBarChart(canvasId, labels, defaultRates, title, 'rgba(231, 76, 60, 0.6)', '%');
}

/**
 * Generic bar chart renderer
 * @param {string} canvasId - Canvas element ID
 * @param {Array} labels - X-axis labels
 * @param {Array} data - Data values
 * @param {string} title - Chart title
 * @param {string} color - Bar color (rgba)
 * @param {string} unit - Y-axis unit (optional)
 */
function renderBarChart(canvasId, labels, data, title, color = 'rgba(52, 152, 219, 0.6)', unit = '') {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    destroyChart(canvasId);

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: title,
                data: data,
                backgroundColor: color,
                borderColor: color.replace('0.6', '1'),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: true,
                    text: title
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: unit !== '',
                        text: unit
                    }
                }
            }
        }
    });
}

/**
 * Render correlation heatmap as HTML table
 */
function renderCorrelationHeatmap() {
    const container = document.getElementById('correlation-heatmap');
    if (!container) return;

    // Get numeric columns (limit to key features for readability)
    const numericCols = getNumericColumns(mergedData);

    // Limit to important features to keep heatmap readable
    const importantCols = numericCols.filter(col =>
        col === 'LIMIT_BAL' ||
        col === 'AGE' ||
        col.startsWith('BILL_AMT') ||
        col.startsWith('PAY_AMT')
    ).slice(0, 10);  // Limit to 10 columns for readability

    if (importantCols.length === 0) {
        container.innerHTML = '<p><em>No numeric columns available for correlation analysis.</em></p>';
        return;
    }

    // Calculate correlation
    const corrData = calculateCorrelation(mergedData, importantCols);
    const {matrix, labels} = corrData;

    // Render as HTML table with color coding
    let html = '<table class="heatmap-table"><thead><tr><th></th>';

    // Header row
    labels.forEach(label => {
        html += `<th>${label}</th>`;
    });
    html += '</tr></thead><tbody>';

    // Data rows
    matrix.forEach((row, i) => {
        html += `<tr><th>${labels[i]}</th>`;
        row.forEach(corr => {
            const color = getCorrelationColor(corr);
            html += `<td style="background-color: ${color}; color: ${Math.abs(corr) > 0.5 ? 'white' : 'black'};">`;
            html += corr.toFixed(2);
            html += '</td>';
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

/**
 * Get color for correlation value
 * @param {number} corr - Correlation coefficient (-1 to 1)
 * @returns {string} - RGB color string
 */
function getCorrelationColor(corr) {
    // Red for negative, white for zero, blue for positive
    if (corr < 0) {
        const intensity = Math.floor(Math.abs(corr) * 200 + 55);
        return `rgb(${intensity}, ${255 - intensity}, ${255 - intensity})`;
    } else {
        const intensity = Math.floor(corr * 200 + 55);
        return `rgb(${255 - intensity}, ${255 - intensity}, ${intensity})`;
    }
}

// ========================================
// EXPORT FUNCTIONS
// ========================================

/**
 * Generic CSV export helper (DRY principle)
 * @param {Array} data - Data to export
 * @param {string} filename - Output filename
 * @returns {boolean} - Success status
 */
function exportDataAsCSV(data, filename) {
    if (!data || data.length === 0) {
        return false;
    }

    try {
        // Get column headers
        const columns = Object.keys(data[0]);

        // Create CSV string
        let csv = columns.join(',') + '\n';

        data.forEach(row => {
            const values = columns.map(col => {
                let value = row[col];

                // Handle null/undefined
                if (value == null) return '';

                // Quote strings that contain commas
                if (typeof value === 'string' && value.includes(',')) {
                    return `"${value}"`;
                }

                return value;
            });

            csv += values.join(',') + '\n';
        });

        // Create blob and download
        const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        return true;

    } catch (error) {
        console.error('Export CSV error:', error);
        return false;
    }
}

/**
 * Export merged/full data as CSV
 * In single-file mode: exports the full original dataset
 * In two-file mode: exports the merged dataset
 */
function exportCSV() {
    let filename = 'credit_card_data.csv';
    let message = '✓ CSV exported successfully!';

    // In single-file mode, clarify it's the full dataset
    if (isSingleFileMode) {
        filename = 'credit_card_full_data.csv';
        message = '✓ Full dataset CSV exported successfully!';
    } else {
        filename = 'credit_card_merged_data.csv';
        message = '✓ Merged CSV exported successfully!';
    }

    const success = exportDataAsCSV(mergedData, filename);

    if (success) {
        showMessage('export-status', message, 'success');
    } else {
        showMessage('export-status', 'No data available to export', 'error');
    }
}

/**
 * Export train data as CSV (single-file mode only)
 */
function exportTrainCSV() {
    if (!isSingleFileMode) {
        showMessage('export-status', 'Train export only available in single-file mode', 'error');
        return;
    }

    const success = exportDataAsCSV(trainData, 'credit_card_train.csv');

    if (success) {
        showMessage('export-status', `✓ Train CSV exported! ${trainData.length} rows with target variable`, 'success');
    } else {
        showMessage('export-status', 'No train data available to export', 'error');
    }
}

/**
 * Export test data as CSV (single-file mode only)
 */
function exportTestCSV() {
    if (!isSingleFileMode) {
        showMessage('export-status', 'Test export only available in single-file mode', 'error');
        return;
    }

    const success = exportDataAsCSV(testData, 'credit_card_test.csv');

    if (success) {
        showMessage('export-status', `✓ Test CSV exported! ${testData.length} rows without target variable`, 'success');
    } else {
        showMessage('export-status', 'No test data available to export', 'error');
    }
}

/**
 * Export statistics summary as JSON
 */
function exportJSON() {
    if (!statistics || Object.keys(statistics).length === 0) {
        showMessage('export-status', 'No statistics available to export', 'error');
        return;
    }

    try {
        // Compile summary
        const summary = {
            metadata: {
                totalRows: mergedData ? mergedData.length : 0,
                totalColumns: mergedData ? Object.keys(mergedData[0]).length : 0,
                exportDate: new Date().toISOString()
            },
            missingValues: statistics.missing,
            numericStatistics: statistics.numeric,
            categoricalStatistics: statistics.categorical,
            groupedStatistics: statistics.grouped,
            correlation: statistics.correlation
        };

        // Convert to JSON string
        const json = JSON.stringify(summary, null, 2);

        // Create blob and download
        const blob = new Blob([json], {type: 'application/json;charset=utf-8;'});
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', 'credit_card_statistics.json');
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showMessage('export-status', '✓ JSON exported successfully!', 'success');

    } catch (error) {
        showMessage('export-status', `Error exporting JSON: ${error.message}`, 'error');
        console.error('Export JSON error:', error);
    }
}

/**
 * Update export section UI based on mode (show/hide auto-split exports)
 */
function updateExportSection() {
    const autoSplitDiv = document.getElementById('auto-split-exports');
    const exportDesc = document.getElementById('export-description');
    const exportCsvBtn = document.getElementById('export-csv-btn');

    if (autoSplitDiv) {
        // Show auto-split export buttons only in single-file mode
        if (isSingleFileMode && trainData && testData) {
            autoSplitDiv.style.display = 'block';
            console.log('Auto-split exports enabled');
        } else {
            autoSplitDiv.style.display = 'none';
            console.log('Auto-split exports disabled (two-file mode or no split)');
        }
    }

    // Update description and button text based on mode
    if (exportDesc) {
        if (isSingleFileMode) {
            exportDesc.textContent = 'Download the full dataset and statistical summary.';
        } else {
            exportDesc.textContent = 'Download the merged dataset and statistical summary.';
        }
    }

    if (exportCsvBtn) {
        if (isSingleFileMode) {
            exportCsvBtn.textContent = 'Export Full CSV';
        } else {
            exportCsvBtn.textContent = 'Export Merged CSV';
        }
    }
}

// ========================================
// MAIN EDA RUNNER
// ========================================

/**
 * Run complete EDA workflow
 */
function runEDA() {
    console.log('Running EDA...');

    try {
        // Update all sections
        updateOverview();
        updateMissingValues();
        updateStatistics();
        updateVisualizations();

        // Show export section and configure based on mode
        toggleSection('export-section', true);
        updateExportSection();

        console.log('EDA complete!');

    } catch (error) {
        console.error('EDA error:', error);
        showMessage('load-status', `Error during EDA: ${error.message}`, 'error');
    }
}

// ========================================
// EVENT LISTENERS
// ========================================

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Credit Card EDA App initialized');

    // Load button
    const loadBtn = document.getElementById('load-btn');
    if (loadBtn) {
        loadBtn.addEventListener('click', handleFileLoad);
    }

    // Export CSV button
    const exportCsvBtn = document.getElementById('export-csv-btn');
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportCSV);
    }

    // Export JSON button
    const exportJsonBtn = document.getElementById('export-json-btn');
    if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', exportJSON);
    }

    // Export Train CSV button (auto-split mode)
    const exportTrainBtn = document.getElementById('export-train-btn');
    if (exportTrainBtn) {
        exportTrainBtn.addEventListener('click', exportTrainCSV);
    }

    // Export Test CSV button (auto-split mode)
    const exportTestBtn = document.getElementById('export-test-btn');
    if (exportTestBtn) {
        exportTestBtn.addEventListener('click', exportTestCSV);
    }

    console.log('Event listeners attached');
});

// ========================================
// END OF APP.JS
// ========================================
