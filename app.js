// State management
const state = {
    curtainHeight: 250,
    curtainWidth: 5989,
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
    const totalCurtainWidth = state.curtainWidth; // in cm
    const fabricWidths = [2100, 2000, 1900, 1500]; // in mm
    const inventory = state.fabricInventory;

    let bestSolution = null;
    let minWaste = Infinity;

    // Loop over all fabric widths that exist in inventory
    for (const fabricWidthMm of fabricWidths) {
        const availableRolls = inventory[fabricWidthMm];
        
        // Skip if no inventory available
        if (availableRolls === 0) {
            continue;
        }
        
        const fabricWidthCm = fabricWidthMm / 10; // Convert mm to cm
        
        // For each fabric width, loop over all valid parts values
        // From 2 up to inventory[fabricWidth]
        for (let parts = 2; parts <= availableRolls; parts++) {
            // Calculate net width per panel using the correct formula
            // netWidth = (totalCurtainWidth + 2 * 180 + (parts - 2) * 80) / parts
            const netWidth = (totalCurtainWidth + 2 * 180 + (parts - 2) * 80) / parts;
            
            // Reject if netWidth is not an integer
            if (!Number.isInteger(netWidth)) {
                continue;
            }
            
            // Calculate panel total widths
            const outerPanelWidth = netWidth + 180; // 140 (outer edge) + 40 (inner edge)
            const innerPanelWidth = netWidth + 80;  // 40 on each side
            
            // Reject if panels exceed fabric width
            if (outerPanelWidth > fabricWidthCm || innerPanelWidth > fabricWidthCm) {
                continue;
            }
            
            // Calculate fabric waste per panel, then sum
            // waste = 2 * (fabricWidth - outerPanelWidth) + (parts - 2) * (fabricWidth - innerPanelWidth)
            const waste = 2 * (fabricWidthCm - outerPanelWidth) + (parts - 2) * (fabricWidthCm - innerPanelWidth);

            // Check if this is a better solution (lower waste is better)
            if (waste < minWaste) {
                minWaste = waste;
                bestSolution = {
                    fabricWidth: fabricWidthMm,
                    parts: parts,
                    netWidth: netWidth,
                    outerPanelWidth: outerPanelWidth,
                    innerPanelWidth: innerPanelWidth,
                    waste: waste
                };
            }
        }
    }

    return bestSolution;
}

// Display calculation results
function displayResults(solution) {
    const resultsDiv = document.getElementById('results');
    
    const html = `
        <div class="result-item">
            <strong>Selected Fabric Width:</strong> ${solution.fabricWidth} mm
        </div>
        <div class="result-item">
            <strong>Number of Panels:</strong> ${solution.parts}
        </div>
        <div class="result-item">
            <strong>Net Width per Panel:</strong> ${solution.netWidth.toFixed(1)} cm
        </div>
        <div class="result-item">
            <strong>Outer Panel Width:</strong> ${solution.outerPanelWidth.toFixed(1)} cm
            <br><span style="margin-left: 184px; color: #666;">(Net: ${solution.netWidth.toFixed(1)} cm after folding)</span>
        </div>
        <div class="result-item">
            <strong>Inner Panel Width:</strong> ${solution.innerPanelWidth.toFixed(1)} cm
            <br><span style="margin-left: 184px; color: #666;">(Net: ${solution.netWidth.toFixed(1)} cm after folding)</span>
        </div>
        <div class="result-item">
            <strong>Total Fabric Waste:</strong> ${solution.waste.toFixed(1)} cm
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
    
    // Calculate scale to fit curtain width
    const totalCurtainWidthCm = 2 * solution.outerPanelWidth + (solution.parts - 2) * solution.innerPanelWidth;
    const gap = 20; // Gap between panels in cm
    const totalWidthCm = totalCurtainWidthCm + (solution.parts - 1) * gap;
    const curtainHeightCm = state.curtainHeight;
    
    // Scale to fit on screen (with margins)
    const margin = 100; // Margins for labels
    const scaleX = (maxWidth - margin * 2) / totalWidthCm;
    const scaleY = (maxHeight - margin * 2) / curtainHeightCm;
    const scale = Math.min(scaleX, scaleY, 0.5); // Limit scale for readability
    
    // Calculate dimensions
    const panelHeight = curtainHeightCm * scale;
    const outerPanelWidth = solution.outerPanelWidth * scale;
    const innerPanelWidth = solution.innerPanelWidth * scale;
    const gapPx = gap * scale;
    
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
    heightLabel.textContent = `${state.curtainHeight} ${t.cm}`;
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
    
    // Total width label (centered)
    const totalWidthLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    totalWidthLabel.setAttribute('x', startX + totalWidthPx / 2);
    totalWidthLabel.setAttribute('y', totalWidthLineY - 10);
    totalWidthLabel.setAttribute('text-anchor', 'middle');
    totalWidthLabel.setAttribute('font-size', '14');
    totalWidthLabel.setAttribute('font-weight', '600');
    totalWidthLabel.setAttribute('fill', '#000');
    totalWidthLabel.textContent = `${t.totalWidth}: ${state.curtainWidth} ${t.cm}`;
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
        // Outer panels: 140cm (outer edge) + 40cm (inner edge) = 180cm total
        // Inner panels: 40cm on each side = 80cm total
        let leftFoldX, rightFoldX;
        
        if (isOuter) {
            if (i === 0) {
                // Left outer panel: 140cm fold on left (outer edge), 40cm fold on right (inner edge)
                leftFoldX = currentX; // Left edge of panel
                rightFoldX = currentX + panelWidth - 40 * scale; // 40cm from right edge
            } else {
                // Right outer panel: 40cm fold on left (inner edge), 140cm fold on right (outer edge)
                leftFoldX = currentX; // Left edge of panel (40cm fold)
                rightFoldX = currentX + panelWidth - 140 * scale; // 140cm from right edge
            }
        } else {
            // Inner panel: 40cm on each side
            leftFoldX = currentX; // Left edge
            rightFoldX = currentX + panelWidth - 40 * scale; // 40cm from right edge
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
        leftFoldLabel.setAttribute('text-anchor', 'middle');
        leftFoldLabel.setAttribute('font-size', '10');
        leftFoldLabel.setAttribute('font-weight', '600');
        leftFoldLabel.setAttribute('fill', '#666');
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
        rightFoldLabel.setAttribute('text-anchor', 'middle');
        rightFoldLabel.setAttribute('font-size', '10');
        rightFoldLabel.setAttribute('font-weight', '600');
        rightFoldLabel.setAttribute('fill', '#666');
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
            netWidthStartX = currentX + 140 * scale;
            netWidthEndX = currentX + panelWidth - 40 * scale;
        } else if (isOuter && i === solution.parts - 1) {
            // Right outer: after 40cm fold, before 140cm fold
            netWidthStartX = currentX + 40 * scale;
            netWidthEndX = currentX + panelWidth - 140 * scale;
        } else {
            // Inner: after 40cm fold, before 40cm fold
            netWidthStartX = currentX + 40 * scale;
            netWidthEndX = currentX + panelWidth - 40 * scale;
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
        netWidthLabel.textContent = `${solution.netWidth.toFixed(1)} ${t.cm} (${t.netWidth})`;
        svg.appendChild(netWidthLabel);
        
        // Panel width label (below panel, centered)
        const panelWidthLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        panelWidthLabel.setAttribute('x', currentX + panelWidth / 2);
        panelWidthLabel.setAttribute('y', startY + panelHeight + 25);
        panelWidthLabel.setAttribute('text-anchor', 'middle');
        panelWidthLabel.setAttribute('font-size', '12');
        panelWidthLabel.setAttribute('font-weight', '600');
        panelWidthLabel.setAttribute('fill', '#000');
        panelWidthLabel.textContent = `${t.panelWidth}: ${totalWidth.toFixed(1)} ${t.cm}`;
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
    
    // Calculate scale for PDF
    const totalCurtainWidthCm = 2 * solution.outerPanelWidth + (solution.parts - 2) * solution.innerPanelWidth;
    const gap = 20;
    const totalWidthCm = totalCurtainWidthCm + (solution.parts - 1) * gap;
    const curtainHeightCm = state.curtainHeight;
    
    // Scale to fit in PDF with margins
    const margin = 20; // 20mm margins
    const scaleX = (pdfWidth - margin * 2) / totalWidthCm;
    const scaleY = (pdfHeight - margin * 2) / curtainHeightCm;
    const scale = Math.min(scaleX, scaleY) * 10; // Convert to mm
    
    // Calculate dimensions in mm
    const panelHeight = curtainHeightCm * scale / 10;
    const outerPanelWidth = solution.outerPanelWidth * scale / 10;
    const innerPanelWidth = solution.innerPanelWidth * scale / 10;
    const gapPx = gap * scale / 10;
    
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
    
    // Height label (rotated)
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`${state.curtainHeight} ${t.cm}`, heightLineX - 5, startY + panelHeight / 2, {
        angle: 90,
        align: 'center'
    });
    
    // Draw total width line
    pdf.setLineWidth(0.5);
    pdf.line(startX, startY - 10, startX + totalWidthPx, startY - 10);
    
    // Total width label (centered)
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.text(`${t.totalWidth}: ${state.curtainWidth} ${t.cm}`, startX + totalWidthPx / 2, startY - 15, {
        align: 'center'
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
        
        let leftFoldX, rightFoldX, netWidthStartX, netWidthEndX;
        
        if (isOuter) {
            if (i === 0) {
                // Left outer: 140cm fold on left, 40cm fold on right
                leftFoldX = currentX;
                rightFoldX = currentX + panelWidth - 40 * scale / 10;
                netWidthStartX = currentX + 140 * scale / 10;
                netWidthEndX = currentX + panelWidth - 40 * scale / 10;
            } else {
                // Right outer: 40cm fold on left, 140cm fold on right
                leftFoldX = currentX;
                rightFoldX = currentX + panelWidth - 140 * scale / 10;
                netWidthStartX = currentX + 40 * scale / 10;
                netWidthEndX = currentX + panelWidth - 140 * scale / 10;
            }
        } else {
            // Inner panel: 40cm on each side
            leftFoldX = currentX;
            rightFoldX = currentX + panelWidth - 40 * scale / 10;
            netWidthStartX = currentX + 40 * scale / 10;
            netWidthEndX = currentX + panelWidth - 40 * scale / 10;
        }
        
        // Draw fold lines
        drawDashedLine(pdf, leftFoldX, startY, leftFoldX, startY + panelHeight);
        drawDashedLine(pdf, rightFoldX, startY, rightFoldX, startY + panelHeight);
        
        // Fold labels
        pdf.setFontSize(8);
        if (isOuter && i === 0) {
            pdf.text(`140 ${t.cm}`, leftFoldX, startY - 2, { align: 'center' });
            pdf.text(`40 ${t.cm}`, rightFoldX, startY - 2, { align: 'center' });
        } else if (isOuter && i === solution.parts - 1) {
            pdf.text(`40 ${t.cm}`, leftFoldX, startY - 2, { align: 'center' });
            pdf.text(`140 ${t.cm}`, rightFoldX, startY - 2, { align: 'center' });
    } else {
            pdf.text(`40 ${t.cm}`, leftFoldX, startY - 2, { align: 'center' });
            pdf.text(`40 ${t.cm}`, rightFoldX, startY - 2, { align: 'center' });
        }
        
        // Net width line (horizontal dashed between fold lines)
        drawDashedLine(pdf, netWidthStartX, startY + panelHeight / 2, netWidthEndX, startY + panelHeight / 2);
        
        // Net width label
        pdf.setFontSize(8);
        pdf.text(`${solution.netWidth.toFixed(1)} ${t.cm}`, (netWidthStartX + netWidthEndX) / 2, startY + panelHeight / 2 - 3, {
            align: 'center'
        });
        
        // Panel width label (below)
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text(`${t.panelWidth}: ${totalWidth.toFixed(1)} ${t.cm}`, currentX + panelWidth / 2, startY + panelHeight + 8, {
            align: 'center'
        });
        
        currentX += panelWidth + gapPx;
    }
    
    // Save PDF
    pdf.save('curtain-fabric-layout.pdf');
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

