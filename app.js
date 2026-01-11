// State management
const state = {
    curtainHeight: 0, // in mm
    curtainWidth: 0, // in mm
    curtainName: '',
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

    // Language selector - only update diagram if already calculated
    const languageSelect = document.getElementById('diagram-language');
    if (languageSelect) {
        languageSelect.addEventListener('change', (e) => {
            state.diagramLanguage = e.target.value;
            const solution = findOptimalSolution();
            if (solution) {
                renderDiagram(solution);
            }
        });
    }

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
 * 
 * Algorithm:
 * 1. Loop over all fabric widths that exist in inventory
 * 2. For each fabric width, loop over all valid parts values (2 to inventory[fabricWidth])
 * 3. For each combination, validate folding rules and calculate waste
 * 4. Select the solution with minimum total waste
 * 
 * @returns {Object|null} Solution object with fabricWidth, parts, netWidth, outerPanelWidth, innerPanelWidth, waste
 */
function findOptimalSolution() {
    const totalCurtainWidth = Number(state.curtainWidth); // in mm - ensure number
    const fabricWidths = [2100, 2000, 1900, 1500]; // in mm
    const inventory = state.fabricInventory;

    // Fold values in mm: 140mm (outer edge) + 40mm (inner edge) = 180mm
    const OUTER_FOLD_MM = 180; // 140 mm (outer edge) + 40 mm (inner edge) = 180 mm
    const INNER_FOLD_MM = 80;  // 40 mm on each side = 80 mm

    let bestSolution = null;
    let minWaste = Infinity;

    // Loop over all fabric widths that exist in inventory
    for (const fabricWidthMm of fabricWidths) {
        const availableRolls = Number(inventory[fabricWidthMm]); // Ensure number
        
        // Skip if no inventory available
        if (!availableRolls || availableRolls === 0) {
            continue;
        }
        
        const fabricWidth = Number(fabricWidthMm); // Already in mm
        
        // For each fabric width, loop over all valid parts values
        // Test from 2 up to availableRolls
        // Also test more parts to ensure we find a solution
        const maxPartsToTest = Math.max(availableRolls, Math.min(Math.ceil(totalCurtainWidth / fabricWidth) + 5, 30));
        
        for (let parts = 2; parts <= maxPartsToTest; parts++) {
            // Skip if we don't have enough rolls
            if (parts > availableRolls) {
                continue;
            }
            
            // Calculate net width per panel
            // The totalCurtainWidth is the NET width (after all folds)
            // All panels have the same net width after folding
            // So: totalCurtainWidth (net) = parts * netWidth
            // Therefore: netWidth = totalCurtainWidth / parts
            let netWidth = totalCurtainWidth / parts;
            
            // Check for invalid netWidth (negative or zero)
            if (netWidth <= 0) {
                continue;
            }
            
            // Round netWidth to 1 decimal place (allow decimal values for real-world fabric cutting)
            netWidth = Math.round(netWidth * 10) / 10;
            
            // Calculate cut widths (different for outer and inner panels) - all in mm
            const outerCutWidth = netWidth + OUTER_FOLD_MM; // netWidth + 180 mm
            const innerCutWidth = netWidth + INNER_FOLD_MM;  // netWidth + 80 mm
            
            // Validate that cut widths fit within fabric width (all in mm)
            if (outerCutWidth > fabricWidth || innerCutWidth > fabricWidth) {
                continue;
            }
            
            // Calculate fabric waste per panel, then sum (all in mm)
            // waste = 2 * (fabricWidth - outerCutWidth) + (parts - 2) * (fabricWidth - innerCutWidth)
            const waste = 2 * (fabricWidth - outerCutWidth) + (parts - 2) * (fabricWidth - innerCutWidth);
            
            // Only consider solutions with non-negative waste
            if (waste < 0) {
                continue;
            }

            // Check if this is a better solution (lower waste is better)
            if (waste < minWaste) {
                minWaste = waste;
                bestSolution = {
                    fabricWidth: fabricWidthMm,
                    parts: parts,
                    netWidth: netWidth, // in mm
                    outerPanelWidth: outerCutWidth,  // in mm
                    innerPanelWidth: innerCutWidth,  // in mm
                    waste: waste // in mm
                };
            }
        }
    }

    return bestSolution;
}

// Display calculation results
function displayResults(solution) {
    const resultsDiv = document.getElementById('results');
    
    // Display only in mm
    const html = `
        <div class="result-item">
            <strong>Selected Fabric Width:</strong> ${solution.fabricWidth} mm
        </div>
        <div class="result-item">
            <strong>Number of Panels:</strong> ${solution.parts}
        </div>
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
    
    const lang = state.diagramLanguage;
    const t = translations[lang] || translations.en;
    const isRTL = lang === 'he' || lang === 'ar';
    
    // Get container dimensions to use full available space
    const containerRect = container.getBoundingClientRect();
    const maxWidth = containerRect.width || 1200; // Fallback if container not ready
    const maxHeight = containerRect.height || 600; // Fallback if container not ready
    
    // All values are in mm
    const totalCurtainWidthMm = 2 * solution.outerPanelWidth + (solution.parts - 2) * solution.innerPanelWidth;
    const gapPixels = 40; // Fixed gap between panels in pixels (consistent spacing regardless of scale)
    const totalWidthMm = totalCurtainWidthMm;
    const curtainHeightMm = state.curtainHeight;
    
    // Scale to fit container (use full available space, maximize scale)
    const margin = 60; // Reduced margins for labels to maximize diagram size
    const availableWidth = maxWidth - margin * 2 - (solution.parts - 1) * gapPixels;
    const availableHeight = maxHeight - margin * 2;
    const scaleX = availableWidth / totalWidthMm;
    const scaleY = availableHeight / curtainHeightMm;
    const scale = Math.min(scaleX, scaleY) * 0.95; // Use 95% of available space to ensure everything fits
    
    // Calculate dimensions in pixels (all in mm, scale directly)
    const panelHeight = curtainHeightMm * scale;
    const outerPanelWidth = solution.outerPanelWidth * scale;
    const innerPanelWidth = solution.innerPanelWidth * scale;
    const gapPx = gapPixels; // Fixed gap in pixels (not scaled, consistent spacing)
    
    // Calculate total diagram dimensions
    const totalWidthPx = 2 * outerPanelWidth + (solution.parts - 2) * innerPanelWidth + (solution.parts - 1) * gapPx;
    const totalHeightPx = panelHeight + 150; // Extra space for labels
    
    // Create SVG element - use full container width
    // Adjust viewBox to move content up and prevent cutting
    const viewBoxPaddingX = 200; // Extra space for height indicator
    const viewBoxPaddingY = 80; // Reduced top padding to move content up
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${totalWidthPx + viewBoxPaddingX} ${totalHeightPx + viewBoxPaddingY}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('class', 'diagram-svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (isRTL) {
        svg.setAttribute('dir', 'rtl');
    }
    
    // Define defs for patterns (dashed lines)
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
    
    // Starting position (with margin for height indicator) - move up to prevent cutting
    const startX = 80;
    const startY = 40; // Moved up to prevent cutting at top
    
    // Draw height indicator (vertical line on the left)
    const heightLineY = startY;
    const heightLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    heightLine.setAttribute('x1', startX - 30);
    heightLine.setAttribute('y1', heightLineY);
    heightLine.setAttribute('x2', startX - 30);
    heightLine.setAttribute('y2', heightLineY + panelHeight);
    heightLine.setAttribute('stroke', '#000');
    heightLine.setAttribute('stroke-width', '2');
    svg.appendChild(heightLine);
    
    // Height label
    const heightLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    heightLabel.setAttribute('x', startX - 35);
    heightLabel.setAttribute('y', heightLineY + panelHeight / 2);
    heightLabel.setAttribute('text-anchor', 'middle');
    heightLabel.setAttribute('dominant-baseline', 'middle');
    heightLabel.setAttribute('transform', `rotate(-90 ${startX - 35} ${heightLineY + panelHeight / 2})`);
    heightLabel.setAttribute('font-size', '12');
    heightLabel.setAttribute('font-weight', '600');
    heightLabel.setAttribute('fill', '#000');
    // Display only in mm
    heightLabel.textContent = `${state.curtainHeight.toFixed(0)} mm`;
    svg.appendChild(heightLabel);
    
    // Draw total width line (above panels)
    const totalWidthLineY = startY - 40;
    const totalWidthLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    totalWidthLine.setAttribute('x1', startX);
    totalWidthLine.setAttribute('y1', totalWidthLineY);
    totalWidthLine.setAttribute('x2', startX + totalWidthPx);
    totalWidthLine.setAttribute('y2', totalWidthLineY);
    totalWidthLine.setAttribute('stroke', '#000');
    totalWidthLine.setAttribute('stroke-width', '2');
    svg.appendChild(totalWidthLine);
    
    // Total width label (centered) - display only in mm
    const totalWidthLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    totalWidthLabel.setAttribute('x', startX + totalWidthPx / 2);
    totalWidthLabel.setAttribute('y', totalWidthLineY - 10);
    totalWidthLabel.setAttribute('text-anchor', 'middle');
    totalWidthLabel.setAttribute('font-size', '14');
    totalWidthLabel.setAttribute('font-weight', '600');
    totalWidthLabel.setAttribute('fill', '#000');
    if (isRTL) {
        totalWidthLabel.setAttribute('direction', 'rtl');
    }
    totalWidthLabel.textContent = `${t.totalWidth}: ${state.curtainWidth.toFixed(0)} mm`;
    svg.appendChild(totalWidthLabel);
    
    // Draw panels
    let currentX = startX;
    for (let i = 0; i < solution.parts; i++) {
        const isOuter = i === 0 || i === solution.parts - 1;
        const panelWidth = isOuter ? outerPanelWidth : innerPanelWidth;
        const totalWidth = isOuter ? solution.outerPanelWidth : solution.innerPanelWidth;

        // Panel rectangle (white fill, black border)
        const panelRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        panelRect.setAttribute('x', currentX);
        panelRect.setAttribute('y', startY);
        panelRect.setAttribute('width', panelWidth);
        panelRect.setAttribute('height', panelHeight);
        panelRect.setAttribute('fill', 'white');
        panelRect.setAttribute('stroke', '#000');
        panelRect.setAttribute('stroke-width', '2');
        svg.appendChild(panelRect);
        
        // Fold lines (dashed vertical lines) - values in mm
        // Outer panels: 140mm (outer edge) + 40mm (inner edge) = 180mm total
        // Inner panels: 40mm on each side = 80mm total
        const OUTER_FOLD_MM = 140; // 140mm (outer edge)
        const INNER_FOLD_MM = 40;  // 40mm (inner edge or both sides for inner panels)
        let leftFoldX, rightFoldX;
        
        if (isOuter) {
            if (i === 0) {
                // Left outer panel: 140mm fold on left (outer edge), 40mm fold on right (inner edge)
                leftFoldX = currentX; // Left edge of panel
                rightFoldX = currentX + panelWidth - INNER_FOLD_MM * scale; // 40mm from right edge
            } else {
                // Right outer panel: 40mm fold on left (inner edge), 140mm fold on right (outer edge)
                leftFoldX = currentX; // Left edge of panel (40mm fold)
                rightFoldX = currentX + panelWidth - OUTER_FOLD_MM * scale; // 140mm from right edge
            }
        } else {
            // Inner panel: 40mm on each side
            leftFoldX = currentX; // Left edge
            rightFoldX = currentX + panelWidth - INNER_FOLD_MM * scale; // 40mm from right edge
        }
        
        // Add dashed lines along the length of the panel (left and right edges)
        // Move left edge line slightly to the right to avoid merging with panel border
        const leftEdgeOffset = 3; // Offset in pixels to separate from border
        const leftEdgeLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        leftEdgeLine.setAttribute('x1', currentX + leftEdgeOffset);
        leftEdgeLine.setAttribute('y1', startY);
        leftEdgeLine.setAttribute('x2', currentX + leftEdgeOffset);
        leftEdgeLine.setAttribute('y2', startY + panelHeight);
        leftEdgeLine.setAttribute('stroke', '#666');
        leftEdgeLine.setAttribute('stroke-width', '1.5');
        leftEdgeLine.setAttribute('stroke-dasharray', '4,4');
        svg.appendChild(leftEdgeLine);
        
        const rightEdgeLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        rightEdgeLine.setAttribute('x1', currentX + panelWidth);
        rightEdgeLine.setAttribute('y1', startY);
        rightEdgeLine.setAttribute('x2', currentX + panelWidth);
        rightEdgeLine.setAttribute('y2', startY + panelHeight);
        rightEdgeLine.setAttribute('stroke', '#666');
        rightEdgeLine.setAttribute('stroke-width', '1.5');
        rightEdgeLine.setAttribute('stroke-dasharray', '4,4');
        svg.appendChild(rightEdgeLine);
        
        // Draw left fold line
        const leftFoldLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        leftFoldLine.setAttribute('x1', leftFoldX);
        leftFoldLine.setAttribute('y1', startY);
        leftFoldLine.setAttribute('x2', leftFoldX);
        leftFoldLine.setAttribute('y2', startY + panelHeight);
        leftFoldLine.setAttribute('stroke', '#666');
        leftFoldLine.setAttribute('stroke-width', '1.5');
        leftFoldLine.setAttribute('stroke-dasharray', '4,4');
        svg.appendChild(leftFoldLine);
        
        // Left fold label
        const leftFoldLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        leftFoldLabel.setAttribute('x', leftFoldX);
        leftFoldLabel.setAttribute('y', startY - 5);
        leftFoldLabel.setAttribute('text-anchor', isRTL ? 'end' : 'middle');
        leftFoldLabel.setAttribute('font-size', '10');
        leftFoldLabel.setAttribute('font-weight', '600');
        leftFoldLabel.setAttribute('fill', '#666');
        if (isRTL) {
            leftFoldLabel.setAttribute('direction', 'rtl');
        }
        if (isOuter && i === 0) {
            leftFoldLabel.textContent = `140 mm`;
        } else if (isOuter && i === solution.parts - 1) {
            leftFoldLabel.textContent = `40 mm`;
        } else {
            leftFoldLabel.textContent = `40 mm`;
        }
        svg.appendChild(leftFoldLabel);
        
        // Draw right fold line
        const rightFoldLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        rightFoldLine.setAttribute('x1', rightFoldX);
        rightFoldLine.setAttribute('y1', startY);
        rightFoldLine.setAttribute('x2', rightFoldX);
        rightFoldLine.setAttribute('y2', startY + panelHeight);
        rightFoldLine.setAttribute('stroke', '#666');
        rightFoldLine.setAttribute('stroke-width', '1.5');
        rightFoldLine.setAttribute('stroke-dasharray', '4,4');
        svg.appendChild(rightFoldLine);
        
        // Right fold label
        const rightFoldLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        rightFoldLabel.setAttribute('x', rightFoldX);
        rightFoldLabel.setAttribute('y', startY - 5);
        rightFoldLabel.setAttribute('text-anchor', isRTL ? 'end' : 'middle');
        rightFoldLabel.setAttribute('font-size', '10');
        rightFoldLabel.setAttribute('font-weight', '600');
        rightFoldLabel.setAttribute('fill', '#666');
        if (isRTL) {
            rightFoldLabel.setAttribute('direction', 'rtl');
        }
        if (isOuter && i === 0) {
            rightFoldLabel.textContent = `40 mm`;
        } else if (isOuter && i === solution.parts - 1) {
            rightFoldLabel.textContent = `140 mm`;
        } else {
            rightFoldLabel.textContent = `40 mm`;
        }
        svg.appendChild(rightFoldLabel);
        
        // Net width line (horizontal dashed line strictly between the two fold lines)
        // The net width is the area between the folded edges
        // For outer panels: net width starts after 140mm (left) or 40mm (right), ends before 40mm (left) or 140mm (right)
        // For inner panels: net width starts after 40mm, ends before 40mm
        let netWidthStartX, netWidthEndX;
        if (isOuter && i === 0) {
            // Left outer: after 140mm fold, before 40mm fold
            netWidthStartX = currentX + OUTER_FOLD_MM * scale;
            netWidthEndX = currentX + panelWidth - INNER_FOLD_MM * scale;
        } else if (isOuter && i === solution.parts - 1) {
            // Right outer: after 40mm fold, before 140mm fold
            netWidthStartX = currentX + INNER_FOLD_MM * scale;
            netWidthEndX = currentX + panelWidth - OUTER_FOLD_MM * scale;
        } else {
            // Inner: after 40mm fold, before 40mm fold
            netWidthStartX = currentX + INNER_FOLD_MM * scale;
            netWidthEndX = currentX + panelWidth - INNER_FOLD_MM * scale;
        }
        const netWidthLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        netWidthLine.setAttribute('x1', netWidthStartX);
        netWidthLine.setAttribute('y1', startY + panelHeight / 2);
        netWidthLine.setAttribute('x2', netWidthEndX);
        netWidthLine.setAttribute('y2', startY + panelHeight / 2);
        netWidthLine.setAttribute('stroke', '#666');
        netWidthLine.setAttribute('stroke-width', '1.5');
        netWidthLine.setAttribute('stroke-dasharray', '4,4');
        svg.appendChild(netWidthLine);
        
        // Net width label
        const netWidthLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        netWidthLabel.setAttribute('x', (netWidthStartX + netWidthEndX) / 2);
        netWidthLabel.setAttribute('y', startY + panelHeight / 2 - 8);
        netWidthLabel.setAttribute('text-anchor', 'middle');
        netWidthLabel.setAttribute('font-size', '10');
        netWidthLabel.setAttribute('font-weight', '600');
        netWidthLabel.setAttribute('fill', '#666');
        if (isRTL) {
            netWidthLabel.setAttribute('direction', 'rtl');
        }
        // Display only in mm
        netWidthLabel.textContent = `${solution.netWidth.toFixed(1)} mm`;
        svg.appendChild(netWidthLabel);
        
        // Panel width label (below panel, centered) - display only in mm
        const panelWidthLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        panelWidthLabel.setAttribute('x', currentX + panelWidth / 2);
        panelWidthLabel.setAttribute('y', startY + panelHeight + 25);
        panelWidthLabel.setAttribute('text-anchor', 'middle');
        panelWidthLabel.setAttribute('font-size', '12');
        panelWidthLabel.setAttribute('font-weight', '600');
        panelWidthLabel.setAttribute('fill', '#000');
        if (isRTL) {
            panelWidthLabel.setAttribute('direction', 'rtl');
        }
        // Display only the number, without "Panel Width" text
        panelWidthLabel.textContent = `${totalWidth.toFixed(1)} mm`;
        svg.appendChild(panelWidthLabel);
        
        // Move to next panel
        currentX += panelWidth + gapPx;
    }
    
    // Store SVG reference for PDF export
    state.diagramSVG = svg;
    state.diagramSolution = solution;
    
    container.appendChild(svg);
}

// Export diagram to PDF
function exportToPDF() {
    if (!state.diagramSVG || !state.diagramSolution) {
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });
    
    const solution = state.diagramSolution;
    const lang = state.diagramLanguage;
    const t = translations[lang] || translations.en;
    const isRTL = lang === 'he' || lang === 'ar';
    
    // A4 landscape: 297mm x 210mm
    const pdfWidth = 297;
    const pdfHeight = 210;
    
    // All values are in mm
    const totalCurtainWidthMm = 2 * solution.outerPanelWidth + (solution.parts - 2) * solution.innerPanelWidth;
    const gap = 20; // Gap between panels in mm
    const totalWidthMm = totalCurtainWidthMm + (solution.parts - 1) * gap;
    const curtainHeightMm = state.curtainHeight;
    
    // Scale to fit in PDF with margins (all in mm)
    const margin = 20; // 20mm margins
    const scaleX = (pdfWidth - margin * 2) / totalWidthMm;
    const scaleY = (pdfHeight - margin * 2) / curtainHeightMm;
    const scale = Math.min(scaleX, scaleY);
    
    // Calculate dimensions in mm (already in mm, just scale)
    const panelHeight = curtainHeightMm * scale;
    const outerPanelWidth = solution.outerPanelWidth * scale;
    const innerPanelWidth = solution.innerPanelWidth * scale;
    const gapPx = gap * scale;
    
    const totalWidthPx = 2 * outerPanelWidth + (solution.parts - 2) * innerPanelWidth + (solution.parts - 1) * gapPx;
    const startX = margin;
    const startY = margin + 15; // Extra space for top label
    
    // Set text direction
    if (isRTL) {
        pdf.setR2L(true);
    }
    
    // Draw height indicator
    const heightLineX = startX - 10;
    pdf.setLineWidth(0.5);
    pdf.line(heightLineX, startY, heightLineX, startY + panelHeight);
    
    // Height label (rotated) - display only in mm
    // Add label next to height line in PDF
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    const heightText = `${state.curtainHeight.toFixed(0)} mm`;
    // Draw rotated text
    pdf.text(heightText, heightLineX - 8, startY + panelHeight / 2, {
        angle: 90,
        align: 'center'
    });
    // Also add a horizontal label for better visibility
    pdf.setFontSize(9);
    pdf.text(heightText, heightLineX - 15, startY - 5, {
        align: 'left'
    });
    
    // Draw total width line
    pdf.setLineWidth(0.5);
    pdf.line(startX, startY - 10, startX + totalWidthPx, startY - 10);
    
    // Total width label (centered for LTR, right-aligned for RTL) - display only in mm
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.text(`${t.totalWidth}: ${state.curtainWidth.toFixed(0)} mm`, startX + totalWidthPx / 2, startY - 15, {
        align: isRTL ? 'right' : 'center'
    });
    
    // Draw panels
    let currentX = startX;
    for (let i = 0; i < solution.parts; i++) {
        const isOuter = i === 0 || i === solution.parts - 1;
        const panelWidth = isOuter ? outerPanelWidth : innerPanelWidth;
        const totalWidth = isOuter ? solution.outerPanelWidth : solution.innerPanelWidth;
        
        // Panel rectangle
        pdf.setDrawColor(0, 0, 0);
        pdf.setFillColor(255, 255, 255);
        pdf.setLineWidth(0.5);
        pdf.rect(currentX, startY, panelWidth, panelHeight, 'FD');
        
        // Fold lines (dashed)
        pdf.setDrawColor(100, 100, 100);
        pdf.setLineWidth(0.3);
        
        // Fold values in mm: 140mm and 40mm
        const OUTER_FOLD_MM = 140; // 140 mm
        const INNER_FOLD_MM = 40;  // 40 mm
        let leftFoldX, rightFoldX, netWidthStartX, netWidthEndX;
        
        if (isOuter) {
            if (i === 0) {
                // Left outer: 140mm fold on left, 40mm fold on right
                leftFoldX = currentX;
                rightFoldX = currentX + panelWidth - INNER_FOLD_MM * scale;
                netWidthStartX = currentX + OUTER_FOLD_MM * scale;
                netWidthEndX = currentX + panelWidth - INNER_FOLD_MM * scale;
            } else {
                // Right outer: 40mm fold on left, 140mm fold on right
                leftFoldX = currentX;
                rightFoldX = currentX + panelWidth - OUTER_FOLD_MM * scale;
                netWidthStartX = currentX + INNER_FOLD_MM * scale;
                netWidthEndX = currentX + panelWidth - OUTER_FOLD_MM * scale;
            }
        } else {
            // Inner panel: 40mm on each side
            leftFoldX = currentX;
            rightFoldX = currentX + panelWidth - INNER_FOLD_MM * scale;
            netWidthStartX = currentX + INNER_FOLD_MM * scale;
            netWidthEndX = currentX + panelWidth - INNER_FOLD_MM * scale;
        }
        
        // Draw dashed lines along the length of the panel (left and right edges)
        // Move left edge line slightly to the right to avoid merging with panel border
        const leftEdgeOffset = 1; // Offset in mm to separate from border
        drawDashedLine(pdf, currentX + leftEdgeOffset, startY, currentX + leftEdgeOffset, startY + panelHeight);
        drawDashedLine(pdf, currentX + panelWidth, startY, currentX + panelWidth, startY + panelHeight);
        
        // Draw fold lines
        drawDashedLine(pdf, leftFoldX, startY, leftFoldX, startY + panelHeight);
        drawDashedLine(pdf, rightFoldX, startY, rightFoldX, startY + panelHeight);
        
        // Fold labels - display only in mm
        pdf.setFontSize(8);
        const foldAlign = isRTL ? 'right' : 'center';
        if (isOuter && i === 0) {
            pdf.text(`140 mm`, leftFoldX, startY - 2, { align: foldAlign });
            pdf.text(`40 mm`, rightFoldX, startY - 2, { align: foldAlign });
        } else if (isOuter && i === solution.parts - 1) {
            pdf.text(`40 mm`, leftFoldX, startY - 2, { align: foldAlign });
            pdf.text(`140 mm`, rightFoldX, startY - 2, { align: foldAlign });
        } else {
            pdf.text(`40 mm`, leftFoldX, startY - 2, { align: foldAlign });
            pdf.text(`40 mm`, rightFoldX, startY - 2, { align: foldAlign });
        }
        
        // Net width line (horizontal dashed between fold lines)
        drawDashedLine(pdf, netWidthStartX, startY + panelHeight / 2, netWidthEndX, startY + panelHeight / 2);
        
        // Net width label - display only in mm
        pdf.setFontSize(8);
        pdf.text(`${solution.netWidth.toFixed(1)} mm`, (netWidthStartX + netWidthEndX) / 2, startY + panelHeight / 2 - 3, {
            align: isRTL ? 'right' : 'center'
        });
        
        // Panel width label (below) - display only the number in mm
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text(`${totalWidth.toFixed(1)} mm`, currentX + panelWidth / 2, startY + panelHeight + 8, {
            align: isRTL ? 'right' : 'center'
        });
        
        currentX += panelWidth + gapPx;
    }
    
    // Generate PDF filename with curtain name
    const curtainName = state.curtainName.trim() || 'Curtain';
    const filename = `${curtainName}_חישוב_בדים.pdf`;
    
    // Save PDF
    pdf.save(filename);
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

