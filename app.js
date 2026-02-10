// State management
const state = {
    curtainHeight: 0, // in mm
    curtainWidth: 0, // in mm
    curtainName: '',
    projectName: '',
    fabricInventory: {
        2100: 0,
        2000: 0,
        1900: 0,
        1500: 0
    },
    diagramLanguage: 'en'
};

// Translation dictionary for diagram labels
const translations = {
    en: {
        totalWidth: 'Total Width',
        curtainHeight: 'Curtain Height',
        panelWidth: 'Panel Width',
        netWidth: 'Net Width',
        fold: 'Fold',
        cm: 'cm'
    },
    he: {
        totalWidth: 'רוחב כולל',
        curtainHeight: 'גובה וילון',
        panelWidth: 'רוחב פאנל',
        netWidth: 'רוחב נקי',
        fold: 'קיפול',
        cm: 'ס"מ'
    },
    ar: {
        totalWidth: 'العرض الإجمالي',
        curtainHeight: 'ارتفاع الستارة',
        panelWidth: 'عرض اللوحة',
        netWidth: 'العرض الصافي',
        fold: 'طية',
        cm: 'سم'
    },
    th: {
        totalWidth: 'ความกว้างรวม',
        curtainHeight: 'ความสูงผ้าม่าน',
        panelWidth: 'ความกว้างแผง',
        netWidth: 'ความกว้างสุทธิ',
        fold: 'พับ',
        cm: 'ซม.'
    }
};

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize quantity displays
    Object.keys(state.fabricInventory).forEach(width => {
        updateQuantityDisplay(parseInt(width));
    });
    initializeEventListeners();
    // Don't calculate automatically - wait for user to click calculate button
});

function initializeEventListeners() {
    // Project name
    const projectNameInput = document.getElementById('project-name');
    if (projectNameInput) {
        projectNameInput.addEventListener('input', (e) => {
            state.projectName = e.target.value.trim();
        });
    }
    
    // Curtain name
    document.getElementById('curtain-name').addEventListener('input', (e) => {
        state.curtainName = e.target.value.trim();
    });

    // Curtain dimensions - don't calculate automatically
    document.getElementById('curtain-height').addEventListener('input', (e) => {
        state.curtainHeight = parseFloat(e.target.value) || 0;
    });

    document.getElementById('curtain-width').addEventListener('input', (e) => {
        state.curtainWidth = parseFloat(e.target.value) || 0;
    });

    // Fabric quantity controls - don't calculate automatically
    document.querySelectorAll('.btn-plus').forEach(btn => {
        btn.addEventListener('click', () => {
            const width = parseInt(btn.dataset.width);
            state.fabricInventory[width]++;
            updateQuantityDisplay(width);
        });
    });

    document.querySelectorAll('.btn-minus').forEach(btn => {
        btn.addEventListener('click', () => {
            const width = parseInt(btn.dataset.width);
            if (state.fabricInventory[width] > 0) {
                state.fabricInventory[width]--;
                updateQuantityDisplay(width);
            }
        });
    });

    // Language selector removed - always use English for diagram labels

    // PDF export button
    const exportBtn = document.getElementById('export-pdf-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToPDF);
    }

    // Calculate button - triggers calculation
    const calculateBtn = document.getElementById('calculate-btn');
    if (calculateBtn) {
        calculateBtn.addEventListener('click', () => {
            calculate();
        });
    }
}

function updateQuantityDisplay(width) {
    const quantityElement = document.querySelector(`.quantity[data-width="${width}"]`);
    if (quantityElement) {
        quantityElement.textContent = state.fabricInventory[width];
    }
}

// Main calculation function
function calculate() {
    const resultsDiv = document.getElementById('results');
    const diagramContainer = document.getElementById('diagram-container');

    // Validate inputs
    if (state.curtainHeight <= 0 || state.curtainWidth <= 0) {
        resultsDiv.innerHTML = '<p class="placeholder">Please enter valid curtain dimensions</p>';
        diagramContainer.innerHTML = '';
        return;
    }

    // Check if any fabric is available
    const totalInventory = Object.values(state.fabricInventory).reduce((sum, qty) => sum + qty, 0);
    if (totalInventory === 0) {
        resultsDiv.innerHTML = '<p class="placeholder">Please add fabric inventory</p>';
        diagramContainer.innerHTML = '';
        return;
    }

    // Find optimal solution
    const solution = findOptimalSolution();

    if (!solution) {
        resultsDiv.innerHTML = '<div class="error-message">No valid solution found. Please check your inventory and curtain dimensions.</div>';
        diagramContainer.innerHTML = '';
        const exportBtn = document.getElementById('export-pdf-btn');
        if (exportBtn) {
            exportBtn.disabled = true;
        }
        return;
    }

    // Display results
    displayResults(solution);
    renderDiagram(solution);
    
    // Enable PDF export button
    const exportBtn = document.getElementById('export-pdf-btn');
    if (exportBtn) {
        exportBtn.disabled = false;
    }
}

/**
 * Find the optimal fabric solution with minimum waste
 * UPDATED: Fixed roll length and added vertical hem allowances
 */
function findOptimalSolution() {
    const totalCurtainWidth = Number(state.curtainWidth); // in mm
    const finishedHeight = Number(state.curtainHeight); // in mm
    const fabricWidths = [2100, 2000, 1900, 1500]; // in mm
    const inventory = state.fabricInventory;

    // --- NEW CONSTANTS ---
    const HEAD_HEM_MM = 50;   // מכפלת עליונה
    const BOTTOM_HEM_MM = 150; // מכפלת תחתונה
    const CUT_HEIGHT = finishedHeight + HEAD_HEM_MM + BOTTOM_HEM_MM; // הגובה לחיתוך כולל מכפלות

    const OUTER_FOLD_MM = 180;
    const INNER_FOLD_MM = 80;

    // --- CORRECTION 1: 50 Meters = 50,000 mm ---
    const ROLL_LENGTH_MM = 50000;

    let bestSolution = null;
    let minWaste = Infinity;

    // Calculate maximum parts based on available inventory
    // Note: Using CUT_HEIGHT instead of finishedHeight for roll calculations
    let maxParts = 2;
    for (const fabricWidthMm of fabricWidths) {
        const availableRolls = Number(inventory[fabricWidthMm]);
        if (availableRolls > 0) {
            const panelsPerRoll = Math.floor(ROLL_LENGTH_MM / CUT_HEIGHT);
            if (panelsPerRoll > 0) {
                maxParts = Math.max(maxParts, availableRolls * panelsPerRoll);
            }
        }
    }
    maxParts = Math.min(maxParts, Math.ceil(totalCurtainWidth / 1500) + 5, 30);

    // Loop over all valid parts values
    for (let parts = 2; parts <= maxParts; parts++) {
        let netWidth = totalCurtainWidth / parts;

        if (netWidth <= 0) continue;

        netWidth = Math.round(netWidth * 10) / 10;

        const outerCutWidth = netWidth + OUTER_FOLD_MM;
        const innerCutWidth = netWidth + INNER_FOLD_MM;

        for (const outerFabricWidthMm of fabricWidths) {
            const outerAvailableRolls = Number(inventory[outerFabricWidthMm]);
            if (outerAvailableRolls === 0) continue;

            const outerFabricWidth = Number(outerFabricWidthMm);

            if (outerCutWidth > outerFabricWidth) continue;

            // Calc based on CUT_HEIGHT
            const outerPanelsPerRoll = Math.floor(ROLL_LENGTH_MM / CUT_HEIGHT);
            if (outerPanelsPerRoll < 1) continue;

            const outerRollsNeeded = Math.ceil(2 / outerPanelsPerRoll);
            if (outerRollsNeeded > outerAvailableRolls) continue;

            for (const innerFabricWidthMm of fabricWidths) {
                const innerAvailableRolls = Number(inventory[innerFabricWidthMm]);
                if (innerAvailableRolls === 0) continue;

                const innerFabricWidth = Number(innerFabricWidthMm);

                if (innerCutWidth > innerFabricWidth) continue;

                // Calc based on CUT_HEIGHT
                const innerPanelsPerRoll = Math.floor(ROLL_LENGTH_MM / CUT_HEIGHT);
                if (innerPanelsPerRoll < 1) continue;

                const innerPanelsNeeded = parts - 2;
                const innerRollsNeeded = innerPanelsNeeded > 0 ? Math.ceil(innerPanelsNeeded / innerPanelsPerRoll) : 0;

                if (innerRollsNeeded > innerAvailableRolls) continue;

                const outerWaste = 2 * (outerFabricWidth - outerCutWidth);
                const innerWaste = innerPanelsNeeded * (innerFabricWidth - innerCutWidth);
                const totalWaste = outerWaste + innerWaste;

                if (totalWaste < 0) continue;

                if (totalWaste < minWaste) {
                    minWaste = totalWaste;
                    bestSolution = {
                        outerFabricWidth: outerFabricWidthMm,
                        innerFabricWidth: innerFabricWidthMm,
                        parts: parts,
                        netWidth: netWidth,
                        outerPanelWidth: outerCutWidth,
                        innerPanelWidth: innerCutWidth,
                        waste: totalWaste,
                        outerRollsNeeded: outerRollsNeeded,
                        innerRollsNeeded: innerRollsNeeded,
                        outerPanelsPerRoll: outerPanelsPerRoll,
                        innerPanelsPerRoll: innerPanelsPerRoll,
                        // Add height info for display/export
                        finishedHeight: finishedHeight,
                        cutHeight: CUT_HEIGHT,
                        headHem: HEAD_HEM_MM,
                        bottomHem: BOTTOM_HEM_MM
                    };
                }
            }
        }
    }

    return bestSolution;
}

// Display calculation results
function displayResults(solution) {
    const resultsDiv = document.getElementById('results');
    
    // Check if solution uses different fabric widths
    const usesDifferentWidths = solution.outerFabricWidth !== solution.innerFabricWidth;
    
    // Display only in mm
    const html = `
        <div class="result-item">
            <strong>Number of Panels:</strong> ${solution.parts}
        </div>
        ${usesDifferentWidths ? `
        <div class="result-item">
            <strong>Outer Panels Fabric:</strong> ${solution.outerFabricWidth} mm
            <br><span style="margin-left: 184px; color: #666;">(${solution.outerRollsNeeded} rolls needed)</span>
        </div>
        <div class="result-item">
            <strong>Inner Panels Fabric:</strong> ${solution.innerFabricWidth} mm
            <br><span style="margin-left: 184px; color: #666;">(${solution.innerRollsNeeded} rolls needed)</span>
        </div>
        ` : `
        <div class="result-item">
            <strong>Fabric Width:</strong> ${solution.outerFabricWidth} mm
            <br><span style="margin-left: 184px; color: #666;">(${solution.outerRollsNeeded + solution.innerRollsNeeded} rolls needed)</span>
        </div>
        `}
        <div class="result-item">
            <strong>Net Width per Panel:</strong> ${solution.netWidth.toFixed(1)} mm
        </div>
        <div class="result-item">
            <strong>Outer Panel Width:</strong> ${solution.outerPanelWidth.toFixed(1)} mm
            <br><span style="margin-left: 184px; color: #666;">(Net: ${solution.netWidth.toFixed(1)} mm after folding)</span>
        </div>
        <div class="result-item">
            <strong>Inner Panel Width:</strong> ${solution.innerPanelWidth.toFixed(1)} mm
            <br><span style="margin-left: 184px; color: #666;">(Net: ${solution.netWidth.toFixed(1)} mm after folding)</span>
        </div>
        <div class="result-item">
            <strong>Total Fabric Waste:</strong> ${solution.waste.toFixed(1)} mm
        </div>
    `;
    
    resultsDiv.innerHTML = html;
}

// Render visual diagram using SVG
function renderDiagram(solution) {
    const container = document.getElementById('diagram-container');
    container.innerHTML = '';

    const t = translations.en;

    const projectName = (state.projectName && state.projectName.trim()) || '';
    const curtainName = (state.curtainName && state.curtainName.trim()) || '';

    // SVG Setup
    const pdfWidthPx = 297 * 3.78;
    const pdfHeightPx = 210 * 3.78;
    const marginPx = 15 * 3.78;

    const FIXED_DIAGRAM_HEIGHT = Math.floor(pdfHeightPx - 2 * marginPx);
    const FIXED_DIAGRAM_WIDTH = Math.floor(pdfWidthPx - 2 * marginPx);
    const gapPixels = 40;

    const panelWidth = Math.floor((FIXED_DIAGRAM_WIDTH - (solution.parts - 1) * gapPixels) / solution.parts);
    const panelHeight = FIXED_DIAGRAM_HEIGHT;
    const gapPx = gapPixels;

    const totalWidthPx = solution.parts * panelWidth + (solution.parts - 1) * gapPx;

    const startX = 80;
    const startY = 10;

    const spaceForLabels = 40;
    const spaceBelowTotalWidth = 100;
    const contentBottomY = startY + panelHeight + spaceForLabels + spaceBelowTotalWidth;

    const viewBoxPaddingX = 200;
    const topSpace = projectName || curtainName ? 60 : 20;
    const extraRightSpace = 150;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 -${topSpace} ${totalWidthPx + viewBoxPaddingX + extraRightSpace} ${contentBottomY + topSpace}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMin meet');
    svg.setAttribute('class', 'diagram-svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    // Defs for dashed lines
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const dashPattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
    dashPattern.setAttribute('id', 'dashPattern');
    dashPattern.setAttribute('patternUnits', 'userSpaceOnUse');
    dashPattern.setAttribute('width', '8');
    dashPattern.setAttribute('height', '8');
    const dashLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    dashLine.setAttribute('x1', '0');
    dashLine.setAttribute('y1', '0');
    dashLine.setAttribute('x2', '8');
    dashLine.setAttribute('y2', '0');
    dashLine.setAttribute('stroke', '#666');
    dashLine.setAttribute('stroke-width', '1.5');
    dashLine.setAttribute('stroke-dasharray', '4,4');
    dashPattern.appendChild(dashLine);
    defs.appendChild(dashPattern);
    svg.appendChild(defs);

    // --- Height Indicator (Left) ---
    const heightLineY = startY;
    const heightLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    heightLine.setAttribute('x1', startX - 30);
    heightLine.setAttribute('y1', heightLineY);
    heightLine.setAttribute('x2', startX - 30);
    heightLine.setAttribute('y2', heightLineY + panelHeight);
    heightLine.setAttribute('stroke', '#000');
    heightLine.setAttribute('stroke-width', '2');
    svg.appendChild(heightLine);

    // Finished Height Label
    const heightLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    heightLabel.setAttribute('x', startX - 35);
    heightLabel.setAttribute('y', heightLineY + panelHeight / 2);
    heightLabel.setAttribute('text-anchor', 'middle');
    heightLabel.setAttribute('dominant-baseline', 'middle');
    heightLabel.setAttribute('transform', `rotate(-90 ${startX - 35} ${heightLineY + panelHeight / 2})`);
    heightLabel.setAttribute('font-size', '12');
    heightLabel.setAttribute('font-weight', '600');
    heightLabel.setAttribute('fill', '#000');
    heightLabel.textContent = `H: ${solution.finishedHeight.toFixed(0)} mm`;
    svg.appendChild(heightLabel);

    // Cut Height Label (Secondary)
    const cutHeightLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    cutHeightLabel.setAttribute('x', startX - 55);
    cutHeightLabel.setAttribute('y', heightLineY + panelHeight / 2);
    cutHeightLabel.setAttribute('text-anchor', 'middle');
    cutHeightLabel.setAttribute('dominant-baseline', 'middle');
    cutHeightLabel.setAttribute('transform', `rotate(-90 ${startX - 55} ${heightLineY + panelHeight / 2})`);
    cutHeightLabel.setAttribute('font-size', '11');
    cutHeightLabel.setAttribute('fill', '#666');
    cutHeightLabel.textContent = `(Cut: ${solution.cutHeight.toFixed(0)} mm)`;
    svg.appendChild(cutHeightLabel);

    // Title
    const centerX = startX + totalWidthPx / 2;
    const nameY = -30;
    let titleText = '';
    if (projectName && curtainName) titleText = `${projectName} - ${curtainName}`;
    else if (projectName) titleText = projectName;
    else if (curtainName) titleText = curtainName;

    if (titleText) {
        const titleTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        titleTextElement.setAttribute('x', centerX);
        titleTextElement.setAttribute('y', nameY);
        titleTextElement.setAttribute('text-anchor', 'middle');
        titleTextElement.setAttribute('font-size', '16');
        titleTextElement.setAttribute('font-weight', 'bold');
        titleTextElement.setAttribute('fill', '#000');
        titleTextElement.textContent = titleText;
        svg.appendChild(titleTextElement);
    }

    // Draw Panels
    let currentX = startX;
    for (let i = 0; i < solution.parts; i++) {
        const isOuter = i === 0 || i === solution.parts - 1;
        const totalWidthMm = isOuter ? solution.outerPanelWidth : solution.innerPanelWidth;

        // Panel Rect
        const panelRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        panelRect.setAttribute('x', currentX);
        panelRect.setAttribute('y', startY);
        panelRect.setAttribute('width', panelWidth);
        panelRect.setAttribute('height', panelHeight);
        panelRect.setAttribute('fill', 'white');
        panelRect.setAttribute('stroke', '#000');
        panelRect.setAttribute('stroke-width', '2');
        svg.appendChild(panelRect);

        // --- Horizontal Hem Lines ---
        const topHemVisualY = startY + 25;
        const topHemLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        topHemLine.setAttribute('x1', currentX);
        topHemLine.setAttribute('y1', topHemVisualY);
        topHemLine.setAttribute('x2', currentX + panelWidth);
        topHemLine.setAttribute('y2', topHemVisualY);
        topHemLine.setAttribute('stroke', '#999');
        topHemLine.setAttribute('stroke-width', '1');
        topHemLine.setAttribute('stroke-dasharray', '3,2');
        svg.appendChild(topHemLine);

        const topHemLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        topHemLabel.setAttribute('x', currentX + panelWidth / 2);
        topHemLabel.setAttribute('y', topHemVisualY - 5);
        topHemLabel.setAttribute('text-anchor', 'middle');
        topHemLabel.setAttribute('font-size', '9');
        topHemLabel.setAttribute('fill', '#999');
        topHemLabel.textContent = "50 mm";
        svg.appendChild(topHemLabel);

        const bottomHemVisualY = startY + panelHeight - 50;
        const bottomHemLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        bottomHemLine.setAttribute('x1', currentX);
        bottomHemLine.setAttribute('y1', bottomHemVisualY);
        bottomHemLine.setAttribute('x2', currentX + panelWidth);
        bottomHemLine.setAttribute('y2', bottomHemVisualY);
        bottomHemLine.setAttribute('stroke', '#999');
        bottomHemLine.setAttribute('stroke-width', '1');
        bottomHemLine.setAttribute('stroke-dasharray', '3,2');
        svg.appendChild(bottomHemLine);

        const bottomHemLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        bottomHemLabel.setAttribute('x', currentX + panelWidth / 2);
        bottomHemLabel.setAttribute('y', bottomHemVisualY + 15);
        bottomHemLabel.setAttribute('text-anchor', 'middle');
        bottomHemLabel.setAttribute('font-size', '9');
        bottomHemLabel.setAttribute('fill', '#999');
        bottomHemLabel.textContent = "150 mm";
        svg.appendChild(bottomHemLabel);

        // --- Fold Lines (Vertical) ---
        const OUTER_FOLD_MM = 140;
        const INNER_FOLD_MM = 40;
        let leftFoldX, rightFoldX;

        const foldScale = panelWidth / totalWidthMm;

        if (isOuter) {
            if (i === 0) {
                leftFoldX = currentX + OUTER_FOLD_MM * foldScale;
                rightFoldX = currentX + panelWidth - INNER_FOLD_MM * foldScale;
            } else {
                leftFoldX = currentX + INNER_FOLD_MM * foldScale;
                rightFoldX = currentX + panelWidth - OUTER_FOLD_MM * foldScale;
            }
        } else {
            leftFoldX = currentX + INNER_FOLD_MM * foldScale;
            rightFoldX = currentX + panelWidth - INNER_FOLD_MM * foldScale;
        }

        // Draw folds
        const drawFold = (x, label, anchor) => {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x);
            line.setAttribute('y1', startY);
            line.setAttribute('x2', x);
            line.setAttribute('y2', startY + panelHeight);
            line.setAttribute('stroke', '#666');
            line.setAttribute('stroke-width', '1.5');
            line.setAttribute('stroke-dasharray', '4,4');
            svg.appendChild(line);

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x);
            text.setAttribute('y', startY - 2);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '10');
            text.setAttribute('font-weight', '600');
            text.setAttribute('fill', '#666');
            text.textContent = label;
            svg.appendChild(text);
        };

        if (isOuter && i === 0) {
            drawFold(leftFoldX, '', 'middle');
            const lText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            lText.setAttribute('x', currentX);
            lText.setAttribute('y', startY - 2);
            lText.setAttribute('font-size', '10');
            lText.setAttribute('font-weight', '600');
            lText.setAttribute('fill', '#666');
            lText.textContent = "140 mm";
            svg.appendChild(lText);
            drawFold(rightFoldX, "40 mm", 'middle');
        } else if (isOuter && i === solution.parts - 1) {
            drawFold(leftFoldX, "40 mm", 'middle');
            drawFold(rightFoldX, "140 mm", 'middle');
        } else {
            drawFold(leftFoldX, "40 mm", 'middle');
            drawFold(rightFoldX, "40 mm", 'middle');
        }

        // Net Width Indicator
        const netWidthLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        netWidthLine.setAttribute('x1', leftFoldX);
        netWidthLine.setAttribute('y1', startY + panelHeight / 2);
        netWidthLine.setAttribute('x2', rightFoldX);
        netWidthLine.setAttribute('y2', startY + panelHeight / 2);
        netWidthLine.setAttribute('stroke', '#666');
        netWidthLine.setAttribute('stroke-width', '1.5');
        netWidthLine.setAttribute('stroke-dasharray', '4,4');
        svg.appendChild(netWidthLine);

        const netWidthLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        netWidthLabel.setAttribute('x', (leftFoldX + rightFoldX) / 2);
        netWidthLabel.setAttribute('y', startY + panelHeight / 2 - 8);
        netWidthLabel.setAttribute('text-anchor', 'middle');
        netWidthLabel.setAttribute('font-size', '10');
        netWidthLabel.setAttribute('font-weight', '600');
        netWidthLabel.setAttribute('fill', '#666');
        netWidthLabel.textContent = `${solution.netWidth.toFixed(1)} mm`;
        svg.appendChild(netWidthLabel);

        // Panel Width Label
        const panelWidthLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        panelWidthLabel.setAttribute('x', currentX + panelWidth / 2);
        panelWidthLabel.setAttribute('y', startY + panelHeight + 25);
        panelWidthLabel.setAttribute('text-anchor', 'middle');
        panelWidthLabel.setAttribute('font-size', '12');
        panelWidthLabel.setAttribute('font-weight', '600');
        panelWidthLabel.setAttribute('fill', '#000');
        panelWidthLabel.textContent = `${totalWidthMm.toFixed(1)} mm`;
        svg.appendChild(panelWidthLabel);

        // Raw Material Label
        const rawMaterialLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        const fabW = isOuter ? solution.outerFabricWidth : solution.innerFabricWidth;
        rawMaterialLabel.setAttribute('x', currentX + panelWidth / 2);
        rawMaterialLabel.setAttribute('y', startY + panelHeight / 2 - 70);
        rawMaterialLabel.setAttribute('text-anchor', 'middle');
        rawMaterialLabel.setAttribute('font-size', '14');
        rawMaterialLabel.setAttribute('font-weight', 'bold');
        rawMaterialLabel.setAttribute('fill', '#000');
        rawMaterialLabel.textContent = `Raw: ${fabW} mm`;
        svg.appendChild(rawMaterialLabel);

        currentX += panelWidth + gapPx;
    }

    // Total Width Line
    const panelWidthLabelY = startY + panelHeight + 25;
    const totalWidthLineY = panelWidthLabelY + 70;
    const totalWidthLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    totalWidthLine.setAttribute('x1', startX);
    totalWidthLine.setAttribute('y1', totalWidthLineY);
    totalWidthLine.setAttribute('x2', startX + totalWidthPx);
    totalWidthLine.setAttribute('y2', totalWidthLineY);
    totalWidthLine.setAttribute('stroke', '#000');
    totalWidthLine.setAttribute('stroke-width', '2');
    svg.appendChild(totalWidthLine);

    const totalWidthLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    totalWidthLabel.setAttribute('x', startX + totalWidthPx / 2);
    totalWidthLabel.setAttribute('y', totalWidthLineY - 5);
    totalWidthLabel.setAttribute('text-anchor', 'middle');
    totalWidthLabel.setAttribute('font-size', '14');
    totalWidthLabel.setAttribute('font-weight', '600');
    totalWidthLabel.setAttribute('fill', '#000');
    totalWidthLabel.textContent = `${t.totalWidth}: ${state.curtainWidth.toFixed(0)} mm`;
    svg.appendChild(totalWidthLabel);

    // --- Helper for Image Circles ---
    const addImageCircle = (x, y, imagePath, circleId) => {
        const circleRadius = 32;
        const maxImageSize = circleRadius * 1.8;
        const baseImageSize = 54;
        const imageSize = Math.min(baseImageSize * 1.2, maxImageSize);

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x.toString());
        circle.setAttribute('cy', y.toString());
        circle.setAttribute('r', circleRadius.toString());
        circle.setAttribute('fill', 'white');
        circle.setAttribute('stroke', '#000');
        circle.setAttribute('stroke-width', '2');
        svg.appendChild(circle);

        const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        clipPath.setAttribute('id', `clipCircle_${circleId}_${x}_${y}`);
        clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse');
        const clipCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        clipCircle.setAttribute('cx', x.toString());
        clipCircle.setAttribute('cy', y.toString());
        clipCircle.setAttribute('r', circleRadius.toString());
        clipPath.appendChild(clipCircle);

        const existingDefs = svg.querySelector('defs') || defs;
        existingDefs.appendChild(clipPath);

        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttribute('x', (x - imageSize / 2).toString());
        img.setAttribute('y', (y - imageSize / 2).toString());
        img.setAttribute('width', imageSize.toString());
        img.setAttribute('height', imageSize.toString());
        img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        img.setAttribute('clip-path', `url(#clipCircle_${circleId}_${x}_${y})`);

        loadImageAsBase64(imagePath).then(base64 => {
            if (base64) {
                img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', base64);
                img.setAttribute('href', base64);
            }
        }).catch(() => {
            img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', imagePath);
            img.setAttribute('href', imagePath);
        });
        svg.appendChild(img);
    };

    // --- Placing Detail Circles on Side Ribs ---
    const bottomY = startY + panelHeight;
    const detailY = bottomY - 50;

    let panelX = startX;

    for (let i = 0; i < solution.parts; i++) {
        const isOuter = i === 0 || i === solution.parts - 1;
        const displayPanelWidth = (FIXED_DIAGRAM_WIDTH - (solution.parts - 1) * gapPixels) / solution.parts;

        const leftX = panelX;
        const rightX = panelX + displayPanelWidth;

        if (isOuter) {
            if (i === 0) {
                addImageCircle(leftX, detailY, '1.jpg', `1_${i}_left`);
                if (solution.parts > 1) {
                    addImageCircle(rightX, detailY, '2.png', `2_${i}_right`);
                } else {
                    addImageCircle(rightX, detailY, '1.jpg', `1_${i}_right`);
                }
            } else {
                addImageCircle(leftX, detailY, '2.png', `2_${i}_left`);
                addImageCircle(rightX, detailY, '1.jpg', `1_${i}_right`);
            }
        } else {
            addImageCircle(leftX, detailY, '2.png', `2_${i}_left`);
            addImageCircle(rightX, detailY, '2.png', `2_${i}_right`);
        }

        panelX += displayPanelWidth + gapPx;
    }

    state.diagramSVG = svg;
    state.diagramSolution = solution;
    container.appendChild(svg);
}

// Helper function to load image and convert to base64 for PDF compatibility
function loadImageAsBase64(imagePath) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        // Try different paths
        const paths = [
            imagePath,
            `./${imagePath}`,
            `/${imagePath}`,
            `${window.location.origin}/${imagePath}`
        ];
        
        let currentPathIndex = 0;
        
        const tryNextPath = () => {
            if (currentPathIndex >= paths.length) {
                reject(new Error('All image paths failed'));
                return;
            }
            
            const path = paths[currentPathIndex++];
            
            img.onload = function() {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    const base64 = canvas.toDataURL('image/png');
                    resolve(base64);
                } catch (error) {
                    console.warn('Failed to convert image to base64:', error);
                    tryNextPath(); // Try next path on conversion error
                }
            };
            
            img.onerror = function() {
                tryNextPath(); // Try next path on load error
            };
            
            img.src = path;
        };
        
        tryNextPath();
    });
}

// Export diagram to PDF using html2canvas for Unicode support
async function exportToPDF() {
    if (!state.diagramSVG || !state.diagramSolution) {
        return;
    }
    
    // Check if html2canvas is available
    if (typeof html2canvas === 'undefined') {
        alert('html2canvas library is required for PDF export. Please wait for it to load.');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const solution = state.diagramSolution;
    const lang = state.diagramLanguage;
    
    // Get the SVG container
    const container = document.getElementById('diagram-container');
    const svgElement = container.querySelector('svg');
    
    if (!svgElement) {
        alert('No diagram to export');
        return;
    }
    
    // Create a temporary container for rendering
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.width = '1200px'; // Fixed width for consistent rendering
    tempContainer.style.backgroundColor = 'white';
    document.body.appendChild(tempContainer);
    
    // Clone the SVG
    const clonedSvg = svgElement.cloneNode(true);
    tempContainer.appendChild(clonedSvg);
    
    try {
        // Wait for images to load before capturing
        const images = tempContainer.querySelectorAll('image');
        const imagePromises = Array.from(images).map(img => {
            return new Promise((resolve) => {
                const imgElement = new Image();
                imgElement.crossOrigin = 'anonymous';
                imgElement.onload = () => {
                    // Image loaded successfully, update SVG image element
                    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', imgElement.src);
                    resolve();
                };
                imgElement.onerror = () => {
                    // Image failed to load, but continue anyway
                    console.warn('Image failed to load:', img.getAttribute('href') || img.getAttributeNS('http://www.w3.org/1999/xlink', 'href'));
                    resolve();
                };
                // Try both href and xlink:href
                const href = img.getAttribute('href') || 
                            img.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ||
                            img.getAttribute('xlink:href');
                if (href) {
                    // Use absolute path if relative
                    const imagePath = href.startsWith('http') ? href : 
                                     (href.startsWith('/') ? href : `./${href}`);
                    imgElement.src = imagePath;
                } else {
                    resolve(); // No href, skip
                }
            });
        });
        await Promise.all(imagePromises);
        
        // Give browser time to render images in SVG
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Convert SVG to canvas using html2canvas (supports Unicode)
        const canvas = await html2canvas(tempContainer, {
            backgroundColor: '#ffffff',
            scale: 2, // Higher quality
            useCORS: true,
            allowTaint: true, // Allow loading external images
            logging: false
        });
        
        // Clean up temporary container
        document.body.removeChild(tempContainer);
        
        // Create PDF
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });
        
        // A4 landscape: 297mm x 210mm
        const pdfWidth = 297;
        const pdfHeight = 210;
        const margin = 5; // Minimal margin to maximize diagram size
        
        // Project name and curtain name are now included in the SVG (captured by html2canvas)
        // No need to add them separately to PDF - they're already in the image
        const topMargin = 5; // Minimal top margin since names are in SVG
        
        // Calculate dimensions to fit canvas in PDF - maximize size
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const canvasAspectRatio = canvasWidth / canvasHeight;
        
        // Use full width available (no roll info on the right)
        const availableWidth = pdfWidth - margin * 2;
        const availableHeight = pdfHeight - topMargin - margin;
        
        const pdfAspectRatio = availableWidth / availableHeight;
        
        let imgWidth, imgHeight;
        if (canvasAspectRatio > pdfAspectRatio) {
            // Canvas is wider - fit to width (fill available width)
            imgWidth = availableWidth;
            imgHeight = imgWidth / canvasAspectRatio;
    } else {
            // Canvas is taller - fit to height (fill entire height)
            imgHeight = availableHeight;
            imgWidth = imgHeight * canvasAspectRatio;
        }
        
        // Position the image on the left, leaving space on the right for roll info
        const x = margin;
        const y = topMargin; // Position below project/curtain names
        
        // Convert canvas to image data
        const imgData = canvas.toDataURL('image/png');
        
        // Add image to PDF
        pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
        
        // Generate PDF filename with curtain name
        const filenameCurtainName = state.curtainName.trim() || 'Curtain';
        const filename = `${filenameCurtainName}_חישוב_בדים.pdf`;
        
        // Save PDF
        pdf.save(filename);
    } catch (error) {
        console.error('Error exporting PDF:', error);
        alert('Error exporting PDF. Please try again.');
        // Clean up on error
        if (document.body.contains(tempContainer)) {
            document.body.removeChild(tempContainer);
        }
    }
}

// Helper function to draw dashed lines in PDF
function drawDashedLine(pdf, x1, y1, x2, y2) {
    const dashLength = 2;
    const gapLength = 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.floor(distance / (dashLength + gapLength));
    const stepX = dx / steps;
    const stepY = dy / steps;
    
    for (let i = 0; i < steps; i++) {
        const startX = x1 + i * stepX;
        const startY = y1 + i * stepY;
        const endX = startX + stepX * (dashLength / (dashLength + gapLength));
        const endY = startY + stepY * (dashLength / (dashLength + gapLength));
        pdf.line(startX, startY, endX, endY);
    }
}

