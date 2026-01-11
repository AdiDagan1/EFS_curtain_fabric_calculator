// State management
const state = {
    curtainHeight: 250,
    curtainWidth: 5989,
    fabricInventory: {
        2100: 0,
        2000: 0,
        1900: 4,
        1500: 0
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
        return;
    }

    // Display results
    displayResults(solution);
    renderDiagram(solution);
}

// Find optimal solution
function findOptimalSolution() {
    const availableWidths = Object.keys(state.fabricInventory)
        .map(w => parseInt(w))
        .filter(w => state.fabricInventory[w] > 0)
        .sort((a, b) => b - a); // Sort descending

    if (availableWidths.length === 0) {
        return null;
    }

    let bestSolution = null;
    let minWaste = Infinity;

    // Try different numbers of panels (minimum 2, maximum reasonable based on curtain width)
    const maxPanels = Math.min(20, Math.ceil(state.curtainWidth / 100));
    
    for (let numPanels = 2; numPanels <= maxPanels; numPanels++) {
        // Calculate required net width per panel
        const netWidthPerPanel = state.curtainWidth / numPanels;

        // Calculate required total widths (in cm)
        const outerPanelWidth = netWidthPerPanel + 180; // 140 + 40
        const innerPanelWidth = netWidthPerPanel + 80;  // 40 + 40

        // Try each available fabric width
        for (const fabricWidthMm of availableWidths) {
            // Convert fabric width from mm to cm
            const fabricWidthCm = fabricWidthMm / 10;
            
            // Calculate waste based on fabric utilization
            // If panel width <= fabric width, waste is the difference
            // If panel width > fabric width, we use a heuristic (prefer wider fabrics)
            let outerWaste = 0;
            let innerWaste = 0;
            
            if (fabricWidthCm >= outerPanelWidth) {
                outerWaste = fabricWidthCm - outerPanelWidth;
            } else {
                // Panel is wider than fabric - would need multiple pieces
                // Use a penalty based on how much wider
                outerWaste = (outerPanelWidth - fabricWidthCm) * 0.1; // Penalty factor
            }
            
            if (fabricWidthCm >= innerPanelWidth) {
                innerWaste = fabricWidthCm - innerPanelWidth;
            } else {
                // Panel is wider than fabric - would need multiple pieces
                innerWaste = (innerPanelWidth - fabricWidthCm) * 0.1; // Penalty factor
            }
            
            const totalWaste = 2 * outerWaste + (numPanels - 2) * innerWaste;

            // Check inventory availability
            const requiredRolls = numPanels;
            if (state.fabricInventory[fabricWidthMm] < requiredRolls) {
                continue;
            }

            // Check if this is a better solution (lower waste is better)
            if (totalWaste < minWaste || (totalWaste === minWaste && !bestSolution)) {
                minWaste = totalWaste;
                bestSolution = {
                    fabricWidth: fabricWidthMm,
                    numPanels: numPanels,
                    netWidthPerPanel: netWidthPerPanel,
                    outerPanelWidth: outerPanelWidth,
                    innerPanelWidth: innerPanelWidth,
                    totalWaste: totalWaste,
                    outerWaste: outerWaste,
                    innerWaste: innerWaste
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
            <strong>Number of Panels:</strong> ${solution.numPanels}
        </div>
        <div class="result-item">
            <strong>Outer Panel Width:</strong> ${solution.outerPanelWidth.toFixed(1)} cm
            <br><span style="margin-left: 184px; color: #666;">(Net: ${solution.netWidthPerPanel.toFixed(1)} cm)</span>
        </div>
        <div class="result-item">
            <strong>Inner Panel Width:</strong> ${solution.innerPanelWidth.toFixed(1)} cm
            <br><span style="margin-left: 184px; color: #666;">(Net: ${solution.netWidthPerPanel.toFixed(1)} cm)</span>
        </div>
        <div class="result-item">
            <strong>Total Fabric Waste:</strong> ${solution.totalWaste.toFixed(1)} cm
        </div>
    `;
    
    resultsDiv.innerHTML = html;
}

// Render visual diagram
function renderDiagram(solution) {
    const container = document.getElementById('diagram-container');
    const scale = 0.08; // Scale factor for visualization (cm to pixels)
    const panelHeight = Math.max(state.curtainHeight * scale, 200); // Minimum height for visibility
    const gap = 15; // Gap between panels in pixels

    // Calculate panel widths in pixels
    const outerPanelWidthPx = solution.outerPanelWidth * scale;
    const innerPanelWidthPx = solution.innerPanelWidth * scale;

    // Create diagram wrapper
    const diagram = document.createElement('div');
    diagram.className = 'diagram';
    diagram.style.position = 'relative';

    // Panel container
    const panelContainer = document.createElement('div');
    panelContainer.className = 'panel-container';
    panelContainer.style.position = 'relative';
    panelContainer.style.display = 'flex';
    panelContainer.style.gap = `${gap}px`;
    panelContainer.style.alignItems = 'flex-start';
    panelContainer.style.marginBottom = '30px';

    // Create panels
    for (let i = 0; i < solution.numPanels; i++) {
        const isOuter = i === 0 || i === solution.numPanels - 1;
        const panelWidthPx = isOuter ? outerPanelWidthPx : innerPanelWidthPx;
        const totalWidth = isOuter ? solution.outerPanelWidth : solution.innerPanelWidth;

        const panel = document.createElement('div');
        panel.className = `panel ${isOuter ? 'outer' : ''}`;
        panel.style.width = `${panelWidthPx}px`;
        panel.style.minHeight = `${panelHeight + 60}px`;
        panel.style.position = 'relative';

        // Panel label
        const panelLabel = document.createElement('div');
        panelLabel.className = 'panel-label';
        panelLabel.textContent = isOuter ? 'Outer Panel' : 'Inner Panel';
        panel.appendChild(panelLabel);

        // Panel content container (the actual fabric rectangle)
        const panelContent = document.createElement('div');
        panelContent.className = 'panel-content';
        panelContent.style.width = '100%';
        panelContent.style.height = `${panelHeight}px`;
        panelContent.style.position = 'relative';
        panelContent.style.marginTop = '5px';

        // Fold lines and labels
        if (isOuter) {
            // Left outer panel: 140cm fold on left, 40cm on right
            if (i === 0) {
                const leftFold = createFoldLine('left', 140, panelWidthPx, panelHeight, scale);
                panelContent.appendChild(leftFold);
                
                const rightFold = createFoldLine('right', 40, panelWidthPx, panelHeight, scale);
                panelContent.appendChild(rightFold);
            } else {
                // Right outer panel: 40cm fold on left, 140cm on right
                const leftFold = createFoldLine('left', 40, panelWidthPx, panelHeight, scale);
                panelContent.appendChild(leftFold);
                
                const rightFold = createFoldLine('right', 140, panelWidthPx, panelHeight, scale);
                panelContent.appendChild(rightFold);
            }
        } else {
            // Inner panel: 40cm on each side
            const leftFold = createFoldLine('left', 40, panelWidthPx, panelHeight, scale);
            panelContent.appendChild(leftFold);
            
            const rightFold = createFoldLine('right', 40, panelWidthPx, panelHeight, scale);
            panelContent.appendChild(rightFold);
        }

        // Net width line (horizontal dashed line in the middle)
        const netWidthLine = document.createElement('div');
        netWidthLine.className = 'net-width-line';
        netWidthLine.style.width = `${solution.netWidthPerPanel * scale}px`;
        netWidthLine.style.left = `${(isOuter ? 140 : 40) * scale}px`;
        const netWidthLabel = document.createElement('div');
        netWidthLabel.className = 'net-width-label';
        netWidthLabel.textContent = `${solution.netWidthPerPanel.toFixed(1)} cm (net)`;
        netWidthLine.appendChild(netWidthLabel);
        panelContent.appendChild(netWidthLine);

        panel.appendChild(panelContent);

        // Total panel width label
        const widthLabel = document.createElement('div');
        widthLabel.className = 'panel-width-label';
        widthLabel.textContent = `Total: ${totalWidth.toFixed(1)} cm`;
        panel.appendChild(widthLabel);

        panelContainer.appendChild(panel);
    }

    // Total width line (above panels)
    const totalWidthLine = document.createElement('div');
    totalWidthLine.className = 'total-width-line';
    totalWidthLine.style.position = 'absolute';
    totalWidthLine.style.top = '-30px';
    totalWidthLine.style.left = '0';
    totalWidthLine.style.width = `${2 * outerPanelWidthPx + (solution.numPanels - 2) * innerPanelWidthPx + (solution.numPanels - 1) * gap}px`;
    const totalWidthLabel = document.createElement('div');
    totalWidthLabel.className = 'total-width-label';
    totalWidthLabel.textContent = `Total Width: ${state.curtainWidth} cm`;
    totalWidthLine.appendChild(totalWidthLabel);
    panelContainer.appendChild(totalWidthLine);

    // Height indicator (vertical line on the left)
    const heightIndicator = document.createElement('div');
    heightIndicator.className = 'height-indicator';
    heightIndicator.style.position = 'absolute';
    heightIndicator.style.left = '-50px';
    heightIndicator.style.top = '30px';
    heightIndicator.style.width = '3px';
    heightIndicator.style.height = `${panelHeight}px`;
    const heightLabel = document.createElement('div');
    heightLabel.className = 'height-label';
    heightLabel.textContent = `${state.curtainHeight} cm`;
    heightIndicator.appendChild(heightLabel);

    diagram.appendChild(heightIndicator);
    diagram.appendChild(panelContainer);
    container.innerHTML = '';
    container.appendChild(diagram);
}

// Helper function to create fold lines
function createFoldLine(side, foldWidth, panelWidthPx, panelHeight, scale) {
    const foldLine = document.createElement('div');
    foldLine.className = `fold-line ${side}`;
    
    const foldWidthPx = foldWidth * scale;
    
    foldLine.style.position = 'absolute';
    foldLine.style.top = '0';
    foldLine.style.height = `${panelHeight}px`;
    foldLine.style.width = `${foldWidthPx}px`;
    
    if (side === 'left') {
        foldLine.style.left = '0';
        foldLine.style.borderRight = '2px dashed #ff5722';
    } else {
        foldLine.style.right = '0';
        foldLine.style.borderLeft = '2px dashed #ff5722';
    }
    
    const foldLabel = document.createElement('div');
    foldLabel.className = 'fold-label';
    foldLabel.textContent = `${foldWidth} cm`;
    foldLabel.style.position = 'absolute';
    foldLabel.style.top = '-20px';
    if (side === 'left') {
        foldLabel.style.left = '0';
    } else {
        foldLabel.style.right = '0';
    }
    foldLine.appendChild(foldLabel);
    
    return foldLine;
}

