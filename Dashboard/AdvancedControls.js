/**
 * AdvancedControls.js
 * Implements advanced controls for chess influence network visualization.
 * Provides filtering, sorting, and layout optimization options.
 */

const AdvancedControls = (function() {
    // Private variables
    let container = null;
    let filtersContainer = null;
    let sortingContainer = null;
    let layoutOptimizationContainer = null;
    let coloringContainer = null;
    
    // Filter state
    let activeFilters = {
        'in-degree': { min: 0, max: 1, enabled: false },
        'out-degree': { min: 0, max: 1, enabled: false },
        'community': { values: [], enabled: false },
        'component': { values: [], enabled: false },
        'piece-type': { values: ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'], enabled: false },
        'piece-color': { values: ['white', 'black'], enabled: false },
        'status': { values: ['active', 'inactive'], enabled: false }
    };
    
    // Callbacks
    let onFilterChange = null;
    let onSortingChange = null;
    let onLayoutOptimizationChange = null;
    let onColoringChange = null;
    
    // Current data summary
    let dataSummary = {
        pieceTypes: [],
        communities: [],
        components: [],
        inDegreeRange: [0, 1],
        outDegreeRange: [0, 1]
    };
    
    // Public API
    const api = {};
    
    /**
     * Initializes the advanced controls
     * 
     * @param {Object} config - Configuration object
     * @param {HTMLElement} config.container - DOM element to contain the controls
     * @param {Function} config.onFilterChange - Callback for filter changes
     * @param {Function} config.onSortingChange - Callback for sorting changes
     * @param {Function} config.onLayoutOptimizationChange - Callback for layout optimization changes
     * @param {Function} config.onColoringChange - Callback for coloring changes
     */
    api.init = function(config) {
        if (!config || !config.container) {
            console.error('Invalid configuration for AdvancedControls: missing container');
            return;
        }
        
        container = config.container;
        
        // Set callbacks
        onFilterChange = config.onFilterChange || function() {};
        onSortingChange = config.onSortingChange || function() {};
        onLayoutOptimizationChange = config.onLayoutOptimizationChange || function() {};
        onColoringChange = config.onColoringChange || function() {};
        
        // Create sections
        createControlSections();
        
        // Initialize controls with defaults
        updateFilterControls();
        updateSortingControls();
        updateLayoutOptimizationControls();
        updateColoringControls();
    };
    
    /**
     * Updates the controls with data from the current visualization state
     * 
     * @param {Object} data - The current data
     */
    api.updateWithData = function(data) {
        if (!data) return;
        
        // Extract summary data from the current visualization state
        extractDataSummary(data);
        
        // Update controls with new data
        updateFilterControls();
        updateSortingControls();
        updateLayoutOptimizationControls();
        updateColoringControls();
    };
    
    /**
     * Gets the current filter state
     * 
     * @returns {Object} - The current filter state
     */
    api.getFilters = function() {
        return { ...activeFilters };
    };
    
    /**
     * Applies the current filters to a set of nodes
     * 
     * @param {Array} nodes - Array of node objects to filter
     * @returns {Array} - The filtered nodes
     */
    api.applyFilters = function(nodes) {
        if (!nodes || !Array.isArray(nodes)) return [];
        
        // Start with all nodes
        let filteredNodes = [...nodes];
        
        // Apply each enabled filter
        Object.entries(activeFilters).forEach(([filterType, filterState]) => {
            if (!filterState.enabled) return; // Skip disabled filters
            
            switch(filterType) {
                case 'in-degree':
                    filteredNodes = filteredNodes.filter(node => {
                        const value = node.in_degree_centrality !== undefined ? node.in_degree_centrality : 0;
                        return value >= filterState.min && value <= filterState.max;
                    });
                    break;
                    
                case 'out-degree':
                    filteredNodes = filteredNodes.filter(node => {
                        const value = node.out_degree_centrality !== undefined ? node.out_degree_centrality : 0;
                        return value >= filterState.min && value <= filterState.max;
                    });
                    break;
                    
                case 'community':
                    if (filterState.values.length > 0) {
                        filteredNodes = filteredNodes.filter(node => {
                            return filterState.values.includes(node.community_id || 0);
                        });
                    }
                    break;
                    
                case 'component':
                    if (filterState.values.length > 0) {
                        filteredNodes = filteredNodes.filter(node => {
                            return filterState.values.includes(node.component_id || 0);
                        });
                    }
                    break;
                    
                case 'piece-type':
                    if (filterState.values.length > 0) {
                        filteredNodes = filteredNodes.filter(node => {
                            // Safeguard against non-string values
                            if (!node.piece_type) return false;
                            const pieceType = String(node.piece_type).toLowerCase();
                            return filterState.values.includes(pieceType);
                        });
                    }
                    break;
                    
                case 'piece-color':
                    if (filterState.values.length > 0) {
                        filteredNodes = filteredNodes.filter(node => {
                            return filterState.values.includes(node.piece_color);
                        });
                    }
                    break;
                    
                case 'status':
                    if (filterState.values.length > 0) {
                        filteredNodes = filteredNodes.filter(node => {
                            return filterState.values.includes(node.status || 'active');
                        });
                    }
                    break;
            }
        });
        
        return filteredNodes;
    };
    
    /**
     * Creates the control sections
     */
    function createControlSections() {
        // Clear container first
        container.innerHTML = '';
        
        // Create filters section
        const filtersSection = document.createElement('div');
        filtersSection.className = 'panel-section advanced-filters';
        filtersSection.innerHTML = `
            <h3>Advanced Filters</h3>
            <div class="filters-content"></div>
            <button id="apply-filters" class="apply-btn">Apply Filters</button>
            <button id="reset-filters" class="reset-btn">Reset</button>
        `;
        container.appendChild(filtersSection);
        filtersContainer = filtersSection.querySelector('.filters-content');
        
        // Create sorting section
        const sortingSection = document.createElement('div');
        sortingSection.className = 'panel-section sorting-options';
        sortingSection.innerHTML = `
            <h3>Sorting & Organization</h3>
            <div class="sorting-content"></div>
        `;
        container.appendChild(sortingSection);
        sortingContainer = sortingSection.querySelector('.sorting-content');
        
        // Create layout optimization section
        const layoutOptSection = document.createElement('div');
        layoutOptSection.className = 'panel-section layout-optimization';
        layoutOptSection.innerHTML = `
            <h3>Layout Optimization</h3>
            <div class="layout-opt-content"></div>
        `;
        container.appendChild(layoutOptSection);
        layoutOptimizationContainer = layoutOptSection.querySelector('.layout-opt-content');
        
        // Create coloring section
        const coloringSection = document.createElement('div');
        coloringSection.className = 'panel-section coloring-options';
        coloringSection.innerHTML = `
            <h3>Coloring Options</h3>
            <div class="coloring-content"></div>
        `;
        container.appendChild(coloringSection);
        coloringContainer = coloringSection.querySelector('.coloring-content');
        
        // Add event listeners
        document.getElementById('apply-filters').addEventListener('click', handleFilterApply);
        document.getElementById('reset-filters').addEventListener('click', handleFilterReset);
    }
    
    /**
     * Extracts a summary of the data for use in the controls
     * 
     * @param {Object} data - The current visualization data
     */
    function extractDataSummary(data) {
        const newSummary = {
            pieceTypes: new Set(),
            communities: new Set(),
            components: new Set(),
            inDegreeRange: [Infinity, -Infinity],
            outDegreeRange: [Infinity, -Infinity]
        };
        
        // Process nodes to extract values
        const graphNodes = data.graph_nodes || [];
        
        graphNodes.forEach(node => {
            if (!node) return;
            
            // Track piece types - ensure they are strings
            if (node.piece_type !== undefined && node.piece_type !== null) {
                newSummary.pieceTypes.add(String(node.piece_type).toLowerCase());
            }
            
            // Track communities
            if (node.community_id !== undefined) {
                newSummary.communities.add(node.community_id);
            }
            
            // Track components
            if (node.component_id !== undefined) {
                newSummary.components.add(node.component_id);
            }
            
            // Track in-degree range
            if (node.in_degree_centrality !== undefined) {
                newSummary.inDegreeRange[0] = Math.min(newSummary.inDegreeRange[0], node.in_degree_centrality);
                newSummary.inDegreeRange[1] = Math.max(newSummary.inDegreeRange[1], node.in_degree_centrality);
            }
            
            // Track out-degree range
            if (node.out_degree_centrality !== undefined) {
                newSummary.outDegreeRange[0] = Math.min(newSummary.outDegreeRange[0], node.out_degree_centrality);
                newSummary.outDegreeRange[1] = Math.max(newSummary.outDegreeRange[1], node.out_degree_centrality);
            }
        });
        
        // Convert sets to sorted arrays
        dataSummary = {
            pieceTypes: [...newSummary.pieceTypes].sort(),
            communities: [...newSummary.communities].sort((a, b) => a - b),
            components: [...newSummary.components].sort((a, b) => a - b),
            inDegreeRange: newSummary.inDegreeRange[0] !== Infinity ? 
                newSummary.inDegreeRange : [0, 1],
            outDegreeRange: newSummary.outDegreeRange[0] !== Infinity ? 
                newSummary.outDegreeRange : [0, 1]
        };
        
        // Initialize filter ranges if they were previously invalid
        if (activeFilters['in-degree'].min < dataSummary.inDegreeRange[0] || 
            activeFilters['in-degree'].max > dataSummary.inDegreeRange[1]) {
            activeFilters['in-degree'].min = dataSummary.inDegreeRange[0];
            activeFilters['in-degree'].max = dataSummary.inDegreeRange[1];
        }
        
        if (activeFilters['out-degree'].min < dataSummary.outDegreeRange[0] || 
            activeFilters['out-degree'].max > dataSummary.outDegreeRange[1]) {
            activeFilters['out-degree'].min = dataSummary.outDegreeRange[0];
            activeFilters['out-degree'].max = dataSummary.outDegreeRange[1];
        }
    }
    
    /**
     * Updates the filter controls with current data
     */
    function updateFilterControls() {
        if (!filtersContainer) return;
        
        filtersContainer.innerHTML = '';
        
        // Create in-degree range filter
        createRangeFilter(
            filtersContainer, 
            'in-degree', 
            'In-Degree Centrality', 
            dataSummary.inDegreeRange[0], 
            dataSummary.inDegreeRange[1],
            activeFilters['in-degree'].min,
            activeFilters['in-degree'].max,
            activeFilters['in-degree'].enabled,
            handleInDegreeFilterChange
        );
        
        // Create out-degree range filter
        createRangeFilter(
            filtersContainer, 
            'out-degree', 
            'Out-Degree Centrality', 
            dataSummary.outDegreeRange[0], 
            dataSummary.outDegreeRange[1],
            activeFilters['out-degree'].min,
            activeFilters['out-degree'].max,
            activeFilters['out-degree'].enabled,
            handleOutDegreeFilterChange
        );
        
        // Create community filter if we have multiple communities
        if (dataSummary.communities.length > 1) {
            createMultiSelectFilter(
                filtersContainer,
                'community',
                'Communities',
                dataSummary.communities.map(id => ({ value: id, label: `Community ${id}` })),
                activeFilters.community.values,
                activeFilters.community.enabled,
                handleCommunityFilterChange
            );
        }
        
        // Create component filter if we have multiple components
        if (dataSummary.components.length > 1) {
            createMultiSelectFilter(
                filtersContainer,
                'component',
                'Components',
                dataSummary.components.map(id => ({ value: id, label: `Component ${id}` })),
                activeFilters.component.values,
                activeFilters.component.enabled,
                handleComponentFilterChange
            );
        }
        
        // Create piece type filter
        createMultiSelectFilter(
            filtersContainer,
            'piece-type',
            'Piece Types',
            [
                { value: 'pawn', label: 'Pawns' },
                { value: 'knight', label: 'Knights' },
                { value: 'bishop', label: 'Bishops' },
                { value: 'rook', label: 'Rooks' },
                { value: 'queen', label: 'Queens' },
                { value: 'king', label: 'Kings' }
            ],
            activeFilters['piece-type'].values,
            activeFilters['piece-type'].enabled,
            handlePieceTypeFilterChange
        );
        
        // Create piece color filter
        createMultiSelectFilter(
            filtersContainer,
            'piece-color',
            'Piece Colors',
            [
                { value: 'white', label: 'White' },
                { value: 'black', label: 'Black' }
            ],
            activeFilters['piece-color'].values,
            activeFilters['piece-color'].enabled,
            handlePieceColorFilterChange
        );
        
        // Create node status filter
        createMultiSelectFilter(
            filtersContainer,
            'status',
            'Node Status',
            [
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' }
            ],
            activeFilters.status.values,
            activeFilters.status.enabled,
            handleStatusFilterChange
        );
    }
    
    /**
     * Creates a range filter control
     * 
     * @param {HTMLElement} container - The container element
     * @param {string} id - The filter ID
     * @param {string} label - The filter label
     * @param {number} min - The minimum value
     * @param {number} max - The maximum value
     * @param {number} currentMin - The current minimum value
     * @param {number} currentMax - The current maximum value
     * @param {boolean} enabled - Whether the filter is enabled
     * @param {Function} onChange - The change handler
     */
    function createRangeFilter(container, id, label, min, max, currentMin, currentMax, enabled, onChange) {
        // Fix precision issues with floating point
        min = parseFloat(min.toFixed(3));
        max = parseFloat(max.toFixed(3));
        currentMin = parseFloat(currentMin.toFixed(3));
        currentMax = parseFloat(currentMax.toFixed(3));
        
        const filterDiv = document.createElement('div');
        filterDiv.className = 'filter-control range-filter';
        filterDiv.innerHTML = `
            <div class="filter-header">
                <label for="${id}-enabled">
                    <input type="checkbox" id="${id}-enabled" ${enabled ? 'checked' : ''}>
                    ${label}
                </label>
            </div>
            <div class="filter-inputs">
                <div class="range-slider">
                    <input 
                        type="range" 
                        id="${id}-min" 
                        min="${min}" 
                        max="${max}" 
                        step="${Math.min(0.01, (max - min) / 100)}" 
                        value="${currentMin}"
                        ${enabled ? '' : 'disabled'}
                    >
                    <input 
                        type="range" 
                        id="${id}-max" 
                        min="${min}" 
                        max="${max}" 
                        step="${Math.min(0.01, (max - min) / 100)}" 
                        value="${currentMax}"
                        ${enabled ? '' : 'disabled'}
                    >
                </div>
                <div class="range-values">
                    <span id="${id}-min-value">${currentMin.toFixed(2)}</span>
                    <span id="${id}-max-value">${currentMax.toFixed(2)}</span>
                </div>
            </div>
        `;
        container.appendChild(filterDiv);
        
        // Add event listeners
        const enabledCheckbox = document.getElementById(`${id}-enabled`);
        const minSlider = document.getElementById(`${id}-min`);
        const maxSlider = document.getElementById(`${id}-max`);
        const minValue = document.getElementById(`${id}-min-value`);
        const maxValue = document.getElementById(`${id}-max-value`);
        
        enabledCheckbox.addEventListener('change', function() {
            const isEnabled = this.checked;
            minSlider.disabled = !isEnabled;
            maxSlider.disabled = !isEnabled;
            onChange(isEnabled, currentMin, currentMax);
        });
        
        minSlider.addEventListener('input', function() {
            const value = parseFloat(this.value);
            minValue.textContent = value.toFixed(2);
            
            // Ensure min doesn't exceed max
            if (value > maxSlider.value) {
                maxSlider.value = value;
                maxValue.textContent = value.toFixed(2);
            }
            
            onChange(enabledCheckbox.checked, value, parseFloat(maxSlider.value));
        });
        
        maxSlider.addEventListener('input', function() {
            const value = parseFloat(this.value);
            maxValue.textContent = value.toFixed(2);
            
            // Ensure max doesn't fall below min
            if (value < minSlider.value) {
                minSlider.value = value;
                minValue.textContent = value.toFixed(2);
            }
            
            onChange(enabledCheckbox.checked, parseFloat(minSlider.value), value);
        });
    }
    
    /**
     * Creates a multi-select filter control
     * 
     * @param {HTMLElement} container - The container element
     * @param {string} id - The filter ID
     * @param {string} label - The filter label
     * @param {Array} options - The select options
     * @param {Array} selectedValues - The currently selected values
     * @param {boolean} enabled - Whether the filter is enabled
     * @param {Function} onChange - The change handler
     */
    function createMultiSelectFilter(container, id, label, options, selectedValues, enabled, onChange) {
        const filterDiv = document.createElement('div');
        filterDiv.className = 'filter-control multi-select-filter';
        
        // Create HTML
        let optionsHTML = '';
        options.forEach(option => {
            const isSelected = selectedValues.includes(option.value);
            optionsHTML += `
                <label class="checkbox-label">
                    <input 
                        type="checkbox" 
                        value="${option.value}" 
                        ${isSelected ? 'checked' : ''} 
                        ${enabled ? '' : 'disabled'}
                    >
                    ${option.label}
                </label>
            `;
        });
        
        filterDiv.innerHTML = `
            <div class="filter-header">
                <label for="${id}-enabled">
                    <input type="checkbox" id="${id}-enabled" ${enabled ? 'checked' : ''}>
                    ${label}
                </label>
            </div>
            <div class="filter-inputs multi-select-options" id="${id}-options">
                ${optionsHTML}
            </div>
        `;
        container.appendChild(filterDiv);
        
        // Add event listeners
        const enabledCheckbox = document.getElementById(`${id}-enabled`);
        const optionsDiv = document.getElementById(`${id}-options`);
        
        enabledCheckbox.addEventListener('change', function() {
            const isEnabled = this.checked;
            
            // Enable/disable all option checkboxes
            optionsDiv.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                checkbox.disabled = !isEnabled;
            });
            
            // Get currently selected values
            const selected = Array.from(optionsDiv.querySelectorAll('input[type="checkbox"]:checked'))
                .map(checkbox => checkbox.value);
            
            onChange(isEnabled, selected);
        });
        
        // Add change listener to all option checkboxes
        optionsDiv.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const selected = Array.from(optionsDiv.querySelectorAll('input[type="checkbox"]:checked'))
                    .map(checkbox => checkbox.value);
                
                onChange(enabledCheckbox.checked, selected);
            });
        });
    }
    
    /**
     * Updates the sorting controls
     */
    function updateSortingControls() {
        if (!sortingContainer) return;
        
        sortingContainer.innerHTML = `
            <div class="control-group">
                <label for="sort-nodes-by">Sort Nodes By:</label>
                <select id="sort-nodes-by" class="select-dropdown">
                    <option value="none">No Sorting</option>
                    <option value="in-degree">In-Degree (Highest First)</option>
                    <option value="out-degree">Out-Degree (Highest First)</option>
                    <option value="piece-type">Piece Type</option>
                    <option value="piece-color">Piece Color</option>
                    <option value="status">Status</option>
                    <option value="position">Board Position</option>
                </select>
            </div>
            
            <div class="control-group">
                <label for="sort-components-by">Sort Components By:</label>
                <select id="sort-components-by" class="select-dropdown">
                    <option value="size">Size (Largest First)</option>
                    <option value="in-centrality">Average In-Degree</option>
                    <option value="out-centrality">Average Out-Degree</option>
                    <option value="density">Edge Density</option>
                    <option value="id">Component ID</option>
                </select>
            </div>
            
            <div class="control-group">
                <label for="sort-communities-by">Sort Communities By:</label>
                <select id="sort-communities-by" class="select-dropdown">
                    <option value="size">Size (Largest First)</option>
                    <option value="in-centrality">Average In-Degree</option>
                    <option value="out-centrality">Average Out-Degree</option>
                    <option value="id">Community ID</option>
                </select>
            </div>
            
            <div class="control-group">
                <label>
                    <input type="checkbox" id="optimize-sorting" checked>
                    Optimize for connections between groups
                </label>
            </div>
        `;
        
        // Add event listeners
        document.getElementById('sort-nodes-by').addEventListener('change', handleSortingChange);
        document.getElementById('sort-components-by').addEventListener('change', handleSortingChange);
        document.getElementById('sort-communities-by').addEventListener('change', handleSortingChange);
        document.getElementById('optimize-sorting').addEventListener('change', handleSortingChange);
    }
    
    /**
     * Updates the layout optimization controls
     */
    function updateLayoutOptimizationControls() {
        if (!layoutOptimizationContainer) return;
        
        layoutOptimizationContainer.innerHTML = `
            <div class="control-group">
                <label for="component-attraction">Component Cohesion:</label>
                <div class="range-with-value">
                    <input type="range" id="component-attraction" class="slider" min="0" max="1" step="0.1" value="0.5">
                    <span id="component-attraction-value">0.5</span>
                </div>
            </div>
            
            <div class="control-group">
                <label for="community-attraction">Community Cohesion:</label>
                <div class="range-with-value">
                    <input type="range" id="community-attraction" class="slider" min="0" max="1" step="0.1" value="0.3">
                    <span id="community-attraction-value">0.3</span>
                </div>
            </div>
            
            <div class="control-group">
                <label for="force-charge">Repulsion Force:</label>
                <div class="range-with-value">
                    <input type="range" id="force-charge" class="slider" min="-500" max="-100" step="10" value="-300">
                    <span id="force-charge-value">-300</span>
                </div>
            </div>
            
            <div class="control-group">
                <label for="force-link-distance">Link Distance:</label>
                <div class="range-with-value">
                    <input type="range" id="force-link-distance" class="slider" min="30" max="100" step="5" value="60">
                    <span id="force-link-distance-value">60</span>
                </div>
            </div>
            
            <div class="control-group">
                <label for="force-collision">Collision Strength:</label>
                <div class="range-with-value">
                    <input type="range" id="force-collision" class="slider" min="0.1" max="1" step="0.1" value="0.7">
                    <span id="force-collision-value">0.7</span>
                </div>
            </div>
            
            <div class="control-group">
                <label for="force-gravity">Gravity Strength:</label>
                <div class="range-with-value">
                    <input type="range" id="force-gravity" class="slider" min="0" max="0.5" step="0.05" value="0.1">
                    <span id="force-gravity-value">0.1</span>
                </div>
            </div>
            
            <button id="auto-tune" class="tune-btn">
                <i class="fas fa-magic"></i> Auto-Tune Parameters
            </button>
        `;
        
        // Add event listeners
        document.getElementById('component-attraction').addEventListener('input', handleLayoutOptimizationChange);
        document.getElementById('community-attraction').addEventListener('input', handleLayoutOptimizationChange);
        document.getElementById('force-charge').addEventListener('input', handleLayoutOptimizationChange);
        document.getElementById('force-link-distance').addEventListener('input', handleLayoutOptimizationChange);
        document.getElementById('force-collision').addEventListener('input', handleLayoutOptimizationChange);
        document.getElementById('force-gravity').addEventListener('input', handleLayoutOptimizationChange);
        
        document.getElementById('component-attraction').addEventListener('input', function() {
            document.getElementById('component-attraction-value').textContent = this.value;
        });
        
        document.getElementById('community-attraction').addEventListener('input', function() {
            document.getElementById('community-attraction-value').textContent = this.value;
        });
        
        document.getElementById('force-charge').addEventListener('input', function() {
            document.getElementById('force-charge-value').textContent = this.value;
        });
        
        document.getElementById('force-link-distance').addEventListener('input', function() {
            document.getElementById('force-link-distance-value').textContent = this.value;
        });
        
        document.getElementById('force-collision').addEventListener('input', function() {
            document.getElementById('force-collision-value').textContent = this.value;
        });
        
        document.getElementById('force-gravity').addEventListener('input', function() {
            document.getElementById('force-gravity-value').textContent = this.value;
        });
        
        document.getElementById('auto-tune').addEventListener('click', handleAutoTune);
    }
    
    /**
     * Updates the coloring controls
     */
    function updateColoringControls() {
        if (!coloringContainer) return;
        
        coloringContainer.innerHTML = `
            <div class="control-group">
                <label for="color-by">Color Nodes By:</label>
                <select id="color-by" class="select-dropdown">
                    <option value="community">Community</option>
                    <option value="component">Component</option>
                    <option value="piece-type">Piece Type</option>
                    <option value="piece-color">Piece Color</option>
                    <option value="status">Status</option>
                </select>
            </div>
            
            <div class="control-group">
                <label>
                    <input type="checkbox" id="show-communities" checked>
                    Show Community Hulls
                </label>
            </div>
            
            <div class="control-group">
                <label for="node-size-by">Size Nodes By:</label>
                <select id="node-size-by" class="select-dropdown">
                    <option value="in-degree">In-Degree</option>
                    <option value="out-degree">Out-Degree</option>
                    <option value="fixed">Fixed Size</option>
                    <option value="community">Community</option>
                    <option value="component">Component</option>
                </select>
            </div>
            
            <div class="control-group">
                <label for="influence-threshold">Influence Threshold:</label>
                <div class="range-with-value">
                    <input type="range" id="influence-threshold" class="slider" min="0" max="1" step="0.1" value="0">
                    <span id="influence-threshold-value">0</span>
                </div>
            </div>
        `;
        
        // Add event listeners
        document.getElementById('color-by').addEventListener('change', handleColoringChange);
        document.getElementById('show-communities').addEventListener('change', handleColoringChange);
        document.getElementById('node-size-by').addEventListener('change', handleColoringChange);
        document.getElementById('influence-threshold').addEventListener('input', handleColoringChange);
        
        document.getElementById('influence-threshold').addEventListener('input', function() {
            document.getElementById('influence-threshold-value').textContent = this.value;
        });
    }
    
    /**
     * Handles auto-tune button click
     */
    function handleAutoTune() {
        // Call the callback for auto-tuning
        onLayoutOptimizationChange({ autoTune: true });
    }
    
    /**
     * Handles in-degree filter changes
     * 
     * @param {boolean} enabled - Whether the filter is enabled
     * @param {number} min - The minimum value
     * @param {number} max - The maximum value
     */
    function handleInDegreeFilterChange(enabled, min, max) {
        activeFilters['in-degree'].enabled = enabled;
        activeFilters['in-degree'].min = min;
        activeFilters['in-degree'].max = max;
    }
    
    /**
     * Handles out-degree filter changes
     * 
     * @param {boolean} enabled - Whether the filter is enabled
     * @param {number} min - The minimum value
     * @param {number} max - The maximum value
     */
    function handleOutDegreeFilterChange(enabled, min, max) {
        activeFilters['out-degree'].enabled = enabled;
        activeFilters['out-degree'].min = min;
        activeFilters['out-degree'].max = max;
    }
    
    /**
     * Handles community filter changes
     * 
     * @param {boolean} enabled - Whether the filter is enabled
     * @param {Array} values - The selected values
     */
    function handleCommunityFilterChange(enabled, values) {
        activeFilters.community.enabled = enabled;
        activeFilters.community.values = values;
    }
    
    /**
     * Handles component filter changes
     * 
     * @param {boolean} enabled - Whether the filter is enabled
     * @param {Array} values - The selected values
     */
    function handleComponentFilterChange(enabled, values) {
        activeFilters.component.enabled = enabled;
        activeFilters.component.values = values;
    }
    
    /**
     * Handles piece type filter changes
     * 
     * @param {boolean} enabled - Whether the filter is enabled
     * @param {Array} values - The selected values
     */
    function handlePieceTypeFilterChange(enabled, values) {
        activeFilters['piece-type'].enabled = enabled;
        activeFilters['piece-type'].values = values;
    }
    
    /**
     * Handles piece color filter changes
     * 
     * @param {boolean} enabled - Whether the filter is enabled
     * @param {Array} values - The selected values
     */
    function handlePieceColorFilterChange(enabled, values) {
        activeFilters['piece-color'].enabled = enabled;
        activeFilters['piece-color'].values = values;
    }
    
    /**
     * Handles status filter changes
     * 
     * @param {boolean} enabled - Whether the filter is enabled
     * @param {Array} values - The selected values
     */
    function handleStatusFilterChange(enabled, values) {
        activeFilters.status.enabled = enabled;
        activeFilters.status.values = values;
    }
    
    /**
     * Handles apply filters button click
     */
    function handleFilterApply() {
        onFilterChange(activeFilters);
    }
    
    /**
     * Handles reset filters button click
     */
    function handleFilterReset() {
        // Reset all filters
        activeFilters = {
            'in-degree': { 
                min: dataSummary.inDegreeRange[0], 
                max: dataSummary.inDegreeRange[1], 
                enabled: false 
            },
            'out-degree': { 
                min: dataSummary.outDegreeRange[0], 
                max: dataSummary.outDegreeRange[1], 
                enabled: false 
            },
            'community': { values: [], enabled: false },
            'component': { values: [], enabled: false },
            'piece-type': { 
                values: ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'], 
                enabled: false 
            },
            'piece-color': { values: ['white', 'black'], enabled: false },
            'status': { values: ['active', 'inactive'], enabled: false }
        };
        
        // Update the UI
        updateFilterControls();
        
        // Notify callback
        onFilterChange(activeFilters);
    }
    
    /**
     * Handles sorting changes
     */
    function handleSortingChange() {
        const sortingOptions = {
            nodesBy: document.getElementById('sort-nodes-by').value,
            componentsBy: document.getElementById('sort-components-by').value,
            communitiesBy: document.getElementById('sort-communities-by').value,
            optimizeConnections: document.getElementById('optimize-sorting').checked
        };
        
        onSortingChange(sortingOptions);
    }
    
    /**
     * Handles layout optimization changes
     */
    function handleLayoutOptimizationChange() {
        // Only collect values if this isn't an auto-tune request
        const optOptions = {
            componentAttraction: parseFloat(document.getElementById('component-attraction').value),
            communityAttraction: parseFloat(document.getElementById('community-attraction').value),
            forceParams: {
                charge: parseFloat(document.getElementById('force-charge').value),
                linkDistance: parseFloat(document.getElementById('force-link-distance').value),
                collisionStrength: parseFloat(document.getElementById('force-collision').value),
                gravity: parseFloat(document.getElementById('force-gravity').value)
            }
        };
        
        onLayoutOptimizationChange(optOptions);
    }
    
    /**
     * Handles coloring changes
     */
    function handleColoringChange() {
        const coloringOptions = {
            colorBy: document.getElementById('color-by').value,
            showCommunities: document.getElementById('show-communities').checked,
            nodeSize: document.getElementById('node-size-by').value,
            influenceThreshold: parseFloat(document.getElementById('influence-threshold').value)
        };
        
        onColoringChange(coloringOptions);
    }
    
    // Make the API available globally
    window.AdvancedControls = api;
    
    return api;
})();