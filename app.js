// State management
const state = {
    curtainHeight: 2500, // in mm
    curtainWidth: 59890, // in mm
    curtainName: '',
    fabricInventory: {
        2100: 0,
        2000: 0,
        1900: 4,
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
    calculate();
});

function initializeEventListeners() {
    // Curtain name
    document.getElementById('curtain-name').addEventListener('input', (e) => {
        state.curtainName = e.target.value.trim();
    });

    // Curtain dimensions
    document.getElementById('curtain-height').addEventListener('input', (e) => {
        state.curtainHeight = parseFloat(e.target.value) || 0;
        calculate();
    });

    document.getElementById('curtain-width').addEventListener('input', (e) => {
        state.curtainWidth = parseFloat(e.target.value) || 0;
        calculate();
    });

    // Fabric quantity controls
    document.querySelectorAll('.btn-plus').forEach(btn => {
        btn.addEventListener('click', () => {
            const width = parseInt(btn.dataset.width);
            state.fabricInventory[width]++;
            updateQuantityDisplay(width);
            calculate();
        });
    });

    document.querySelectorAll('.btn-minus').forEach(btn => {
        btn.addEventListener('click', () => {
            const width = parseInt(btn.dataset.width);
            if (state.fabricInventory[width] > 0) {
                state.fabricInventory[width]--;
                updateQuantityDisplay(width);
                calculate();
            }
        });
    });

    // Language selector
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

    // Fold values in mm: 180 cm = 1800 mm, 80 cm = 800 mm
    const OUTER_FOLD_MM = 1800; // 140 cm (outer edge) + 40 cm (inner edge) = 180 cm = 1800 mm
    const INNER_FOLD_MM = 800;  // 40 cm on each side = 80 cm = 800 mm

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
            
            // Calculate net width per panel using the correct formula (all in mm)
            // Total curtain width = 2 * (netWidth + OUTER_FOLD_MM) + (parts - 2) * (netWidth + INNER_FOLD_MM)
            // Solving for netWidth: netWidth = (totalCurtainWidth - 2 * OUTER_FOLD_MM - (parts - 2) * INNER_FOLD_MM) / parts
            let netWidth = (totalCurtainWidth - 2 * OUTER_FOLD_MM - (parts - 2) * INNER_FOLD_MM) / parts;
            
            // Check for invalid netWidth (negative or zero)
            if (netWidth <= 0) {
                continue;
            }
            
            // Round netWidth to 1 decimal place (allow decimal values for real-world fabric cutting)
            netWidth = Math.round(netWidth * 10) / 10;
            
            // Calculate cut widths (different for outer and inner panels) - all in mm
            const outerCutWidth = netWidth + OUTER_FOLD_MM; // netWidth + 1800 mm
            const innerCutWidth = netWidth + INNER_FOLD_MM;  // netWidth + 800 mm
            
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
    
    // Convert mm to cm for display
    const netWidthCm = solution.netWidth / 10;
    const outerPanelWidthCm = solution.outerPanelWidth / 10;
    const innerPanelWidthCm = solution.innerPanelWidth / 10;
    const wasteCm = solution.waste / 10;
    
    const html = `
        <div class="result-item">
            <strong>Selected Fabric Width:</strong> ${solution.fabricWidth} mm
        </div>
        <div class="result-item">
            <strong>Number of Panels:</strong> ${solution.parts}
        </div>
        <div class="result-item">
            <strong>Net Width per Panel:</strong> ${netWidthCm.toFixed(1)} cm (${solution.netWidth.toFixed(0)} mm)
        </div>
        <div class="result-item">
            <strong>Outer Panel Width:</strong> ${outerPanelWidthCm.toFixed(1)} cm (${solution.outerPanelWidth.toFixed(0)} mm)
            <br><span style="margin-left: 184px; color: #666;">(Net: ${netWidthCm.toFixed(1)} cm after folding)</span>
        </div>
        <div class="result-item">
            <strong>Inner Panel Width:</strong> ${innerPanelWidthCm.toFixed(1)} cm (${solution.innerPanelWidth.toFixed(0)} mm)
            <br><span style="margin-left: 184px; color: #666;">(Net: ${netWidthCm.toFixed(1)} cm after folding)</span>
        </div>
        <div class="result-item">
            <strong>Total Fabric Waste:</strong> ${wasteCm.toFixed(1)} cm (${solution.waste.toFixed(0)} mm)
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
    
    // Calculate dimensions for landscape A4 (297mm x 210mm = 1122px x 794px at 96 DPI)
    // Use a scale that fits the entire curtain width in landscape
    const maxWidth = 1000; // Maximum width for on-screen display
    const maxHeight = 600; // Maximum height for on-screen display
    const pdfWidth = 1122; // A4 landscape width in pixels
    const pdfHeight = 794; // A4 landscape height in pixels
    
    // All values are in mm, convert to cm for calculations
    const totalCurtainWidthMm = 2 * solution.outerPanelWidth + (solution.parts - 2) * solution.innerPanelWidth;
    const gap = 200; // Gap between panels in mm (20 cm)
    const totalWidthMm = totalCurtainWidthMm + (solution.parts - 1) * gap;
    const curtainHeightMm = state.curtainHeight;
    
    // Convert to cm for scaling
    const totalWidthCmForScale = totalWidthMm / 10;
    const curtainHeightCm = curtainHeightMm / 10;
    
    // Scale to fit on screen (with margins)
    const margin = 100; // Margins for labels
    const scaleX = (maxWidth - margin * 2) / totalWidthCmForScale;
    const scaleY = (maxHeight - margin * 2) / curtainHeightCm;
    const scale = Math.min(scaleX, scaleY, 0.5); // Limit scale for readability
    
    // Calculate dimensions (convert mm to cm then scale)
    const panelHeight = curtainHeightCm * scale;
    const outerPanelWidth = (solution.outerPanelWidth / 10) * scale;
    const innerPanelWidth = (solution.innerPanelWidth / 10) * scale;
    const gapPx = (gap / 10) * scale;
    
    // Calculate total diagram dimensions
    const totalWidthPx = 2 * outerPanelWidth + (solution.parts - 2) * innerPanelWidth + (solution.parts - 1) * gapPx;
    const totalHeightPx = panelHeight + 150; // Extra space for labels
    
    // Create SVG element
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', totalWidthPx + 200); // Extra space for height indicator
    svg.setAttribute('height', totalHeightPx + 100); // Extra space for top labels
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
    
    // Starting position (with margin for height indicator)
    const startX = 80;
    const startY = 80;
    
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
    // Convert mm to cm for display
    const heightCm = state.curtainHeight / 10;
    heightLabel.textContent = `${heightCm.toFixed(0)} ${t.cm} (${state.curtainHeight} mm)`;
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
    
    // Total width label (centered) - convert mm to cm for display
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
    const totalWidthCmForDisplay = state.curtainWidth / 10;
    totalWidthLabel.textContent = `${t.totalWidth}: ${totalWidthCmForDisplay.toFixed(0)} ${t.cm} (${state.curtainWidth} mm)`;
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
        
        // Fold lines (dashed vertical lines)
        // Outer panels: 1400mm (outer edge) + 400mm (inner edge) = 1800mm total
        // Inner panels: 400mm on each side = 800mm total
        // Convert mm to cm for scaling: 1400mm = 140cm, 400mm = 40cm
        const OUTER_FOLD_CM = 140; // 1400mm = 140cm
        const INNER_FOLD_CM = 40;  // 400mm = 40cm
        let leftFoldX, rightFoldX;
        
        if (isOuter) {
            if (i === 0) {
                // Left outer panel: 140cm fold on left (outer edge), 40cm fold on right (inner edge)
                leftFoldX = currentX; // Left edge of panel
                rightFoldX = currentX + panelWidth - INNER_FOLD_CM * scale; // 40cm from right edge
            } else {
                // Right outer panel: 40cm fold on left (inner edge), 140cm fold on right (outer edge)
                leftFoldX = currentX; // Left edge of panel (40cm fold)
                rightFoldX = currentX + panelWidth - OUTER_FOLD_CM * scale; // 140cm from right edge
            }
        } else {
            // Inner panel: 40cm on each side
            leftFoldX = currentX; // Left edge
            rightFoldX = currentX + panelWidth - INNER_FOLD_CM * scale; // 40cm from right edge
        }
        
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
            leftFoldLabel.textContent = `140 ${t.cm}`;
        } else if (isOuter && i === solution.parts - 1) {
            leftFoldLabel.textContent = `40 ${t.cm}`;
        } else {
            leftFoldLabel.textContent = `40 ${t.cm}`;
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
            rightFoldLabel.textContent = `40 ${t.cm}`;
        } else if (isOuter && i === solution.parts - 1) {
            rightFoldLabel.textContent = `140 ${t.cm}`;
        } else {
            rightFoldLabel.textContent = `40 ${t.cm}`;
        }
        svg.appendChild(rightFoldLabel);
        
        // Net width line (horizontal dashed line strictly between the two fold lines)
        // The net width is the area between the folded edges
        // For outer panels: net width starts after 140cm (left) or 40cm (right), ends before 40cm (left) or 140cm (right)
        // For inner panels: net width starts after 40cm, ends before 40cm
        let netWidthStartX, netWidthEndX;
        if (isOuter && i === 0) {
            // Left outer: after 140cm fold, before 40cm fold
            netWidthStartX = currentX + OUTER_FOLD_CM * scale;
            netWidthEndX = currentX + panelWidth - INNER_FOLD_CM * scale;
        } else if (isOuter && i === solution.parts - 1) {
            // Right outer: after 40cm fold, before 140cm fold
            netWidthStartX = currentX + INNER_FOLD_CM * scale;
            netWidthEndX = currentX + panelWidth - OUTER_FOLD_CM * scale;
        } else {
            // Inner: after 40cm fold, before 40cm fold
            netWidthStartX = currentX + INNER_FOLD_CM * scale;
            netWidthEndX = currentX + panelWidth - INNER_FOLD_CM * scale;
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
        // Convert mm to cm for display
        const netWidthCm = solution.netWidth / 10;
        netWidthLabel.textContent = `${netWidthCm.toFixed(1)} ${t.cm} (${solution.netWidth.toFixed(0)} mm)`;
        svg.appendChild(netWidthLabel);
        
        // Panel width label (below panel, centered) - convert mm to cm for display
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
        const totalWidthCm = totalWidth / 10;
        panelWidthLabel.textContent = `${t.panelWidth}: ${totalWidthCm.toFixed(1)} ${t.cm} (${totalWidth.toFixed(0)} mm)`;
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
    const gap = 200; // Gap between panels in mm (20 cm)
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
    
    // Height label (rotated) - convert mm to cm for display
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    const heightCm = state.curtainHeight / 10;
    pdf.text(`${heightCm.toFixed(0)} ${t.cm} (${state.curtainHeight} mm)`, heightLineX - 5, startY + panelHeight / 2, {
        angle: 90,
        align: 'center'
    });
    
    // Draw total width line
    pdf.setLineWidth(0.5);
    pdf.line(startX, startY - 10, startX + totalWidthPx, startY - 10);
    
    // Total width label (centered for LTR, right-aligned for RTL) - convert mm to cm for display
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    const totalWidthCm = state.curtainWidth / 10;
    pdf.text(`${t.totalWidth}: ${totalWidthCm.toFixed(0)} ${t.cm} (${state.curtainWidth} mm)`, startX + totalWidthPx / 2, startY - 15, {
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
        
        // Fold values in mm: 1400mm = 140cm, 400mm = 40cm
        const OUTER_FOLD_MM = 1400; // 140 cm
        const INNER_FOLD_MM = 400;  // 40 cm
        let leftFoldX, rightFoldX, netWidthStartX, netWidthEndX;
        
        if (isOuter) {
            if (i === 0) {
                // Left outer: 140cm fold on left, 40cm fold on right
                leftFoldX = currentX;
                rightFoldX = currentX + panelWidth - INNER_FOLD_MM * scale;
                netWidthStartX = currentX + OUTER_FOLD_MM * scale;
                netWidthEndX = currentX + panelWidth - INNER_FOLD_MM * scale;
            } else {
                // Right outer: 40cm fold on left, 140cm fold on right
                leftFoldX = currentX;
                rightFoldX = currentX + panelWidth - OUTER_FOLD_MM * scale;
                netWidthStartX = currentX + INNER_FOLD_MM * scale;
                netWidthEndX = currentX + panelWidth - OUTER_FOLD_MM * scale;
            }
        } else {
            // Inner panel: 40cm on each side
            leftFoldX = currentX;
            rightFoldX = currentX + panelWidth - INNER_FOLD_MM * scale;
            netWidthStartX = currentX + INNER_FOLD_MM * scale;
            netWidthEndX = currentX + panelWidth - INNER_FOLD_MM * scale;
        }
        
        // Draw fold lines
        drawDashedLine(pdf, leftFoldX, startY, leftFoldX, startY + panelHeight);
        drawDashedLine(pdf, rightFoldX, startY, rightFoldX, startY + panelHeight);
        
        // Fold labels
        pdf.setFontSize(8);
        const foldAlign = isRTL ? 'right' : 'center';
        if (isOuter && i === 0) {
            pdf.text(`140 ${t.cm}`, leftFoldX, startY - 2, { align: foldAlign });
            pdf.text(`40 ${t.cm}`, rightFoldX, startY - 2, { align: foldAlign });
        } else if (isOuter && i === solution.parts - 1) {
            pdf.text(`40 ${t.cm}`, leftFoldX, startY - 2, { align: foldAlign });
            pdf.text(`140 ${t.cm}`, rightFoldX, startY - 2, { align: foldAlign });
    } else {
            pdf.text(`40 ${t.cm}`, leftFoldX, startY - 2, { align: foldAlign });
            pdf.text(`40 ${t.cm}`, rightFoldX, startY - 2, { align: foldAlign });
        }
        
        // Net width line (horizontal dashed between fold lines)
        drawDashedLine(pdf, netWidthStartX, startY + panelHeight / 2, netWidthEndX, startY + panelHeight / 2);
        
        // Net width label - convert mm to cm for display
        pdf.setFontSize(8);
        const netWidthCm = solution.netWidth / 10;
        pdf.text(`${netWidthCm.toFixed(1)} ${t.cm}`, (netWidthStartX + netWidthEndX) / 2, startY + panelHeight / 2 - 3, {
            align: isRTL ? 'right' : 'center'
        });
        
        // Panel width label (below) - convert mm to cm for display
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(0, 0, 0);
        const totalWidthCm = totalWidth / 10;
        pdf.text(`${t.panelWidth}: ${totalWidthCm.toFixed(1)} ${t.cm}`, currentX + panelWidth / 2, startY + panelHeight + 8, {
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

