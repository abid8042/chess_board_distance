/**
 * main.js - Entry point for the Chess Influence Network Visualization
 * 
 * This file:
 * 1. Initializes the application
 * 2. Loads and manages the chess game data
 * 3. Controls the application state
 * 4. Coordinates between visualization and UI
 */

// Application State
const AppState = {
    currentMoveIndex: 0,
    totalMoves: 0,
    gameData: null,
    movesArray: [], // Array to store moves for easier navigation
    moveMapping: {}, // Maps move numbers to array indices
    currentLayout: 'force',
    selectedGraphType: 'combined',
    isPlaying: false,
    playbackSpeed: 1000, // ms between moves during playback
    playbackTimer: null,
    currentNode: null,
    zoomLevel: 1,
    
    // UI state flags
    showCommunities: true,
    animationEnabled: true,
    nodeSize: 'in-degree',
    labelVisibility: 'all', // Set to 'all' to make sure labels are visible
    arrowStyle: 'tapered',
    influenceThreshold: 0,
    
    // Enhanced force layout parameters
    forceParams: {
        charge: -300,
        linkDistance: 60,
        gravity: 0.1,
        collisionStrength: 0.7
    },
    
    // Component/community organization
    componentAttraction: 0.5,
    communityAttraction: 0.3,
    showInactiveNodes: true, // Ensure inactive (waiting) pieces are shown
    inactiveNodeDistance: 100,
    
    // Color schemes
    colorBy: 'community', // 'community', 'component', 'piece-type', 'piece-color'
    communityColors: d3.scaleOrdinal(d3.schemeCategory10),
    componentColors: d3.scaleOrdinal(d3.schemeSet3),
    
    // Sorting options
    sortNodesBy: 'none',
    sortComponentsBy: 'size',
    sortCommunitiesBy: 'size',
    optimizeConnections: true,
    
    // Filter state
    filters: {},
    enableFiltering: false,
    
    // Indices for fast lookups
    moveIndices: {},
    pieceIndices: {},
    
    // Performance optimization settings
    performance: {
        enabled: true,
        nodeCulling: true,
        lodRendering: true,
        forceOptimization: true,
        autoTune: true
    },
    
    // Advanced controls visibility
    advancedControlsVisible: false // Track whether advanced controls are visible
};

// DOM Elements Cache
const DOM = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', initializeApp);

/**
 * Initializes the application.
 */
function initializeApp() {
    console.log('Initializing Chess Influence Network Visualization');
    
    // Initialize DOM element references with the IDs from the HTML
    initializeDOMReferences();
    
    // Run diagnostics to check for issues
    const diagnosticsResult = debugDOMElements();
    if (!diagnosticsResult.validDOMStructure) {
        console.error('Critical DOM structure issues detected. Attempting to continue anyway.');
    }
    
    // Check if network container exists
    if (!DOM.networkContainer) {
        console.error('Network container not found! Creating fallback container.');
        createFallbackContainer();
    }
    
    // Initialize layout manager if available
    if (window.LayoutManager) {
        window.layoutManager = LayoutManager();
        console.log('Layout manager initialized');
    }
    
    // Initialize D3 visualizations - create an instance of the visualization
    window.d3viz = D3BaseVisualization ? D3BaseVisualization() : null;
    if (window.d3viz) {
        console.log('D3 visualization initialized');
        
        // Add the clear method to D3 visualization if it doesn't exist
        enhanceD3Visualization();
    } else {
        console.error('D3BaseVisualization not available');
    }
    
    // Initialize metrics display
    window.metricsDisplay = typeof MetricsDisplay === 'function' ? MetricsDisplay() : null;
    if (window.metricsDisplay) {
        console.log('MetricsDisplay initialized');
    } else {
        console.warn('MetricsDisplay not available');
    }
    
    // Attach event listeners
    attachEventListeners();
    
    // Load chess game data
    loadGameData();
    
    // Initialize advanced controls if available
    if (window.AdvancedControls) {
        initializeAdvancedControls();
    } else {
        console.warn('AdvancedControls module not available');
    }
}

/**
 * Creates a fallback container if the main container is missing
 */
function createFallbackContainer() {
    const mainContent = document.querySelector('.main-content') || document.body;
    const fallbackContainer = document.createElement('div');
    fallbackContainer.id = 'network-container';
    fallbackContainer.style.width = '100%';
    fallbackContainer.style.height = '500px';
    fallbackContainer.style.backgroundColor = '#0b132b';
    mainContent.appendChild(fallbackContainer);
    DOM.networkContainer = fallbackContainer;
    console.log('Created fallback network container');
}

/**
 * Initialize DOM element references based on the actual HTML structure
 */
function initializeDOMReferences() {
    console.log('Initializing DOM element references...');
    
    // Move navigation
    DOM.moveSlider = document.getElementById('move-slider-input');
    DOM.currentMoveNumber = document.getElementById('current-move-number');
    DOM.currentMoveNotation = document.getElementById('current-move-notation');
    DOM.prevMoveBtn = document.getElementById('prev-move-btn');
    DOM.playPauseBtn = document.getElementById('play-pause-btn');
    DOM.nextMoveBtn = document.getElementById('next-move-btn');
    
    // Layout controls
    DOM.layoutSelect = document.getElementById('layout-select-dropdown');
    DOM.autoTuneCheckbox = document.getElementById('auto-tune-checkbox');
    
    // Graph selection
    DOM.graphTypeRadios = document.querySelectorAll('input[name="graph-type"]');
    
    // Node styling
    DOM.nodeSizeSelect = document.getElementById('node-size-select');
    DOM.labelVisibilitySelect = document.getElementById('label-visibility-select');
    
    // Edge styling
    DOM.arrowStyleSelect = document.getElementById('arrow-style-select');
    DOM.influenceThreshold = document.getElementById('influence-threshold-slider');
    DOM.influenceThresholdValue = document.getElementById('influence-threshold-value');
    
    // Visual effects
    DOM.showCommunitiesCheckbox = document.getElementById('show-communities-checkbox');
    DOM.showAnimationCheckbox = document.getElementById('show-animation-checkbox');
    DOM.showInactiveNodesCheckbox = document.getElementById('show-inactive-nodes-checkbox');
    DOM.colorBySelect = document.getElementById('color-by-select');
    
    // Advanced controls 
    DOM.advancedControlsContainer = document.getElementById('advanced-controls-container');
    DOM.toggleAdvancedControls = document.getElementById('toggle-advanced-controls-btn');
    
    // Component/community attraction
    DOM.componentAttractionSlider = document.getElementById('component-attraction');
    DOM.communityAttractionSlider = document.getElementById('community-attraction');
    DOM.componentAttractionValue = document.getElementById('component-attraction-value');
    DOM.communityAttractionValue = document.getElementById('community-attraction-value');
    
    // Force parameters
    DOM.forceChargeSlider = document.getElementById('force-charge');
    DOM.forceLinkDistanceSlider = document.getElementById('force-link-distance');
    DOM.forceGravitySlider = document.getElementById('force-gravity');
    DOM.forceCollisionSlider = document.getElementById('force-collision');
    DOM.forceChargeValue = document.getElementById('force-charge-value');
    DOM.forceLinkDistanceValue = document.getElementById('force-link-distance-value');
    DOM.forceGravityValue = document.getElementById('force-gravity-value');
    DOM.forceCollisionValue = document.getElementById('force-collision-value');
    
    // Metrics panel
    DOM.fenString = document.getElementById('fen-string-display');
    DOM.metricsTabs = document.querySelectorAll('.tab-btn');
    DOM.metricsContents = document.querySelectorAll('.metrics-content');
    DOM.selectedNodeInfo = document.getElementById('selected-node-info-panel');
    
    // Zoom controls
    DOM.zoomInBtn = document.getElementById('zoom-in-btn');
    DOM.zoomOutBtn = document.getElementById('zoom-out-btn');
    DOM.zoomResetBtn = document.getElementById('zoom-reset-btn');
    
    // Visualization container
    DOM.networkContainer = document.getElementById('network-container');
    
    // Tooltip
    DOM.tooltip = document.getElementById('tooltip-container');
    
    // Performance optimization controls
    DOM.performanceToggle = document.getElementById('performance-toggle-checkbox');
    DOM.nodeCullingToggle = document.getElementById('node-culling-toggle-checkbox');
    DOM.lodRenderingToggle = document.getElementById('lod-rendering-toggle-checkbox');
    DOM.forceOptimizationToggle = document.getElementById('force-optimization-toggle-checkbox');
    DOM.autoOptimizeBtn = document.getElementById('auto-optimize-btn');
    
    console.log('DOM element references initialized');
}

/**
 * Enhance the D3 visualization with additional methods
 */
function enhanceD3Visualization() {
    // Add clear method to the D3BaseVisualization if it doesn't exist
    if (window.d3viz && !window.d3viz.clear) {
        window.d3viz.clear = function() {
            const svg = this.getSvgContainer ? 
                this.getSvgContainer() : 
                document.querySelector('#network-container svg');
                
            if (!svg) {
                console.warn('Could not find SVG container to clear');
                return;
            }
            
            // Clear all visualization elements
            try {
                const nodeGroup = d3.select(svg).select('.node-group');
                const linkGroup = d3.select(svg).select('.link-group');
                const hullGroup = d3.select(svg).select('.hull-group');
                
                if (nodeGroup.node()) nodeGroup.html('');
                if (linkGroup.node()) linkGroup.html('');
                if (hullGroup.node()) hullGroup.html('');
                
                console.log('Cleared existing visualization elements');
            } catch (error) {
                console.error('Error clearing visualization:', error);
            }
        };
    }
    
    // Add getSvgContainer method if it doesn't exist
    if (window.d3viz && !window.d3viz.getSvgContainer) {
        window.d3viz.getSvgContainer = function() {
            // This would depend on how d3viz stores its SVG element
            // For now, just find it in the DOM
            return document.querySelector('#network-container svg');
        };
    }
    
    // Override update method to ensure proper clearing
    if (window.d3viz && window.d3viz.update) {
        const originalUpdate = window.d3viz.update;
        window.d3viz.update = function(config) {
            console.log("D3viz update called with config:", config);
            
            // Clear existing nodes first
            if (this.clear) {
                this.clear();
                console.log('Cleared visualization before update');
            }
            
            // Call the original update method
            try {
                return originalUpdate.call(this, config);
            } catch (error) {
                console.error('Error during d3viz update:', error);
                // Display error message in visualization area
                this.showError("Failed to update visualization: " + error.message);
            }
        };
        
        // Add error display method
        window.d3viz.showError = function(message) {
            const container = document.getElementById('network-container');
            if (!container) return;
            
            container.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #ff5555;">
                    <h3>Visualization Error</h3>
                    <p>${message}</p>
                    <button onclick="location.reload()" style="margin-top: 10px; padding: 5px 10px;">Reload Page</button>
                </div>
            `;
        };
        
        console.log('Enhanced D3 visualization with improved update method');
    }
}

/**
 * Initializes the advanced controls
 */
function initializeAdvancedControls() {
    // Check if advanced controls container exists
    if (!DOM.advancedControlsContainer) {
        console.warn('Advanced controls container not found');
        return;
    }
    
    // Check if AdvancedControls is available
    if (!window.AdvancedControls) {
        console.warn('AdvancedControls module not available');
        return;
    }
    
    // Initialize the advanced controls
    try {
        window.AdvancedControls.init({
            container: DOM.advancedControlsContainer,
            onFilterChange: handleFilterChange,
            onSortingChange: handleSortingChange,
            onLayoutOptimizationChange: handleLayoutOptimizationChange,
            onColoringChange: handleColoringChange
        });
        
        // Fix toggle functionality for advanced controls
        if (DOM.toggleAdvancedControls) {
            DOM.toggleAdvancedControls.addEventListener('click', function() {
                // Toggle visibility state
                AppState.advancedControlsVisible = !AppState.advancedControlsVisible;
                
                // Update UI based on state
                DOM.advancedControlsContainer.style.display = AppState.advancedControlsVisible ? 'block' : 'none';
                
                // Update button text
                DOM.toggleAdvancedControls.innerHTML = AppState.advancedControlsVisible ? 
                    '<i class="fas fa-sliders-h"></i> Hide Advanced Controls' : 
                    '<i class="fas fa-sliders-h"></i> Show Advanced Controls';
                    
                console.log('Advanced controls visibility toggled:', AppState.advancedControlsVisible);
            });
            
            // Set initial state
            DOM.advancedControlsContainer.style.display = AppState.advancedControlsVisible ? 'block' : 'none';
        }
        
        // Update with initial data if available
        if (AppState.gameData && AppState.movesArray.length > 0) {
            const currentMove = AppState.movesArray[AppState.currentMoveIndex];
            if (currentMove) {
                window.AdvancedControls.updateWithData(currentMove);
            }
        }
        
        console.log('Advanced controls initialized');
    } catch (error) {
        console.error('Error initializing advanced controls:', error);
    }
}

/**
 * Attaches event listeners to UI controls
 */
function attachEventListeners() {
    console.log('Attaching event listeners to UI controls...');
    
    // Move navigation
    if (DOM.moveSlider) {
        console.log('Setting up move slider events');
        // Remove any existing listeners to prevent duplicates
        DOM.moveSlider.removeEventListener('input', handleMoveSliderChange);
        // Add the listener
        DOM.moveSlider.addEventListener('input', handleMoveSliderChange);
    } else {
        console.warn('Move slider element not found');
    }
    
    if (DOM.prevMoveBtn) {
        DOM.prevMoveBtn.removeEventListener('click', showPreviousMove);
        DOM.prevMoveBtn.addEventListener('click', showPreviousMove);
    } else {
        console.warn('Previous move button not found');
    }
    
    if (DOM.playPauseBtn) {
        DOM.playPauseBtn.removeEventListener('click', togglePlayback);
        DOM.playPauseBtn.addEventListener('click', togglePlayback);
    } else {
        console.warn('Play/pause button not found');
    }
    
    if (DOM.nextMoveBtn) {
        DOM.nextMoveBtn.removeEventListener('click', showNextMove);
        DOM.nextMoveBtn.addEventListener('click', showNextMove);
    } else {
        console.warn('Next move button not found');
    }
    
    // Layout selection
    if (DOM.layoutSelect) {
        console.log('Setting up layout selection events');
        DOM.layoutSelect.removeEventListener('change', handleLayoutChange);
        DOM.layoutSelect.addEventListener('change', handleLayoutChange);
    } else {
        console.warn('Layout select element not found');
    }
    
    // Auto-tune checkbox
    if (DOM.autoTuneCheckbox) {
        DOM.autoTuneCheckbox.removeEventListener('change', handleAutoTuneChange);
        DOM.autoTuneCheckbox.addEventListener('change', handleAutoTuneChange);
    } else {
        console.warn('Auto-tune checkbox not found');
    }
    
    // Graph type selection
    if (DOM.graphTypeRadios && DOM.graphTypeRadios.length > 0) {
        console.log('Setting up graph type radio events for', DOM.graphTypeRadios.length, 'elements');
        DOM.graphTypeRadios.forEach(radio => {
            radio.removeEventListener('change', handleGraphTypeChange);
            radio.addEventListener('change', handleGraphTypeChange);
        });
    } else {
        console.warn('Graph type radio elements not found');
    }
    
    // Node styling
    if (DOM.nodeSizeSelect) {
        DOM.nodeSizeSelect.removeEventListener('change', handleNodeSizeChange);
        DOM.nodeSizeSelect.addEventListener('change', handleNodeSizeChange);
    }
    
    if (DOM.labelVisibilitySelect) {
        DOM.labelVisibilitySelect.removeEventListener('change', handleLabelVisibilityChange);
        DOM.labelVisibilitySelect.addEventListener('change', handleLabelVisibilityChange);
    }
    
    // Edge styling
    if (DOM.arrowStyleSelect) {
        DOM.arrowStyleSelect.removeEventListener('change', handleArrowStyleChange);
        DOM.arrowStyleSelect.addEventListener('change', handleArrowStyleChange);
    }
    
    if (DOM.influenceThreshold) {
        DOM.influenceThreshold.removeEventListener('input', handleInfluenceThresholdChange);
        DOM.influenceThreshold.addEventListener('input', handleInfluenceThresholdChange);
    }
    
    // Visual effects
    if (DOM.showCommunitiesCheckbox) {
        DOM.showCommunitiesCheckbox.removeEventListener('change', handleShowCommunitiesChange);
        DOM.showCommunitiesCheckbox.addEventListener('change', handleShowCommunitiesChange);
    }
    
    if (DOM.showAnimationCheckbox) {
        DOM.showAnimationCheckbox.removeEventListener('change', handleShowAnimationChange);
        DOM.showAnimationCheckbox.addEventListener('change', handleShowAnimationChange);
    }
    
    if (DOM.showInactiveNodesCheckbox) {
        DOM.showInactiveNodesCheckbox.removeEventListener('change', handleShowInactiveNodesChange);
        DOM.showInactiveNodesCheckbox.addEventListener('change', handleShowInactiveNodesChange);
    }
    
    // Color by
    if (DOM.colorBySelect) {
        DOM.colorBySelect.removeEventListener('change', handleColorByChange);
        DOM.colorBySelect.addEventListener('change', handleColorByChange);
    }
    
    // Advanced controls toggle
    if (DOM.toggleAdvancedControls) {
        DOM.toggleAdvancedControls.removeEventListener('click', toggleAdvancedControls);
        DOM.toggleAdvancedControls.addEventListener('click', toggleAdvancedControls);
        console.log('Advanced controls toggle event attached');
    } else {
        console.warn('Advanced controls toggle button not found');
    }
    
    // Metrics tabs
    if (DOM.metricsTabs && DOM.metricsTabs.length > 0) {
        DOM.metricsTabs.forEach(tab => {
            tab.removeEventListener('click', handleMetricsTabClick);
            tab.addEventListener('click', handleMetricsTabClick);
        });
    }
    
    // Zoom controls
    if (DOM.zoomInBtn && window.d3viz) {
        DOM.zoomInBtn.removeEventListener('click', handleZoomIn);
        DOM.zoomInBtn.addEventListener('click', handleZoomIn);
    }
    
    if (DOM.zoomOutBtn && window.d3viz) {
        DOM.zoomOutBtn.removeEventListener('click', handleZoomOut);
        DOM.zoomOutBtn.addEventListener('click', handleZoomOut);
    }
    
    if (DOM.zoomResetBtn && window.d3viz) {
        DOM.zoomResetBtn.removeEventListener('click', handleZoomReset);
        DOM.zoomResetBtn.addEventListener('click', handleZoomReset);
    }
    
    // Performance optimization controls
    if (DOM.performanceToggle) {
        DOM.performanceToggle.removeEventListener('change', handlePerformanceToggle);
        DOM.performanceToggle.addEventListener('change', handlePerformanceToggle);
    }
    
    if (DOM.nodeCullingToggle) {
        DOM.nodeCullingToggle.removeEventListener('change', handleNodeCullingToggle);
        DOM.nodeCullingToggle.addEventListener('change', handleNodeCullingToggle);
    }
    
    if (DOM.lodRenderingToggle) {
        DOM.lodRenderingToggle.removeEventListener('change', handleLodRenderingToggle);
        DOM.lodRenderingToggle.addEventListener('change', handleLodRenderingToggle);
    }
    
    if (DOM.forceOptimizationToggle) {
        DOM.forceOptimizationToggle.removeEventListener('change', handleForceOptimizationToggle);
        DOM.forceOptimizationToggle.addEventListener('change', handleForceOptimizationToggle);
    }
    
    // Auto-optimize button
    if (DOM.autoOptimizeBtn) {
        DOM.autoOptimizeBtn.removeEventListener('click', autoOptimizePerformance);
        DOM.autoOptimizeBtn.addEventListener('click', autoOptimizePerformance);
    }
    
    // Window resize handling
    window.removeEventListener('resize', handleWindowResize);
    window.addEventListener('resize', handleWindowResize);
    
    // Add zoom event listener to d3viz if it supports it
    if (window.d3viz && window.d3viz.onZoom) {
        window.d3viz.onZoom(handleZoomLevelChange);
    }
    
    console.log('Event listeners attached successfully');
}

// Handler functions for various controls
function handleMoveSliderChange(e) {
    console.log('Move slider change detected', e.target.value);
    
    try {
        // Convert value to integer
        const newMoveIndex = parseInt(e.target.value);
        
        // Only update if the index has actually changed
        if (newMoveIndex !== AppState.currentMoveIndex) {
            // Store current visualization state before changing move
            const currentState = {
                layout: AppState.currentLayout,
                graphType: AppState.selectedGraphType,
                nodeSize: AppState.nodeSize,
                labelVisibility: AppState.labelVisibility,
                arrowStyle: AppState.arrowStyle,
                influenceThreshold: AppState.influenceThreshold,
                showCommunities: AppState.showCommunities,
                showInactiveNodes: AppState.showInactiveNodes,
                colorBy: AppState.colorBy
            };
            
            // Update the current move index
            AppState.currentMoveIndex = newMoveIndex;
            
            // Update move display
            updateMoveDisplay(newMoveIndex);
            
            // Log the change
            console.log('Move changed to', newMoveIndex, 'with layout', currentState.layout);
            
            // Force visualization update with current preferences
            updateVisualization();
            
            // Auto-tune if enabled
            if (AppState.autoTuneEnabled) {
                console.log('Auto-tuning after move change');
                autoTuneLayout();
                // Update again after auto-tuning
                updateVisualization();
            }
            
            // Update performance optimizer if enabled
            if (AppState.performance.enabled && AppState.performance.autoTune) {
                setTimeout(function() {
                    autoOptimizePerformance();
                }, 100);
            }
            
            // Update advanced controls if available
            if (window.AdvancedControls && AppState.movesArray && AppState.movesArray[AppState.currentMoveIndex]) {
                window.AdvancedControls.updateWithData(AppState.movesArray[AppState.currentMoveIndex]);
            }
        }
    } catch (error) {
        console.error('Error handling move slider change:', error);
    }
}

function handleAutoTuneChange(e) {
    AppState.autoTuneEnabled = e.target.checked;
    if (AppState.autoTuneEnabled) {
        autoTuneLayout();
        updateVisualization();
    }
}

function handleLayoutChange(e) {
    try {
        // Update the current layout
        AppState.currentLayout = e.target.value;
        console.log('Layout changed to:', AppState.currentLayout);
        
        // Auto-tune parameters whenever layout changes
        autoTuneLayout();
        
        // Update the visualization after auto-tuning
        updateVisualization();
        
        // Update advanced controls if available
        if (window.AdvancedControls && AppState.movesArray && AppState.movesArray[AppState.currentMoveIndex]) {
            window.AdvancedControls.updateWithData(AppState.movesArray[AppState.currentMoveIndex]);
        }
        
        // Reset zoom to fit the new layout
        if (window.d3viz && window.d3viz.resetZoom) {
            setTimeout(function() {
                window.d3viz.resetZoom();
            }, 500);
        }
    } catch (error) {
        console.error('Error handling layout change:', error);
    }
}

function handleGraphTypeChange(e) {
    try {
        // Update the selected graph type
        AppState.selectedGraphType = e.target.value;
        console.log('Graph type changed to:', AppState.selectedGraphType);
        
        // Auto-tune for the new graph type
        autoTuneLayout();
        
        // Update the visualization
        updateVisualization();
        
        // Also update the metrics tab to match the selected graph type
        switchMetricsTab(AppState.selectedGraphType);
        
        // Update advanced controls if available
        if (window.AdvancedControls && AppState.movesArray && AppState.movesArray[AppState.currentMoveIndex]) {
            window.AdvancedControls.updateWithData(AppState.movesArray[AppState.currentMoveIndex]);
        }
        
        // Reset zoom to fit the new view
        if (window.d3viz && window.d3viz.resetZoom) {
            setTimeout(function() {
                window.d3viz.resetZoom();
            }, 500);
        }
    } catch (error) {
        console.error('Error handling graph type change:', error);
    }
}

function handleNodeSizeChange(e) {
    AppState.nodeSize = e.target.value;
    updateVisualization();
}

function handleLabelVisibilityChange(e) {
    AppState.labelVisibility = e.target.value;
    updateVisualization();
}

function handleArrowStyleChange(e) {
    AppState.arrowStyle = e.target.value;
    updateVisualization();
}

function handleInfluenceThresholdChange(e) {
    AppState.influenceThreshold = parseFloat(e.target.value);
    if (DOM.influenceThresholdValue) {
        DOM.influenceThresholdValue.textContent = e.target.value;
    }
    updateVisualization();
}

function handleShowCommunitiesChange(e) {
    AppState.showCommunities = e.target.checked;
    updateVisualization();
}

function handleShowAnimationChange(e) {
    AppState.animationEnabled = e.target.checked;
    updateVisualization();
}

function handleShowInactiveNodesChange(e) {
    AppState.showInactiveNodes = e.target.checked;
    updateVisualization();
}

function handleColorByChange(e) {
    AppState.colorBy = e.target.value;
    updateVisualization();
}

function handlePerformanceToggle(e) {
    AppState.performance.enabled = e.target.checked;
    if (window.PerformanceOptimizer) {
        window.PerformanceOptimizer.setEnabled(AppState.performance.enabled);
    }
    // If disabled, update visualization to restore full quality
    if (!AppState.performance.enabled) {
        updateVisualization();
    }
}

function handleNodeCullingToggle(e) {
    AppState.performance.nodeCulling = e.target.checked;
    if (window.PerformanceOptimizer) {
        window.PerformanceOptimizer.setOptimizationOptions({
            nodeCulling: AppState.performance.nodeCulling,
            lodRendering: AppState.performance.lodRendering,
            forceOptimization: AppState.performance.forceOptimization
        });
    }
}

function handleLodRenderingToggle(e) {
    AppState.performance.lodRendering = e.target.checked;
    if (window.PerformanceOptimizer) {
        window.PerformanceOptimizer.setOptimizationOptions({
            nodeCulling: AppState.performance.nodeCulling,
            lodRendering: AppState.performance.lodRendering,
            forceOptimization: AppState.performance.forceOptimization
        });
    }
}

function handleForceOptimizationToggle(e) {
    AppState.performance.forceOptimization = e.target.checked;
    if (window.PerformanceOptimizer) {
        window.PerformanceOptimizer.setOptimizationOptions({
            nodeCulling: AppState.performance.nodeCulling,
            lodRendering: AppState.performance.lodRendering,
            forceOptimization: AppState.performance.forceOptimization
        });
    }
}

function handleMetricsTabClick(e) {
    const tabName = e.target.dataset.tab;
    switchMetricsTab(tabName);
}

function handleZoomIn() {
    if (window.d3viz && window.d3viz.zoomIn) {
        window.d3viz.zoomIn();
        
        // Update zoom level in AppState
        setTimeout(function() {
            AppState.zoomLevel = window.d3viz.getZoomLevel ? window.d3viz.getZoomLevel() : 1;
            
            // Update performance optimizer with new zoom level
            if (window.PerformanceOptimizer && AppState.performance.enabled) {
                window.PerformanceOptimizer.updateZoomLevel(AppState.zoomLevel);
            }
        }, 50);
    }
}

function handleZoomOut() {
    if (window.d3viz && window.d3viz.zoomOut) {
        window.d3viz.zoomOut();
        
        // Update zoom level in AppState
        setTimeout(function() {
            AppState.zoomLevel = window.d3viz.getZoomLevel ? window.d3viz.getZoomLevel() : 1;
            
            // Update performance optimizer with new zoom level
            if (window.PerformanceOptimizer && AppState.performance.enabled) {
                window.PerformanceOptimizer.updateZoomLevel(AppState.zoomLevel);
            }
        }, 50);
    }
}

function handleZoomReset() {
    if (window.d3viz && window.d3viz.resetZoom) {
        window.d3viz.resetZoom();
        
        // Reset zoom level in AppState
        AppState.zoomLevel = 1;
        
        // Update performance optimizer with reset zoom level
        if (window.PerformanceOptimizer && AppState.performance.enabled) {
            window.PerformanceOptimizer.updateZoomLevel(AppState.zoomLevel);
        }
    }
}

function handleZoomLevelChange(zoomLevel) {
    AppState.zoomLevel = zoomLevel;
    
    // Update performance optimizer with new zoom level
    if (window.PerformanceOptimizer && AppState.performance.enabled) {
        window.PerformanceOptimizer.updateZoomLevel(AppState.zoomLevel);
    }
}

function handleWindowResize() {
    // Resize the visualization
    if (window.d3viz && window.d3viz.resize) {
        window.d3viz.resize();
        
        // Update performance optimizer after resize if available
        if (window.PerformanceOptimizer && AppState.performance.enabled) {
            // Allow a moment for the resize to complete
            setTimeout(() => {
                const currentMove = AppState.movesArray[AppState.currentMoveIndex];
                if (currentMove) {
                    window.PerformanceOptimizer.update({
                        nodes: currentMove.graph_nodes,
                        links: currentMove.graph_edges,
                        zoomLevel: AppState.zoomLevel
                    });
                }
            }, 100);
        }
    }
}

function handleFilterChange(filters) {
    console.log('Filter changed:', filters);
    
    // Store the filters in AppState
    AppState.filters = { ...filters };
    AppState.enableFiltering = true;
    
    // Update the visualization with filtered data
    updateVisualizationWithFilters();
}

function handleSortingChange(sortingOptions) {
    console.log('Sorting changed:', sortingOptions);
    
    // Update AppState with sorting options
    AppState.sortNodesBy = sortingOptions.nodesBy;
    AppState.sortComponentsBy = sortingOptions.componentsBy;
    AppState.sortCommunitiesBy = sortingOptions.communitiesBy;
    AppState.optimizeConnections = sortingOptions.optimizeConnections;
    
    // Update the visualization with new sorting
    updateVisualization();
}

function handleLayoutOptimizationChange(options) {
    console.log('Layout optimization changed:', options);
    
    // Check for auto-tune request
    if (options.autoTune) {
        autoTuneLayout();
        return;
    }
    
    // Update AppState with layout options
    AppState.componentAttraction = options.componentAttraction;
    AppState.communityAttraction = options.communityAttraction;
    AppState.forceParams = { ...options.forceParams };
    
    // Update force parameters
    updateForceParameters();
    
    // Update visualization
    updateVisualization();
}

function handleColoringChange(options) {
    console.log('Coloring changed:', options);
    
    // Update AppState with coloring options
    AppState.colorBy = options.colorBy;
    AppState.showCommunities = options.showCommunities;
    AppState.nodeSize = options.nodeSize;
    AppState.influenceThreshold = options.influenceThreshold;
    
    // Update the visualization
    updateVisualization();
}

/**
 * Toggles the visibility of advanced controls
 */
function toggleAdvancedControls() {
    if (!DOM.advancedControlsContainer) {
        console.warn('Advanced controls container not found');
        return;
    }
    
    // Toggle visibility state
    AppState.advancedControlsVisible = !AppState.advancedControlsVisible;
    console.log('Toggle advanced controls:', AppState.advancedControlsVisible);
    
    // Update UI based on state
    DOM.advancedControlsContainer.style.display = AppState.advancedControlsVisible ? 'block' : 'none';
    
    // Update button text
    if (DOM.toggleAdvancedControls) {
        DOM.toggleAdvancedControls.innerHTML = AppState.advancedControlsVisible ? 
            '<i class="fas fa-sliders-h"></i> Hide Advanced Controls' : 
            '<i class="fas fa-sliders-h"></i> Show Advanced Controls';
    }
}

/**
 * Shows the previous move
 */
function showPreviousMove() {
    if (AppState.currentMoveIndex > 0) {
        AppState.currentMoveIndex--;
        updateMoveDisplay(AppState.currentMoveIndex);
        
        // Force visualization update
        updateVisualization();
        console.log('Moved to previous move', AppState.currentMoveIndex);
    }
}

/**
 * Shows the next move
 */
function showNextMove() {
    if (AppState.currentMoveIndex < AppState.totalMoves - 1) {
        AppState.currentMoveIndex++;
        updateMoveDisplay(AppState.currentMoveIndex);
        
        // Force visualization update
        updateVisualization();
        console.log('Moved to next move', AppState.currentMoveIndex);
    }
}

/**
 * Toggles the playback of moves
 */
function togglePlayback() {
    if (AppState.isPlaying) {
        // Stop playback
        clearInterval(AppState.playbackTimer);
        AppState.isPlaying = false;
        if (DOM.playPauseBtn) DOM.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    } else {
        // Start playback if not at the end
        if (AppState.currentMoveIndex < AppState.totalMoves - 1) {
            AppState.isPlaying = true;
            if (DOM.playPauseBtn) DOM.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            
            AppState.playbackTimer = setInterval(() => {
                if (AppState.currentMoveIndex < AppState.totalMoves - 1) {
                    AppState.currentMoveIndex++;
                    updateMoveDisplay(AppState.currentMoveIndex);
                    updateVisualization();
                } else {
                    // Stop playback at the end
                    clearInterval(AppState.playbackTimer);
                    AppState.isPlaying = false;
                    if (DOM.playPauseBtn) DOM.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
                }
            }, AppState.playbackSpeed);
        }
    }
}

/**
 * Switches the active metrics tab
 * 
 * @param {string} tabName - The name of the tab to activate
 */
function switchMetricsTab(tabName) {
    // Update tab buttons
    if (DOM.metricsTabs) {
        DOM.metricsTabs.forEach(tab => {
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }
    
    // Update tab contents
    if (DOM.metricsContents) {
        DOM.metricsContents.forEach(content => {
            if (content.id === `${tabName}-metrics-panel`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
    }
}

/**
 * Loads the game data from the server
 */
function loadGameData() {
    console.log('Attempting to load game data...');
    
    // Fetch game data from JSON file with proper error handling
    fetch('game_data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Successfully loaded game data');
            
            // Store the game data
            processGameData(data);
            
            // Initialize the visualization with the first move
            initializeVisualization();
            
            // Update advanced controls with initial data if available
            if (window.AdvancedControls && AppState.movesArray && AppState.movesArray.length > 0) {
                const initialMove = AppState.movesArray[0];
                window.AdvancedControls.updateWithData(initialMove);
            }
        })
        .catch(error => {
            console.error('Error loading game data:', error);
            // Display a user-friendly error message
            if (DOM.networkContainer) {
                DOM.networkContainer.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #ff5555;">
                        <h3>Data Loading Error</h3>
                        <p>Could not load chess game data: ${error.message}</p>
                        <button onclick="location.reload()" style="margin-top: 10px; padding: 5px 10px;">Retry</button>
                    </div>
                `;
            }
            
            // If fetch fails, use a sample empty board state for development
            useEmptyBoardForTesting();
        });
}

/**
 * Processes the loaded game data to prepare for visualization
 * 
 * @param {Object} data - The loaded game data
 */
function processGameData(data) {
    try {
        console.log('Processing game data:', data);
        // Store the original data
        AppState.gameData = data;
        
        // Convert from object structure to array for easier navigation
        AppState.movesArray = [];
        AppState.moveMapping = {};
        
        // Check if we have the new schema with metadata and moves objects
        if (data && data.metadata && data.moves) {
            console.log('Using new schema format with indices');
            
            // Convert moves object to array and create mapping
            if (typeof data.moves === 'object') {
                // Get keys and sort them numerically
                const moveKeys = Object.keys(data.moves).sort((a, b) => {
                    return parseInt(a) - parseInt(b);
                });
                
                // Create moves array from sorted keys
                AppState.movesArray = moveKeys.map(key => data.moves[key]);
                
                // Create move mapping
                moveKeys.forEach((key, index) => {
                    const moveNumber = parseInt(key);
                    AppState.moveMapping[moveNumber] = index;
                });
                
                console.log(`Processed ${AppState.movesArray.length} moves from object structure`);
            } else if (Array.isArray(data.moves)) {
                // If moves is already an array, use it directly
                AppState.movesArray = data.moves;
                data.moves.forEach((move, index) => {
                    if (move && move.move_number !== undefined) {
                        AppState.moveMapping[move.move_number] = index;
                    }
                });
                console.log(`Processed ${AppState.movesArray.length} moves from array structure`);
            }
            
            // Store indices for lookups
            if (data.indices) {
                AppState.moveIndices = data.indices.moves_by_number || {};
                AppState.pieceIndices = data.indices.pieces_by_id || {};
            } else {
                // Create indices if they don't exist
                createIndices(AppState.movesArray);
            }
        } else if (Array.isArray(data)) {
            console.log('Using legacy flattened format with', data.length, 'moves');
            
            // The data is already in array format
            AppState.movesArray = data;
            
            // Create mapping
            data.forEach((move, index) => {
                if (move && move.move_number !== undefined) {
                    AppState.moveMapping[move.move_number] = index;
                }
            });
            
            // Create indices
            createIndices(data);
        } else {
            console.error('Unknown data format, trying to adapt:', data);
            
            // Try to adapt to whatever structure we have
            if (data && typeof data === 'object') {
                // Check if data fields might match a single move
                if (data.move_number !== undefined && data.fen) {
                    // It's a single move - wrap it in an array
                    AppState.movesArray = [data];
                    if (data.move_number !== undefined) {
                        AppState.moveMapping[data.move_number] = 0;
                    }
                } else {
                    // Try to extract moves from the object
                    const possibleMoves = [];
                    for (const key in data) {
                        const item = data[key];
                        if (item && typeof item === 'object' && item.move_number !== undefined && item.fen) {
                            possibleMoves.push(item);
                            AppState.moveMapping[item.move_number] = possibleMoves.length - 1;
                        }
                    }
                    
                    if (possibleMoves.length > 0) {
                        AppState.movesArray = possibleMoves;
                        console.log('Adapted object to array with', possibleMoves.length, 'moves');
                    } else {
                        console.error('Failed to adapt data structure, using empty array');
                        AppState.movesArray = [];
                    }
                }
            } else {
                console.error('Invalid data format, using empty array');
                AppState.movesArray = [];
            }
            
            // Create indices
            createIndices(AppState.movesArray);
        }
        
        // Set total moves
        AppState.totalMoves = AppState.movesArray.length;
        
        // Update the move slider max value
        if (DOM.moveSlider) DOM.moveSlider.max = AppState.totalMoves - 1;
        
        console.log(`Final move array has ${AppState.movesArray.length} moves`);
    } catch (error) {
        console.error('Error processing game data:', error);
        AppState.gameData = data || {};
        AppState.movesArray = [];
        AppState.totalMoves = 0;
    }
}

/**
 * Creates indices for fast lookups when using the legacy format
 * 
 * @param {Array} data - The game data in array format
 */
function createIndices(data) {
    // Create move indices
    AppState.moveIndices = {};
    data.forEach((move, index) => {
        if (move && move.move_number !== undefined) {
            AppState.moveIndices[move.move_number] = index;
        }
    });
    
    // Create piece indices
    AppState.pieceIndices = {};
    
    // Extract pieces from different possible formats
    data.forEach((move, moveIndex) => {
        let pieces = [];
        
        // Check for pieces array first
        if (move && move.pieces && Array.isArray(move.pieces)) {
            pieces = move.pieces;
        }
        // Then check for active_pieces, inactive_pieces, etc.
        else if (move) {
            ['active_pieces', 'inactive_pieces', 'captured_pieces', 'promoted_pieces'].forEach(pieceType => {
                if (move[pieceType]) {
                    if (Array.isArray(move[pieceType])) {
                        // If it's an array, add all pieces
                        pieces = pieces.concat(move[pieceType]);
                    } else if (typeof move[pieceType] === 'object') {
                        // If it's an object (keyed by ID), convert to array
                        for (const pieceId in move[pieceType]) {
                            pieces.push(move[pieceType][pieceId]);
                        }
                    }
                }
            });
        }
        
        // Track each piece
        pieces.forEach(piece => {
            if (!piece || !piece.id) return;
            
            if (!AppState.pieceIndices[piece.id]) {
                AppState.pieceIndices[piece.id] = {
                    first_seen: moveIndex,
                    last_seen: moveIndex,
                    status: piece.status
                };
            } else {
                // Update last seen
                AppState.pieceIndices[piece.id].last_seen = moveIndex;
                // Update status
                AppState.pieceIndices[piece.id].status = piece.status;
            }
        });
    });
}

/**
 * Initializes the visualization with the first move
 */
function initializeVisualization() {
    if (!AppState.movesArray || AppState.movesArray.length === 0) {
        console.error('No move data available to visualize');
        return;
    }
    
    if (!window.d3viz) {
        console.error('D3 visualization not initialized');
        return;
    }
    
    try {
        // Get the initial board state
        const initialMove = AppState.movesArray[0];
        if (!initialMove) {
            console.error('Initial move is undefined');
            return;
        }
        
        console.log('Initializing with move:', initialMove);
        
        // Create a deep copy of the data to avoid modifying the original
        const moveData = JSON.parse(JSON.stringify(initialMove));
        
        // Process inactive nodes
        if (AppState.showInactiveNodes) {
            processInactiveNodes(moveData);
        }
        
        // Validate and enhance piece data if possible
        if (window.ChessUtilities && window.ChessUtilities.validatePieceData) {
            moveData.graph_nodes = window.ChessUtilities.validatePieceData(moveData.graph_nodes || []);
        }
        
        if (window.ChessUtilities && window.ChessUtilities.addNodeDataAttributes) {
            moveData.graph_nodes = window.ChessUtilities.addNodeDataAttributes(moveData.graph_nodes || []);
        }
        
        console.log('Initializing D3 visualization with data:', moveData);
        
        // Initialize D3 visualization
        window.d3viz.init({
            container: DOM.networkContainer,
            data: moveData,
            layout: AppState.currentLayout,
            graphType: AppState.selectedGraphType,
            options: {
                showCommunities: AppState.showCommunities,
                animationEnabled: AppState.animationEnabled,
                nodeSize: AppState.nodeSize,
                labelVisibility: AppState.labelVisibility, // Make sure labels are visible
                arrowStyle: AppState.arrowStyle,
                influenceThreshold: AppState.influenceThreshold,
                showInactiveNodes: AppState.showInactiveNodes, // Show waiting pieces
                forceParams: AppState.forceParams,
                communityAttraction: AppState.communityAttraction,
                componentAttraction: AppState.componentAttraction,
                colorBy: AppState.colorBy,
                sortNodesBy: AppState.sortNodesBy,
                sortComponentsBy: AppState.sortComponentsBy,
                sortCommunitiesBy: AppState.sortCommunitiesBy,
                optimizeConnections: AppState.optimizeConnections
            }
        });
        
        // Initialize metrics display
        if (window.metricsDisplay) {
            window.metricsDisplay.init({
                data: moveData,
                selectedGraph: AppState.selectedGraphType
            });
        } else {
            console.warn('MetricsDisplay not available for initialization');
            
            // Try to initialize metrics display if function exists
            if (typeof MetricsDisplay === 'function') {
                console.log('Attempting to initialize MetricsDisplay again');
                window.metricsDisplay = MetricsDisplay();
                window.metricsDisplay.init({
                    data: moveData,
                    selectedGraph: AppState.selectedGraphType
                });
            }
        }
        
        // Initialize performance optimizer if available
        if (window.PerformanceOptimizer) {
            window.PerformanceOptimizer.init({
                enabled: AppState.performance.enabled,
                d3viz: window.d3viz,
                container: DOM.networkContainer
            });
            
            // Set initial optimization options
            window.PerformanceOptimizer.setOptimizationOptions({
                nodeCulling: AppState.performance.nodeCulling,
                lodRendering: AppState.performance.lodRendering,
                forceOptimization: AppState.performance.forceOptimization
            });
            
            console.log('PerformanceOptimizer initialized');
        } else {
            console.warn('PerformanceOptimizer not available');
        }
        
        // Update the UI to show the initial state
        updateMoveDisplay(0);
        
        console.log('Visualization initialization completed successfully');
    } catch (error) {
        console.error('Error initializing visualization:', error);
        if (DOM.networkContainer) {
            DOM.networkContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #ff5555;">
                    <h3>Visualization Error</h3>
                    <p>Error initializing visualization: ${error.message}</p>
                    <button onclick="location.reload()" style="margin-top: 10px; padding: 5px 10px;">Reload Page</button>
                </div>
            `;
        }
    }
}

/**
 * Updates the visualization with the current move data
 */
function updateVisualization() {
    if (!AppState.movesArray || AppState.currentMoveIndex < 0 || AppState.currentMoveIndex >= AppState.movesArray.length) {
        console.error('Invalid move index or missing move data', AppState.currentMoveIndex);
        return;
    }
    
    if (!window.d3viz) {
        console.error('D3 visualization not initialized');
        return;
    }
    
    try {
        // Check if filters are active
        if (AppState.enableFiltering && window.AdvancedControls) {
            updateVisualizationWithFilters();
            return;
        }
        
        const currentMove = AppState.movesArray[AppState.currentMoveIndex];
        
        if (!currentMove) {
            console.error('Current move is undefined');
            return;
        }
        
        // Create a deep copy of the data to avoid modifying the original
        const moveData = JSON.parse(JSON.stringify(currentMove));
        
        // Process inactive nodes if enabled
        if (AppState.showInactiveNodes) {
            processInactiveNodes(moveData);
        }
        
        // Validate and enhance piece data if possible
        if (window.ChessUtilities && window.ChessUtilities.validatePieceData) {
            moveData.graph_nodes = window.ChessUtilities.validatePieceData(moveData.graph_nodes || []);
        }
        
        if (window.ChessUtilities && window.ChessUtilities.addNodeDataAttributes) {
            moveData.graph_nodes = window.ChessUtilities.addNodeDataAttributes(moveData.graph_nodes || []);
        }
        
        // Handle empty or missing data gracefully
        if (!moveData.graph_nodes || moveData.graph_nodes.length === 0) {
            console.warn('No nodes found in the current move data');
            
            // Create placeholder data if needed
            moveData.graph_nodes = moveData.graph_nodes || [];
            moveData.graph_edges = moveData.graph_edges || [];
        }
        
        // Update the visualization
        window.d3viz.update({
            data: moveData,
            layout: AppState.currentLayout,
            graphType: AppState.selectedGraphType,
            options: {
                showCommunities: AppState.showCommunities,
                animationEnabled: AppState.animationEnabled,
                nodeSize: AppState.nodeSize,
                labelVisibility: AppState.labelVisibility,
                arrowStyle: AppState.arrowStyle,
                influenceThreshold: AppState.influenceThreshold,
                showInactiveNodes: AppState.showInactiveNodes,
                forceParams: AppState.forceParams,
                communityAttraction: AppState.communityAttraction,
                componentAttraction: AppState.componentAttraction,
                colorBy: AppState.colorBy,
                sortNodesBy: AppState.sortNodesBy,
                sortComponentsBy: AppState.sortComponentsBy,
                sortCommunitiesBy: AppState.sortCommunitiesBy,
                optimizeConnections: AppState.optimizeConnections
            }
        });
        
        // Update metrics display if available
        if (window.metricsDisplay) {
            window.metricsDisplay.update({
                data: moveData,
                selectedGraph: AppState.selectedGraphType
            });
        }
        
        // Update AdvancedControls with data if available
        if (window.AdvancedControls) {
            window.AdvancedControls.updateWithData(moveData);
        }
        
        // Update performance optimizer with current data if available
        if (window.PerformanceOptimizer && AppState.performance.enabled) {
            window.PerformanceOptimizer.update({
                nodes: moveData.graph_nodes,
                links: moveData.graph_edges,
                zoomLevel: AppState.zoomLevel
            });
        }
        
        console.log('Visualization update completed for move', AppState.currentMoveIndex);
    } catch (error) {
        console.error('Error updating visualization:', error);
        if (window.d3viz && window.d3viz.showError) {
            window.d3viz.showError("Visualization update failed: " + error.message);
        }
    }
}

/**
 * Updates the visualization with filtered data
 */
function updateVisualizationWithFilters() {
    if (!AppState.movesArray || AppState.currentMoveIndex < 0 || 
        AppState.currentMoveIndex >= AppState.movesArray.length) {
        console.error('Invalid move index or missing game data');
        return;
    }
    
    if (!window.d3viz) {
        console.error('D3 visualization not initialized');
        return;
    }
    
    if (!window.AdvancedControls) {
        console.warn('AdvancedControls not available for filtering');
        updateVisualization(); // Fall back to regular update
        return;
    }
    
    try {
        const currentMove = AppState.movesArray[AppState.currentMoveIndex];
        
        if (!currentMove) {
            console.error('Current move is undefined');
            return;
        }
        
        // Create a deep copy of the data to avoid modifying the original
        let moveData = JSON.parse(JSON.stringify(currentMove));
        
        // Process inactive nodes if enabled
        if (AppState.showInactiveNodes) {
            processInactiveNodes(moveData);
        }
        
        // Apply filters to the nodes
        if (moveData.graph_nodes && moveData.graph_nodes.length) {
            const filteredNodes = window.AdvancedControls.applyFilters(moveData.graph_nodes);
            
            // Update graph_nodes with filtered nodes
            moveData.graph_nodes = filteredNodes;
            
            // Also update edges to remove any without valid source and target
            if (moveData.graph_edges && moveData.graph_edges.length) {
                const validNodeIds = new Set(filteredNodes.map(node => node.id));
                
                moveData.graph_edges = moveData.graph_edges.filter(edge => {
                    const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
                    const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;
                    
                    return validNodeIds.has(sourceId) && validNodeIds.has(targetId);
                });
            }
        }
        
        // Validate and enhance piece data if possible
        if (window.ChessUtilities && window.ChessUtilities.validatePieceData) {
            moveData.graph_nodes = window.ChessUtilities.validatePieceData(moveData.graph_nodes);
        }
        
        if (window.ChessUtilities && window.ChessUtilities.addNodeDataAttributes) {
            moveData.graph_nodes = window.ChessUtilities.addNodeDataAttributes(moveData.graph_nodes);
        }
        
        // Update the visualization
        window.d3viz.update({
            data: moveData,
            layout: AppState.currentLayout,
            graphType: AppState.selectedGraphType,
            options: {
                showCommunities: AppState.showCommunities,
                animationEnabled: AppState.animationEnabled,
                nodeSize: AppState.nodeSize,
                labelVisibility: AppState.labelVisibility,
                arrowStyle: AppState.arrowStyle,
                influenceThreshold: AppState.influenceThreshold,
                showInactiveNodes: AppState.showInactiveNodes,
                forceParams: AppState.forceParams,
                communityAttraction: AppState.communityAttraction,
                componentAttraction: AppState.componentAttraction,
                colorBy: AppState.colorBy,
                sortNodesBy: AppState.sortNodesBy,
                sortComponentsBy: AppState.sortComponentsBy,
                sortCommunitiesBy: AppState.sortCommunitiesBy,
                optimizeConnections: AppState.optimizeConnections
            }
        });
        
        // Update metrics display if available
        if (window.metricsDisplay) {
            window.metricsDisplay.update({
                data: moveData,
                selectedGraph: AppState.selectedGraphType
            });
        }
        
        // Update performance optimizer with filtered data if available
        if (window.PerformanceOptimizer && AppState.performance.enabled) {
            window.PerformanceOptimizer.update({
                nodes: moveData.graph_nodes,
                links: moveData.graph_edges,
                zoomLevel: AppState.zoomLevel
            });
        }
    } catch (error) {
        console.error('Error updating visualization with filters:', error);
        if (window.d3viz && window.d3viz.showError) {
            window.d3viz.showError("Filtered visualization update failed: " + error.message);
        }
    }
}

/**
 * Processes inactive nodes to include them in the visualization
 * 
 * @param {Object} moveData - The current move data
 */
 /**
 * Processes inactive nodes to include them in the visualization
 * Handles both array and object-based schema formats
 * 
 * @param {Object} moveData - The current move data
 */
function processInactiveNodes(moveData) {
    try {
        // Look for inactive pieces in different formats
        let inactivePieces = [];
        
        // Schema 2.0: Check for inactive_pieces as an object keyed by piece ID
        if (moveData.inactive_pieces && typeof moveData.inactive_pieces === 'object' && !Array.isArray(moveData.inactive_pieces)) {
            console.log('Using inactive_pieces from schema 2.0 (object with ID keys)');
            for (const pieceId in moveData.inactive_pieces) {
                const piece = moveData.inactive_pieces[pieceId];
                if (piece) {
                    // Ensure the piece has its ID
                    piece.id = piece.id || pieceId;
                    inactivePieces.push(piece);
                }
            }
        } 
        // Legacy format 1: Check for inactive_pieces as array
        else if (moveData.inactive_pieces && Array.isArray(moveData.inactive_pieces)) {
            console.log('Using inactive_pieces array:', moveData.inactive_pieces.length);
            inactivePieces = [...moveData.inactive_pieces];
        }
        // Legacy format 2: Check for inactive pieces in pieces array
        else if (moveData.pieces && Array.isArray(moveData.pieces)) {
            console.log('Extracting inactive pieces from pieces array');
            inactivePieces = moveData.pieces.filter(piece => piece && piece.status === 'inactive');
        }
        
        console.log('Found inactive pieces:', inactivePieces.length);
        
        if (inactivePieces.length > 0) {
            // Create nodes for inactive pieces
            const inactiveNodes = inactivePieces.map((piece, index) => {
                // Calculate proper positioning values for wall-sticking behavior
                const isWhitePiece = piece.color === 'white';
                const wallPosition = isWhitePiece ? 'bottom' : 'top';
                
                // Space pieces evenly along their respective walls
                // We'll adjust this in the force simulation
                const horizontalPosition = (index % 8) / 8;
                
                return {
                    id: `inactive-${piece.id || index}`,
                    type: 'square',
                    position: piece.current_square || `inactive-${index}`,
                    has_piece: true,
                    piece_symbol: getPieceSymbol(piece.type, piece.color),
                    piece_color: piece.color,
                    piece_type: piece.type,
                    status: 'inactive',
                    community_id: -1,
                    component_id: -1,
                    in_degree_centrality: 0,
                    out_degree_centrality: 0,
                    waiting_index: index,
                    waiting_side: wallPosition,
                    // Add these properties to help with wall positioning
                    wall_index: index % 8,
                    wall_side: wallPosition,
                    h_position: horizontalPosition
                };
            });
            
            // Add the inactive nodes to graph_nodes
            if (moveData.graph_nodes) {
                moveData.graph_nodes = moveData.graph_nodes.concat(inactiveNodes);
            } else {
                moveData.graph_nodes = inactiveNodes;
            }
        }
        
        // Also handle captured pieces for reference (not displayed in main visualization)
        let capturedPieces = [];
        if (moveData.captured_pieces && typeof moveData.captured_pieces === 'object' && !Array.isArray(moveData.captured_pieces)) {
            for (const pieceId in moveData.captured_pieces) {
                const piece = moveData.captured_pieces[pieceId];
                if (piece) {
                    piece.id = piece.id || pieceId;
                    capturedPieces.push(piece);
                }
            }
        } else if (moveData.captured_pieces && Array.isArray(moveData.captured_pieces)) {
            capturedPieces = [...moveData.captured_pieces];
        } else if (moveData.pieces && Array.isArray(moveData.pieces)) {
            capturedPieces = moveData.pieces.filter(piece => piece && piece.status === 'captured');
        }
        
        // Store captured pieces in metrics for reference
        if (capturedPieces.length > 0 && window.metricsDisplay) {
            window.metricsDisplay.setCapturedPieces(capturedPieces);
        }
        
        // Handle promoted pieces in a similar way
        let promotedPieces = [];
        if (moveData.promoted_pieces && typeof moveData.promoted_pieces === 'object' && !Array.isArray(moveData.promoted_pieces)) {
            for (const pieceId in moveData.promoted_pieces) {
                const piece = moveData.promoted_pieces[pieceId];
                if (piece && piece.promoted) {
                    piece.id = piece.id || pieceId;
                    promotedPieces.push(piece);
                }
            }
        } else if (moveData.promoted_pieces && Array.isArray(moveData.promoted_pieces)) {
            promotedPieces = [...moveData.promoted_pieces];
        } else if (moveData.pieces && Array.isArray(moveData.pieces)) {
            promotedPieces = moveData.pieces.filter(piece => piece && piece.promoted === true);
        }
        
        // Highlight promoted pieces in the visualization by adding a special attribute
        if (promotedPieces.length > 0) {
            // Find promoted pieces in the graph nodes and mark them
            moveData.graph_nodes.forEach(node => {
                if (node.has_piece && promotedPieces.some(p => p.current_square === node.position)) {
                    node.is_promoted = true;
                }
            });
        }
        
    } catch (error) {
        console.error('Error processing inactive nodes:', error);
    }
}

/**
 * Updates the UI to show the current move information
 * 
 * @param {number} moveIndex - The index of the current move
 */
function updateMoveDisplay(moveIndex) {
    if (!AppState.movesArray || moveIndex < 0 || moveIndex >= AppState.movesArray.length) {
        console.error('Invalid move index or missing move data', moveIndex);
        return;
    }
    
    try {
        const moveData = AppState.movesArray[moveIndex];
        
        if (!moveData) {
            console.error('Move data is undefined for index', moveIndex);
            return;
        }
        
        // Update move number and notation
        if (DOM.currentMoveNumber && moveData.move_number !== undefined) {
            DOM.currentMoveNumber.textContent = moveData.move_number;
        }
        
        if (DOM.currentMoveNotation) {
            DOM.currentMoveNotation.textContent = moveData.move || "start";
        }
        
        // Update slider position if it doesn't match (prevents feedback loops)
        if (DOM.moveSlider && parseInt(DOM.moveSlider.value) !== moveIndex) {
            DOM.moveSlider.value = moveIndex;
        }
        
        // Update FEN string
        if (DOM.fenString) {
            DOM.fenString.textContent = moveData.fen || "No FEN available";
        }
        
        console.log(`Move display updated to move ${moveIndex}: ${moveData.move || "start"}`);
    } catch (error) {
        console.error('Error updating move display:', error);
    }
}

/**
 * Updates the force simulation parameters based on current AppState
 */
function updateForceParameters() {
    if (!window.d3viz || !window.d3viz.getSimulation) return;
    
    try {
        const simulation = window.d3viz.getSimulation();
        if (!simulation) return;
        
        // Update force parameters
        if (simulation.force('charge')) {
            simulation.force('charge').strength(AppState.forceParams.charge);
        }
        
        if (simulation.force('link')) {
            simulation.force('link').distance(AppState.forceParams.linkDistance);
        }
        
        if (simulation.force('center')) {
            // Gravity is implemented as the strength of the center force
            simulation.force('center').strength(AppState.forceParams.gravity);
        }
        
        if (simulation.force('collision')) {
            simulation.force('collision').strength(AppState.forceParams.collisionStrength);
        }
        
        // Restart the simulation
        simulation.alpha(0.3).restart();
        
        console.log('Force parameters updated:', AppState.forceParams);
    } catch (error) {
        console.error('Error updating force parameters:', error);
    }
}

/**
 * Auto-tunes the layout parameters based on current graph data
 */
function autoTuneLayout() {
    if (!AppState.movesArray || !AppState.movesArray[AppState.currentMoveIndex]) {
        console.warn('No move data available for auto-tuning');
        return;
    }
    
    console.log('Auto-tuning layout parameters...');
    
    try {
        // Get current data
        const currentMove = AppState.movesArray[AppState.currentMoveIndex];
        
        // Get graph data based on selected graph type
        const prefix = AppState.selectedGraphType === 'combined' ? '' : `${AppState.selectedGraphType}_`;
        const nodeKey = `${prefix}graph_nodes`;
        const edgeKey = `${prefix}graph_edges`;
        
        // Count nodes and links
        let nodeCount = 0;
        let linkCount = 0;
        
        if (currentMove[nodeKey] && Array.isArray(currentMove[nodeKey])) {
            nodeCount = currentMove[nodeKey].length;
        } else if (currentMove.graph_nodes && Array.isArray(currentMove.graph_nodes)) {
            // Fall back to combined graph if specific type not found
            nodeCount = currentMove.graph_nodes.length;
        }
        
        if (currentMove[edgeKey] && Array.isArray(currentMove[edgeKey])) {
            linkCount = currentMove[edgeKey].length;
        } else if (currentMove.graph_edges && Array.isArray(currentMove.graph_edges)) {
            // Fall back to combined graph if specific type not found
            linkCount = currentMove.graph_edges.length;
        }
        
        // Ensure we have reasonable defaults if counts are zero
        nodeCount = Math.max(10, nodeCount);
        linkCount = Math.max(5, linkCount);
        
        // Calculate graph density
        const density = nodeCount > 1 ? (linkCount / (nodeCount * (nodeCount - 1) / 2)) : 0;
        
        // Adjust parameters based on layout type
        switch (AppState.currentLayout) {
            case 'bubble+force':
            case 'bubble+radial':
                // Bubble layouts need stronger charges and less gravity
                AppState.forceParams.charge = -350 * Math.pow(nodeCount / 10, 0.3);
                AppState.forceParams.linkDistance = 40 + 30 * (1 - density);
                AppState.forceParams.gravity = 0.05 * Math.pow(nodeCount / 20, 0.2);
                AppState.forceParams.collisionStrength = 0.8;
                break;
                
            case 'radial':
                // Radial layout needs medium forces
                AppState.forceParams.charge = -280 * Math.pow(nodeCount / 10, 0.3);
                AppState.forceParams.linkDistance = 50 + 30 * (1 - density);
                AppState.forceParams.gravity = 0.08 * Math.pow(nodeCount / 20, 0.2);
                AppState.forceParams.collisionStrength = 0.7;
                break;
                
            case 'force':
            default:
                // Standard force layout
                AppState.forceParams.charge = -300 * Math.pow(nodeCount / 10, 0.3);
                AppState.forceParams.linkDistance = 60 + 40 * (1 - density);
                AppState.forceParams.gravity = 0.1 * Math.pow(nodeCount / 20, 0.2);
                AppState.forceParams.collisionStrength = 0.7;
                break;
        }
        
        // Get community and component counts for additional tuning
        const communities = new Set();
        const components = new Set();
        
        // Try to get data from selected graph type first
        const nodes = currentMove[nodeKey] || currentMove.graph_nodes || [];
        if (Array.isArray(nodes)) {
            nodes.forEach(function(node) {
                if (node && node.community_id !== undefined) communities.add(node.community_id);
                if (node && node.component_id !== undefined) components.add(node.component_id);
            });
        }
        
        const communityCount = Math.max(1, communities.size);
        const componentCount = Math.max(1, components.size);
        
        // Adjust parameters based on community and component counts
        if (communityCount > 1) {
            AppState.communityAttraction = Math.min(0.6, 0.5 / Math.sqrt(communityCount));
        } else {
            AppState.communityAttraction = 0.3; // Default
        }
        
        if (componentCount > 1) {
            AppState.componentAttraction = Math.min(0.7, 0.7 / Math.sqrt(componentCount));
            
            // For bubble layouts, adjust the repulsion between components
            if (AppState.currentLayout.startsWith('bubble')) {
                AppState.forceParams.charge *= 1.2;  // Increase repulsion for better separation
            }
        } else {
            AppState.componentAttraction = 0.5; // Default
        }
        
        // Update the UI sliders to reflect the new values
        updateSliders();
        
        // Update the force parameters in the simulation
        updateForceParameters();
        
        // Also auto-tune performance settings based on graph size
        if (AppState.performance.autoTune) {
            autoOptimizePerformance();
        }
        
        console.log('Auto-tuned parameters for layout:', AppState.currentLayout, {
            charge: AppState.forceParams.charge,
            linkDistance: AppState.forceParams.linkDistance,
            gravity: AppState.forceParams.gravity,
            communityAttraction: AppState.communityAttraction,
            componentAttraction: AppState.componentAttraction,
            nodeCount: nodeCount,
            linkCount: linkCount,
            communityCount: communityCount,
            componentCount: componentCount
        });
    } catch (error) {
        console.error('Error during auto-tuning:', error);
    }
}

/**
 * Updates the UI sliders with the current parameter values
 */
function updateSliders() {
    try {
        // Update force charge slider
        if (DOM.forceChargeSlider) {
            DOM.forceChargeSlider.value = AppState.forceParams.charge;
            if (DOM.forceChargeValue) {
                DOM.forceChargeValue.textContent = AppState.forceParams.charge.toFixed(0);
            }
        }
        
        // Update link distance slider
        if (DOM.forceLinkDistanceSlider) {
            DOM.forceLinkDistanceSlider.value = AppState.forceParams.linkDistance;
            if (DOM.forceLinkDistanceValue) {
                DOM.forceLinkDistanceValue.textContent = AppState.forceParams.linkDistance.toFixed(0);
            }
        }
        
        // Update gravity slider
        if (DOM.forceGravitySlider) {
            DOM.forceGravitySlider.value = AppState.forceParams.gravity;
            if (DOM.forceGravityValue) {
                DOM.forceGravityValue.textContent = AppState.forceParams.gravity.toFixed(2);
            }
        }
        
        // Update collision strength slider
        if (DOM.forceCollisionSlider) {
            DOM.forceCollisionSlider.value = AppState.forceParams.collisionStrength;
            if (DOM.forceCollisionValue) {
                DOM.forceCollisionValue.textContent = AppState.forceParams.collisionStrength.toFixed(1);
            }
        }
        
        // Update component attraction slider
        if (DOM.componentAttractionSlider) {
            DOM.componentAttractionSlider.value = AppState.componentAttraction;
            if (DOM.componentAttractionValue) {
                DOM.componentAttractionValue.textContent = AppState.componentAttraction.toFixed(2);
            }
        }
        
        // Update community attraction slider
        if (DOM.communityAttractionSlider) {
            DOM.communityAttractionSlider.value = AppState.communityAttraction;
            if (DOM.communityAttractionValue) {
                DOM.communityAttractionValue.textContent = AppState.communityAttraction.toFixed(2);
            }
        }
    } catch (error) {
        console.error('Error updating sliders:', error);
    }
}

/**
 * Auto-optimizes performance settings based on current graph size
 */
function autoOptimizePerformance() {
    if (!window.PerformanceOptimizer) {
        console.warn('PerformanceOptimizer not available for auto-optimization');
        return;
    }
    
    if (!AppState.movesArray || !AppState.movesArray[AppState.currentMoveIndex]) {
        console.warn('No move data available for auto-optimization');
        return;
    }
    
    console.log('Auto-optimizing performance settings...');
    
    try {
        const currentData = AppState.movesArray[AppState.currentMoveIndex];
        let nodeCount = 0;
        let linkCount = 0;
        
        // Get total counts for nodes and links
        if (currentData.graph_nodes) {
            nodeCount = currentData.graph_nodes.length;
        }
        
        if (currentData.graph_edges) {
            linkCount = currentData.graph_edges.length;
        }
        
        // Auto-tune performance settings based on size
        if (nodeCount > 500 || linkCount > 1000) {
            // Large graph - enable all optimizations
            AppState.performance.enabled = true;
            AppState.performance.nodeCulling = true;
            AppState.performance.lodRendering = true;
            AppState.performance.forceOptimization = true;
            
            // Update UI controls if they exist
            if (DOM.performanceToggle) DOM.performanceToggle.checked = true;
            if (DOM.nodeCullingToggle) DOM.nodeCullingToggle.checked = true;
            if (DOM.lodRenderingToggle) DOM.lodRenderingToggle.checked = true;
            if (DOM.forceOptimizationToggle) DOM.forceOptimizationToggle.checked = true;
            
            // Apply optimizations
            window.PerformanceOptimizer.setEnabled(true);
            window.PerformanceOptimizer.setOptimizationOptions({
                nodeCulling: true,
                lodRendering: true,
                forceOptimization: true
            });
            
            console.log('Auto-enabled all performance optimizations for large graph');
        } else if (nodeCount > 200 || linkCount > 400) {
            // Medium graph - enable some optimizations
            AppState.performance.enabled = true;
            AppState.performance.nodeCulling = true;
            AppState.performance.lodRendering = true;
            AppState.performance.forceOptimization = false;
            
            // Update UI controls if they exist
            if (DOM.performanceToggle) DOM.performanceToggle.checked = true;
            if (DOM.nodeCullingToggle) DOM.nodeCullingToggle.checked = true;
            if (DOM.lodRenderingToggle) DOM.lodRenderingToggle.checked = true;
            if (DOM.forceOptimizationToggle) DOM.forceOptimizationToggle.checked = false;
            
            // Apply optimizations
            window.PerformanceOptimizer.setEnabled(true);
            window.PerformanceOptimizer.setOptimizationOptions({
                nodeCulling: true,
                lodRendering: true,
                forceOptimization: false
            });
            
            console.log('Auto-enabled some performance optimizations for medium graph');
        } else {
            // Small graph - disable optimizations for best visual quality
            AppState.performance.enabled = false;
            
            // Update UI controls if they exist
            if (DOM.performanceToggle) DOM.performanceToggle.checked = false;
            
            // Apply settings
            window.PerformanceOptimizer.setEnabled(false);
            
            console.log('Disabled performance optimizations for small graph');
        }
        
        // Force a visualization update to apply changes
        updateVisualization();
    } catch (error) {
        console.error('Error during performance optimization:', error);
    }
}

/**
 * Gets a piece symbol based on piece type and color
 * 
 * @param {string} pieceType - The type of the piece (e.g., 'pawn', 'knight')
 * @param {string} pieceColor - The color of the piece ('white' or 'black')
 * @returns {string} - The piece symbol
 */
function getPieceSymbol(pieceType, pieceColor) {
    // First ensure we're working with strings
    const type = String(pieceType || '').toLowerCase();
    const color = String(pieceColor || '').toLowerCase();
    
    const symbols = {
        'pawn': color === 'white' ? 'P' : 'p',
        'knight': color === 'white' ? 'N' : 'n',
        'bishop': color === 'white' ? 'B' : 'b',
        'rook': color === 'white' ? 'R' : 'r',
        'queen': color === 'white' ? 'Q' : 'q',
        'king': color === 'white' ? 'K' : 'k'
    };
    
    return symbols[type] || (color === 'white' ? 'P' : 'p');
}

/**
 * Creates an empty board state for testing
 * when actual data is not available
 */
function useEmptyBoardForTesting() {
    console.log('Creating test board data...');
    
    try {
        // Create a minimal data structure for development
        const emptyData = [{
            move_number: 0,
            move: "start",
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            combined_fiedler_value: 0.5,
            combined_out_diameter: 2.3,
            combined_in_diameter: 2.1,
            combined_in_degree_avg: 0.45,
            combined_in_degree_var: 0.1,
            combined_out_degree_avg: 0.45,
            combined_out_degree_var: 0.1,
            combined_modularity: 0.65,
            combined_community_count: 3,
            combined_clustering: 0.4,
            combined_size_entropy: 1.2,
            white_fiedler_value: 0.4,
            white_out_diameter: 2.1,
            white_in_diameter: 1.9,
            white_in_degree_avg: 0.4,
            white_in_degree_var: 0.08,
            white_out_degree_avg: 0.4,
            white_out_degree_var: 0.08,
            white_modularity: 0.6,
            white_community_count: 2,
            white_clustering: 0.38,
            white_size_entropy: 1.0,
            black_fiedler_value: 0.4,
            black_out_diameter: 2.1,
            black_in_diameter: 1.9,
            black_in_degree_avg: 0.4,
            black_in_degree_var: 0.08,
            black_out_degree_avg: 0.4,
            black_out_degree_var: 0.08,
            black_modularity: 0.6,
            black_community_count: 2,
            black_clustering: 0.38,
            black_size_entropy: 1.0,
            graph_nodes: [],
            graph_edges: [],
            pieces: []
        }];
        
        // Create some sample nodes and edges
        for (let i = 0; i < 20; i++) {
            // Make sure we're using the proper format for our application
            emptyData[0].graph_nodes.push({
                id: `n${i}`,
                type: "square",
                position: `${String.fromCharCode(97 + (i % 8))}${Math.floor(i / 8) + 1}`,
                has_piece: i < 16,
                piece_symbol: i < 8 ? "P" : i < 16 ? "p" : null,
                piece_color: i < 8 ? "white" : i < 16 ? "black" : null,
                piece_type: i < 16 ? "pawn" : null,
                component_id: Math.floor(i / 7),
                in_degree_centrality: Math.random(),
                out_degree_centrality: Math.random(),
                community_id: Math.floor(i / 5)
            });
            
            // Add some edges
            if (i > 0) {
                emptyData[0].graph_edges.push({
                    source: `n${i}`,
                    target: `n${i - 1}`,
                    weight: 1,
                    type: "influence"
                });
            }
        }
        
        // Add active pieces
        for (let i = 0; i < 16; i++) {
            emptyData[0].pieces.push({
                id: `p${i}`,
                type: i < 8 ? "pawn" : ["knight", "bishop", "rook", "queen", "king", "rook", "bishop", "knight"][i - 8],
                color: i < 8 ? "white" : "black",
                current_square: `${String.fromCharCode(97 + (i % 8))}${i < 8 ? 2 : 7}`,
                status: "active",
                move_created: 0,
                move_captured: null,
                promoted: false
            });
        }
        
        // Add inactive pieces
        for (let i = 0; i < 4; i++) {
            emptyData[0].pieces.push({
                id: `inactive${i}`,
                type: "pawn",
                color: i < 2 ? "white" : "black",
                current_square: `${String.fromCharCode(97 + i)}${i < 2 ? 1 : 8}`,
                status: "inactive",
                move_created: 0,
                move_captured: null,
                promoted: false
            });
        }
        
        // Store the data
        AppState.gameData = { moves: emptyData };
        AppState.movesArray = emptyData;
        AppState.totalMoves = 1;
        
        // Create mapping
        emptyData.forEach((move, index) => {
            if (move && move.move_number !== undefined) {
                AppState.moveMapping[move.move_number] = index;
            }
        });
        
        // Create indices
        createIndices(emptyData);
        
        if (DOM.moveSlider) DOM.moveSlider.max = 0;
        
        // Initialize the visualization with validated data
        if (window.ChessUtilities && window.ChessUtilities.validatePieceData) {
            emptyData[0].graph_nodes = window.ChessUtilities.validatePieceData(emptyData[0].graph_nodes);
        }
        
        if (window.ChessUtilities && window.ChessUtilities.addNodeDataAttributes) {
            emptyData[0].graph_nodes = window.ChessUtilities.addNodeDataAttributes(emptyData[0].graph_nodes);
        }
        
        console.log('Test board data created with', emptyData[0].graph_nodes.length, 'nodes and', emptyData[0].graph_edges.length, 'edges');
        
        // Initialize D3 visualizations with the test data
        initializeVisualization();
    } catch (error) {
        console.error('Error creating test board data:', error);
    }
}

/**
 * Performs diagnostics on DOM elements to identify issues
 * 
 * @returns {Object} - Diagnostics results
 */
function debugDOMElements() {
    console.group('DOM Element Diagnostics');
    
    // 1. Check all DOM elements
    console.log('Checking DOM element references...');
    const missingElements = [];
    
    for (const [key, element] of Object.entries(DOM)) {
        const status = element ? '✓' : '✗';
        console.log(`${status} DOM.${key}`);
        
        if (!element) {
            missingElements.push(key);
        }
    }
    
    if (missingElements.length > 0) {
        console.warn('Missing DOM elements:', missingElements);
    } else {
        console.log('All DOM elements found successfully');
    }
    
    // 2. Check for duplicate IDs
    console.log('Checking for duplicate IDs...');
    const allElements = document.querySelectorAll('[id]');
    const idMap = {};
    const duplicateIds = [];
    
    allElements.forEach(el => {
        const id = el.id;
        if (!idMap[id]) {
            idMap[id] = [];
        }
        idMap[id].push(el);
        
        if (idMap[id].length > 1) {
            if (!duplicateIds.includes(id)) {
                duplicateIds.push(id);
            }
        }
    });
    
    if (duplicateIds.length > 0) {
        console.error('Found duplicate IDs:');
        duplicateIds.forEach(id => {
            console.error(`- "${id}" (${idMap[id].length} occurrences)`, idMap[id]);
        });
    } else {
        console.log('No duplicate IDs found');
    }
    
    // 3. Verify key global objects are available
    console.log('Checking global objects...');
    const globalObjects = [
        { name: 'D3', object: window.d3 },
        { name: 'D3 Visualization', object: window.d3viz },
        { name: 'Force Layout Manager', object: window.ForceLayoutManager },
        { name: 'Layout Sorter', object: window.LayoutSorter },
        { name: 'D3 Bubble Layout', object: window.D3BubbleLayout },
        { name: 'D3 Radial Layout', object: window.D3RadialLayout },
        { name: 'Metrics Display', object: window.metricsDisplay },
        { name: 'Performance Optimizer', object: window.PerformanceOptimizer },
        { name: 'Advanced Controls', object: window.AdvancedControls }
    ];
    
    const missingObjects = [];
    globalObjects.forEach(obj => {
        if (obj.object) {
            console.log(`✓ ${obj.name} is available`);
        } else {
            console.warn(`✗ ${obj.name} is missing`);
            missingObjects.push(obj.name);
        }
    });
    
    // 4. Final diagnostics summary
    console.log('Diagnostics completed');
    
    if (missingElements.length > 0 || duplicateIds.length > 0) {
        console.error('DOM issues detected! Fix required for proper functionality.');
    } else {
        console.log('DOM structure appears to be valid.');
    }
    
    console.groupEnd();
    
    return {
        missingElements,
        duplicateIds,
        missingObjects,
        validDOMStructure: missingElements.length === 0 && duplicateIds.length === 0,
        validGlobalObjects: missingObjects.length === 0
    };
}

// Make AppState globally accessible for debugging
window.AppState = AppState;