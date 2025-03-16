/**
 * MetricsDisplay.js
 * Handles the display and updating of metrics in the sidebar.
 */

const MetricsDisplay = function() {
    // Private variables
    let currentData = null;
    let selectedGraph = 'combined';
    
    // Public API
    const api = {};
    
    /**
     * Initializes the metrics display
     * 
     * @param {Object} config - Configuration object
     * @param {Object} config.data - The chess game data for the current move
     * @param {string} config.selectedGraph - The graph type to show metrics for
     */
    api.init = function(config) {
        console.log('Initializing metrics display', config);
        
        // Store configuration
        currentData = config.data;
        selectedGraph = config.selectedGraph;
        
        // Update the metrics display
        updateMetrics(currentData, selectedGraph);
    };
    
    /**
     * Updates the metrics display with new data
     * 
     * @param {Object} config - Update configuration
     * @param {Object} config.data - The chess game data for the current move
     * @param {string} config.selectedGraph - The graph type to show metrics for
     */
    api.update = function(config) {
        currentData = config.data;
        selectedGraph = config.selectedGraph;
        
        updateMetrics(currentData, selectedGraph);
        
        // Update FEN string
        const fenElement = document.getElementById('fen-string');
        if (fenElement && currentData && currentData.fen) {
            fenElement.textContent = currentData.fen;
        }
    };
    
    /**
     * Updates the metrics display with new data
     * 
     * @param {Object} data - The chess game data
     * @param {string} graphType - The graph type to show metrics for
     */
    function updateMetrics(data, graphType) {
        if (!data) {
            console.error('No data available for metrics update');
            return;
        }
        
        console.log('Updating metrics with data:', data);
        console.log('Selected graph type:', graphType);
        
        // Update metrics for all graphs (combined, white, black)
        ['combined', 'white', 'black'].forEach(type => {
            // Get the metrics for this graph type
            const metrics = getMetricsForType(data, type);
            console.log(`Metrics for ${type}:`, metrics);
            
            // Update the values
            for (const key of Object.keys(metricIds[type])) {
                const value = metrics[key];
                const elementId = metricIds[type][key];
                const element = document.getElementById(elementId);
                
                if (element) {
                    const formattedValue = formatMetricValue(value, key);
                    element.textContent = formattedValue;
                    
                    // Add visual cue for significant changes
                    addChangeIndicator(element, value, key);
                } else {
                    console.warn(`Element not found for metric: ${key}, ID: ${elementId}`);
                }
            }
        });
    }
    
    // Metric element IDs by graph type
    const metricIds = {
        combined: {
            fiedler_value: 'combined-fiedler-value',
            out_diameter: 'combined-out-diameter',
            in_diameter: 'combined-in-diameter',
            in_degree_avg: 'combined-in-degree-avg',
            in_degree_var: 'combined-in-degree-var',
            out_degree_avg: 'combined-out-degree-avg',
            out_degree_var: 'combined-out-degree-var',
            modularity: 'combined-modularity',
            community_count: 'combined-community-count',
            clustering: 'combined-clustering',
            size_entropy: 'combined-size-entropy'
        },
        white: {
            fiedler_value: 'white-fiedler-value',
            out_diameter: 'white-out-diameter',
            in_diameter: 'white-in-diameter',
            in_degree_avg: 'white-in-degree-avg',
            in_degree_var: 'white-in-degree-var',
            out_degree_avg: 'white-out-degree-avg',
            out_degree_var: 'white-out-degree-var',
            modularity: 'white-modularity',
            community_count: 'white-community-count',
            clustering: 'white-clustering',
            size_entropy: 'white-size-entropy'
        },
        black: {
            fiedler_value: 'black-fiedler-value',
            out_diameter: 'black-out-diameter',
            in_diameter: 'black-in-diameter',
            in_degree_avg: 'black-in-degree-avg',
            in_degree_var: 'black-in-degree-var',
            out_degree_avg: 'black-out-degree-avg',
            out_degree_var: 'black-out-degree-var',
            modularity: 'black-modularity',
            community_count: 'black-community-count',
            clustering: 'black-clustering',
            size_entropy: 'black-size-entropy'
        }
    };
    
    /**
     * Gets the metrics for a specific graph type
     * 
     * @param {Object} data - The chess game data
     * @param {string} type - The graph type
     * @returns {Object} - The metrics for the graph type
     */
    function getMetricsForType(data, type) {
        const metrics = {};
        
        // Extract metrics from data based on type prefix
        const prefix = `${type}_`;
        
        // Find all metrics with this prefix
        for (const [key, value] of Object.entries(data)) {
            if (key.startsWith(prefix)) {
                // Remove the prefix to get the actual metric name
                const metricName = key.substring(prefix.length);
                metrics[metricName] = value;
            }
        }
        
        return metrics;
    }
    
    /**
     * Formats a metric value for display
     * 
     * @param {any} value - The metric value
     * @param {string} key - The metric key
     * @returns {string} - The formatted value
     */
    function formatMetricValue(value, key) {
        if (value === undefined || value === null) {
            return '-';
        }
        
        // Format based on metric type
        if (typeof value === 'number') {
            // For counts, show as integers
            if (key === 'community_count') {
                return value.toFixed(0);
            }
            
            // For values that are typically between 0-1
            if (key === 'modularity' || key === 'clustering' || 
                key.includes('degree') || key === 'size_entropy') {
                return value.toFixed(3);
            }
            
            // For all other numbers
            return value.toFixed(2);
        }
        
        // For non-numeric values
        return value.toString();
    }
    
    /**
     * Adds a visual indicator for significant metric changes
     * 
     * @param {HTMLElement} element - The element to add the indicator to
     * @param {any} value - The current value
     * @param {string} key - The metric key
     */
    function addChangeIndicator(element, value, key) {
        // This would compare to previous values to show trends
        // For now, we'll just set a CSS class based on value thresholds
        
        element.classList.remove('metric-high', 'metric-medium', 'metric-low');
        
        if (typeof value !== 'number') return;
        
        // Different thresholds for different metrics
        switch (key) {
            case 'fiedler_value':
                if (value > 0.8) element.classList.add('metric-high');
                else if (value > 0.4) element.classList.add('metric-medium');
                else element.classList.add('metric-low');
                break;
                
            case 'modularity':
                if (value > 0.7) element.classList.add('metric-high');
                else if (value > 0.4) element.classList.add('metric-medium');
                else element.classList.add('metric-low');
                break;
                
            case 'in_degree_avg':
            case 'out_degree_avg':
                if (value > 0.6) element.classList.add('metric-high');
                else if (value > 0.3) element.classList.add('metric-medium');
                else element.classList.add('metric-low');
                break;
                
            // More cases can be added for other metrics
        }
    }
    
    return api;
};