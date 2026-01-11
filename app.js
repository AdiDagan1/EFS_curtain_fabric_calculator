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
    const curtainHeight = Number(state.curtainHeight); // in mm - ensure number
    const fabricWidths = [2100, 2000, 1900, 1500]; // in mm
    const inventory = state.fabricInventory;

    // Fold values in mm: 140mm (outer edge) + 40mm (inner edge) = 180mm
    const OUTER_FOLD_MM = 180; // 140 mm (outer edge) + 40 mm (inner edge) = 180 mm
    const INNER_FOLD_MM = 80;  // 40 mm on each side = 80 mm
    
    // Each roll is 50 meters = 5000 mm long
    const ROLL_LENGTH_MM = 5000; // 50 meters = 5000 mm

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
        
        // Calculate how many panels can be cut from one roll based on height
        // Each panel needs curtainHeight mm, so from one roll we can get:
        const panelsPerRoll = Math.floor(ROLL_LENGTH_MM / curtainHeight);
        
        // Skip if we can't cut at least 1 panel from a roll
        if (panelsPerRoll < 1) {
            continue;
        }
        
        // Maximum panels we can cut from all available rolls
        const maxPanelsFromRolls = availableRolls * panelsPerRoll;
        
        // For each fabric width, loop over all valid parts values
        // Test from 2 up to maxPanelsFromRolls
        const maxPartsToTest = Math.min(maxPanelsFromRolls, Math.ceil(totalCurtainWidth / fabricWidth) + 5, 30);
        
        for (let parts = 2; parts <= maxPartsToTest; parts++) {
            // Calculate how many rolls we need for this number of parts
            const rollsNeeded = Math.ceil(parts / panelsPerRoll);
            
            // Skip if we don't have enough rolls
            if (rollsNeeded > availableRolls) {
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
                    waste: waste, // in mm
                    rollsNeeded: rollsNeeded, // Number of rolls needed
                    panelsPerRoll: panelsPerRoll // Number of panels per roll
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
            <strong>Panels per Roll:</strong> ${solution.panelsPerRoll || Math.floor(5000 / state.curtainHeight)}
        </div>
        <div class="result-item">
            <strong>Rolls Needed:</strong> ${solution.rollsNeeded || Math.ceil(solution.parts / (solution.panelsPerRoll || Math.floor(5000 / state.curtainHeight)))}
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
    
    // Always use English for diagram labels (project/curtain names can be in Hebrew)
    const t = translations.en;
    const isRTL = false; // Always LTR for English labels
    
    // Get project and curtain names early (before using them in viewBox calculation)
    // Use safe access to prevent errors if state properties are undefined
    const projectName = (state.projectName && state.projectName.trim()) || '';
    const curtainName = (state.curtainName && state.curtainName.trim()) || '';
    
    // Get container dimensions to use full available space
    const containerRect = container.getBoundingClientRect();
    const maxWidth = containerRect.width || 1200; // Fallback if container not ready
    const maxHeight = containerRect.height || 600; // Fallback if container not ready
    
    // Calculate fixed panel dimensions based on maximum 5 parts fitting in the page
    // Formula: maxWidth = 5 * panelWidth + 4 * gap + margins
    const gapPixels = 40; // Fixed gap between panels in pixels
    const maxParts = 5; // Maximum number of parts to fit
    const horizontalMargins = 200; // Space for height indicator and padding (left + right)
    const availableWidth = maxWidth - horizontalMargins;
    // Calculate panel width: (availableWidth - (maxParts - 1) * gap) / maxParts
    const calculatedPanelWidth = Math.floor((availableWidth - (maxParts - 1) * gapPixels) / maxParts);
    const FIXED_PANEL_WIDTH = Math.max(100, calculatedPanelWidth); // Minimum 100px, calculated based on 5 parts
    
    // Fixed panel height - use reasonable fixed height
    const FIXED_PANEL_HEIGHT = 200; // Fixed height in pixels for all panels
    
    // Use fixed dimensions for display (calculation remains unchanged)
    const panelHeight = FIXED_PANEL_HEIGHT;
    const outerPanelWidth = FIXED_PANEL_WIDTH;
    const innerPanelWidth = FIXED_PANEL_WIDTH;
    const gapPx = gapPixels;
    
    // Calculate total diagram dimensions
    const totalWidthPx = 2 * outerPanelWidth + (solution.parts - 2) * innerPanelWidth + (solution.parts - 1) * gapPx;
    
    // Starting position - exactly 10px from top, with margin for height indicator on left
    const startX = 80;
    const startY = 10; // Exactly 10px from top edge of SVG - single source of truth
    
    // Calculate space needed for labels above panels (total width line and fold labels)
    // Total width line is at Y = -5, label is at Y = -13, so we need space from -15 to startY
    const spaceAbovePanels = 25; // Space for labels above panels (from -15 to startY=10)
    
    // Calculate space needed for labels below panels
    // Panel width labels are positioned at startY + panelHeight + 25
    // Text height for font-size 12 is approximately 15px
    // Add extra space for total width line and detail view image below
    const spaceForLabels = 25 + 15; // Position offset + text height = 40px
    const spaceBelowTotalWidth = 50; // Space for total width line, label, and detail view image
    
    // Calculate the actual bottom of all content dynamically
    const contentBottomY = startY + panelHeight + spaceForLabels + spaceBelowTotalWidth;
    
    // Create SVG element - use full container width
    // Set viewBox to anchor content to top with exactly 10px top margin
    const viewBoxPaddingX = 200; // Extra space for height indicator on left
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    // ViewBox: includes space above for project/curtain names, panels, and space below for total width line and detail views
    // Adjust viewBox to start at negative Y to include all content above panels
    const topSpace = projectName || curtainName ? 60 : 20; // Space for names above
    // Increase viewBox width to include images on the right side
    const extraRightSpace = 150; // Extra space for images on the right
    svg.setAttribute('viewBox', `0 -${topSpace} ${totalWidthPx + viewBoxPaddingX + extraRightSpace} ${contentBottomY + topSpace}`);
    // Use YMin to align content to top instead of centering vertically
    svg.setAttribute('preserveAspectRatio', 'xMidYMin meet');
    svg.setAttribute('class', 'diagram-svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    // Always LTR for English labels (project/curtain names can be in Hebrew but are handled by browser)
    
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
    
    // Add project name and curtain name at the center top of SVG (for PDF export with Unicode support)
    // Format: "Project - Curtain Name"
    const centerX = startX + totalWidthPx / 2; // Center of the diagram
    const nameY = -30; // Position above the diagram
    let titleText = '';
    if (projectName && curtainName) {
        titleText = `${projectName} - ${curtainName}`;
    } else if (projectName) {
        titleText = projectName;
    } else if (curtainName) {
        titleText = curtainName;
    }
    
    if (titleText) {
        const titleTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        titleTextElement.setAttribute('x', centerX);
        titleTextElement.setAttribute('y', nameY);
        titleTextElement.setAttribute('text-anchor', 'middle'); // Center-aligned
        titleTextElement.setAttribute('font-size', '16');
        titleTextElement.setAttribute('font-weight', 'bold');
        titleTextElement.setAttribute('fill', '#000');
        titleTextElement.textContent = titleText;
        svg.appendChild(titleTextElement);
    }
    
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
        
        // Fold lines (dashed vertical lines) - calculate position based on proportion of panel width
        // Outer panels: 140mm (outer edge) + 40mm (inner edge) = 180mm total
        // Inner panels: 40mm on each side = 80mm total
        const OUTER_FOLD_MM = 140; // 140mm (outer edge)
        const INNER_FOLD_MM = 40;  // 40mm (inner edge or both sides for inner panels)
        let leftFoldX, rightFoldX;
        
        // Calculate fold positions as proportion of panel width (fixed display size)
        // totalWidth is the actual width in mm, panelWidth is the fixed display width in pixels
        const foldScale = panelWidth / totalWidth; // Scale factor for this panel
        
        if (isOuter) {
            if (i === 0) {
                // Left outer panel: 140mm fold on left (outer edge), 40mm fold on right (inner edge)
                leftFoldX = currentX + OUTER_FOLD_MM * foldScale; // 140mm from left edge
                rightFoldX = currentX + panelWidth - INNER_FOLD_MM * foldScale; // 40mm from right edge
            } else {
                // Right outer panel: 40mm fold on left (inner edge), 140mm fold on right (outer edge)
                leftFoldX = currentX + INNER_FOLD_MM * foldScale; // 40mm from left edge
                rightFoldX = currentX + panelWidth - OUTER_FOLD_MM * foldScale; // 140mm from right edge
            }
        } else {
            // Inner panel: 40mm on each side
            leftFoldX = currentX + INNER_FOLD_MM * foldScale; // 40mm from left edge
            rightFoldX = currentX + panelWidth - INNER_FOLD_MM * foldScale; // 40mm from right edge
        }
        
        // Draw left fold line (only dashed line on left side)
        const leftFoldLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        leftFoldLine.setAttribute('x1', leftFoldX);
        leftFoldLine.setAttribute('y1', startY);
        leftFoldLine.setAttribute('x2', leftFoldX);
        leftFoldLine.setAttribute('y2', startY + panelHeight);
        leftFoldLine.setAttribute('stroke', '#666');
        leftFoldLine.setAttribute('stroke-width', '1.5');
        leftFoldLine.setAttribute('stroke-dasharray', '4,4');
        svg.appendChild(leftFoldLine);
        
        // Left fold label - position based on actual fold line position
        const leftFoldLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        let leftLabelX = leftFoldX;
        let leftLabelText = '';
        
        if (isOuter && i === 0) {
            // Left outer: 140mm fold is at leftFoldX, label should be at the left edge (currentX)
            leftLabelX = currentX; // Label at left edge
            leftLabelText = `140 mm`;
        } else if (isOuter && i === solution.parts - 1) {
            // Right outer: 40mm fold is at leftFoldX
            leftLabelX = leftFoldX;
            leftLabelText = `40 mm`;
        } else {
            // Inner: 40mm fold is at leftFoldX
            leftLabelX = leftFoldX;
            leftLabelText = `40 mm`;
        }
        
        leftFoldLabel.setAttribute('x', leftLabelX);
        // Position labels just above each panel (relative to panel, not fixed global Y)
        const foldLabelY = startY - 2; // Just above the panel top edge
        leftFoldLabel.setAttribute('y', foldLabelY);
        // For inner panels, use 'middle' alignment to prevent overlap
        const labelAnchor = (!isOuter) ? 'middle' : 'middle';
        leftFoldLabel.setAttribute('text-anchor', labelAnchor);
        leftFoldLabel.setAttribute('font-size', '10');
        leftFoldLabel.setAttribute('font-weight', '600');
        leftFoldLabel.setAttribute('fill', '#666');
        // Always LTR for English labels
        leftFoldLabel.textContent = leftLabelText;
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
        // Position labels just above each panel (relative to panel, not fixed global Y)
        rightFoldLabel.setAttribute('y', foldLabelY);
        // For inner panels, use 'middle' alignment to prevent overlap
        rightFoldLabel.setAttribute('text-anchor', labelAnchor);
        rightFoldLabel.setAttribute('font-size', '10');
        rightFoldLabel.setAttribute('font-weight', '600');
        rightFoldLabel.setAttribute('fill', '#666');
        // Always LTR for English labels
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
        // Use the fold line positions we already calculated
        const netWidthStartX = leftFoldX;
        const netWidthEndX = rightFoldX;
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
        // Always LTR for English labels
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
        // Always LTR for English labels
        // Display only the number, without "Panel Width" text
        panelWidthLabel.textContent = `${totalWidth.toFixed(1)} mm`;
        svg.appendChild(panelWidthLabel);
        
        // Move to next panel
        currentX += panelWidth + gapPx;
    }
    
    // Draw total width line below the diagram (after panel width labels)
    // Panel width labels are at: startY + panelHeight + 25
    const panelWidthLabelY = startY + panelHeight + 25; // Y position of panel width labels
    const totalWidthLineY = panelWidthLabelY + 20; // Below panel width labels (20px spacing)
    const totalWidthLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    totalWidthLine.setAttribute('x1', startX);
    totalWidthLine.setAttribute('y1', totalWidthLineY);
    totalWidthLine.setAttribute('x2', startX + totalWidthPx);
    totalWidthLine.setAttribute('y2', totalWidthLineY);
    totalWidthLine.setAttribute('stroke', '#000');
    totalWidthLine.setAttribute('stroke-width', '2');
    svg.appendChild(totalWidthLine);
    
    // Total width label (centered) - display only in mm, positioned above the line
    const totalWidthLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    const labelText = `${t.totalWidth}: ${state.curtainWidth.toFixed(0)} mm`;
    totalWidthLabel.setAttribute('x', startX + totalWidthPx / 2);
    totalWidthLabel.setAttribute('y', totalWidthLineY - 5);
    totalWidthLabel.setAttribute('text-anchor', 'middle');
    totalWidthLabel.setAttribute('font-size', '14');
    totalWidthLabel.setAttribute('font-weight', '600');
    totalWidthLabel.setAttribute('fill', '#000');
    totalWidthLabel.textContent = labelText;
    svg.appendChild(totalWidthLabel);
    
    // Add detail view arrows and image reference (like technical drawing)
    // Arrow 1: From right corner of the curtain (last panel) to image "1" - further from diagram
    const lastPanelX = startX + (solution.parts - 1) * (outerPanelWidth + gapPx) + outerPanelWidth;
    const lastPanelY = startY + panelHeight; // Bottom of last panel
    // Position image "1" further from the panel to avoid overlapping with diagram
    const image1X = lastPanelX + 80; // Further distance from panel edge (80px)
    const image1Y = lastPanelY - 20; // Further from bottom
    
    // Draw arrow from right corner of last panel to image "1"
    const arrow1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    arrow1.setAttribute('x1', lastPanelX);
    arrow1.setAttribute('y1', lastPanelY);
    arrow1.setAttribute('x2', image1X);
    arrow1.setAttribute('y2', image1Y);
    arrow1.setAttribute('stroke', '#000');
    arrow1.setAttribute('stroke-width', '1.5');
    arrow1.setAttribute('marker-end', 'url(#arrowhead)');
    svg.appendChild(arrow1);
    
    // Arrow 2: From inner edge of the rightmost outer panel (last panel) going upward
    // Start from the inner edge (left side) of the last panel, at the top
    if (solution.parts > 1) {
        const lastPanelInnerEdgeX = startX + (solution.parts - 1) * (outerPanelWidth + gapPx); // Left edge of last panel (inner edge)
        const connectionY = startY + 20; // Upper part of panel (20px from top)
        // Position image "2.png" above the diagram, further to the right, avoiding the title
        const image2X = lastPanelInnerEdgeX + 100; // Further to the right of the inner edge (100px)
        const image2Y = -15; // Above the diagram, below title (title is at Y = -30), with more spacing
        
        const arrow2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        arrow2.setAttribute('x1', lastPanelInnerEdgeX);
        arrow2.setAttribute('y1', connectionY);
        arrow2.setAttribute('x2', image2X);
        arrow2.setAttribute('y2', image2Y);
        arrow2.setAttribute('stroke', '#000');
        arrow2.setAttribute('stroke-width', '1.5');
        arrow2.setAttribute('marker-end', 'url(#arrowhead)');
        svg.appendChild(arrow2);
        
        // Add image "2.png" in circle above the diagram
        const image2Circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        image2Circle.setAttribute('cx', image2X);
        image2Circle.setAttribute('cy', image2Y);
        image2Circle.setAttribute('r', '30'); // Larger circle to fit image
        image2Circle.setAttribute('fill', 'white');
        image2Circle.setAttribute('stroke', '#000');
        image2Circle.setAttribute('stroke-width', '2');
        svg.appendChild(image2Circle);
        
        // Add image 2.png inside the circle
        const image2Img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        image2Img.setAttribute('href', '2.png');
        image2Img.setAttribute('x', image2X - 25);
        image2Img.setAttribute('y', image2Y - 25);
        image2Img.setAttribute('width', '50');
        image2Img.setAttribute('height', '50');
        image2Img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.appendChild(image2Img);
    }
    
    // Add arrowhead marker definition
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 10 3, 0 6');
    polygon.setAttribute('fill', '#000');
    marker.appendChild(polygon);
    const existingDefs = svg.querySelector('defs');
    if (existingDefs) {
        existingDefs.appendChild(marker);
    }
    
    // Add image "1.jpg" in circle at the target position (for external connection)
    const image1Circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    image1Circle.setAttribute('cx', image1X);
    image1Circle.setAttribute('cy', image1Y);
    image1Circle.setAttribute('r', '30'); // Larger circle to fit image
    image1Circle.setAttribute('fill', 'white');
    image1Circle.setAttribute('stroke', '#000');
    image1Circle.setAttribute('stroke-width', '2');
    svg.appendChild(image1Circle);
    
    // Add image 1.jpg inside the circle
    const image1Img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image1Img.setAttribute('href', '1.jpg');
    image1Img.setAttribute('x', image1X - 25);
    image1Img.setAttribute('y', image1Y - 25);
    image1Img.setAttribute('width', '50');
    image1Img.setAttribute('height', '50');
    image1Img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.appendChild(image1Img);
    
    // Store SVG reference for PDF export
    state.diagramSVG = svg;
    state.diagramSolution = solution;
    
    container.appendChild(svg);
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
                imgElement.onload = () => resolve();
                imgElement.onerror = () => resolve(); // Continue even if image fails to load
                const href = img.getAttribute('href') || img.getAttribute('xlink:href');
                if (href) {
                    imgElement.src = href;
                } else {
                    resolve(); // No href, skip
                }
            });
        });
        await Promise.all(imagePromises);
        
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
        
        // Use minimal margins to maximize diagram size
        const availableWidth = pdfWidth - margin * 2;
        const availableHeight = pdfHeight - topMargin - margin;
        
        const pdfAspectRatio = availableWidth / availableHeight;
        
        let imgWidth, imgHeight;
        if (canvasAspectRatio > pdfAspectRatio) {
            // Canvas is wider - fit to width (fill entire width)
            imgWidth = availableWidth;
            imgHeight = imgWidth / canvasAspectRatio;
        } else {
            // Canvas is taller - fit to height (fill entire height)
            imgHeight = availableHeight;
            imgWidth = imgHeight * canvasAspectRatio;
        }
        
        // Center the image horizontally, position below project/curtain names
        const x = (pdfWidth - imgWidth) / 2;
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

