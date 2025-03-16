/**
 * D3BaseVisualization.js
 * Core visualization functionality for chess influence networks.
 * Embracing the philosophy of "using and abusing" the force simulation.
 */

const D3BaseVisualization = function() {
    // Private variables
    let svg = null;
    let container = null;
    let width = 0;
    let height = 0;
    let simulation = null;
    let nodeElements = null;
    let linkElements = null;
    let hullElements = null;
    let pieceSymbols = null;
    let nodeLabels = null;
    let arrowDefs = null;
    let zoomBehavior = null;
    let tooltip = null;
    
    // Current state
    let currentData = null;
    let currentLayout = 'force';
    let currentGraphType = 'combined';
    let currentLayoutType = null; // To track layout changes
    let currentOptions = {
        showCommunities: true,
        animationEnabled: true,
        nodeSize: 'in-degree',
        labelVisibility: 'all',
        arrowStyle: 'tapered',
        influenceThreshold: 0,
        showInactiveNodes: true,
        forceParams: {
            charge: -300,
            linkDistance: 60,
            gravity: 0.1,
            collisionStrength: 0.7
        },
        communityAttraction: 0.5,
        componentAttraction: 0.3,
        colorBy: 'community',
        sortNodesBy: 'none'
    };
    
    // Color scales for different node attributes
    const colorScales = {
        community: d3.scaleOrdinal(d3.schemeCategory10),
        component: d3.scaleOrdinal(d3.schemeSet3),
        'piece-type': d3.scaleOrdinal()
            .domain(['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'])
            .range(['#A9A9A9', '#4682B4', '#6A5ACD', '#CD853F', '#9370DB', '#DAA520']),
        'piece-color': d3.scaleOrdinal()
            .domain(['white', 'black'])
            .range(['#FFFFFF', '#000000']),
        status: d3.scaleOrdinal()
            .domain(['active', 'inactive', 'captured'])
            .range(['#4CAF50', '#FFC107', '#F44336'])
    };
    
    // Public API
    const api = {};
    
    /**
     * Initializes the D3 visualization
     * 
     * @param {Object} config - Configuration object
     * @param {HTMLElement} config.container - DOM element to contain the visualization
     * @param {Object} config.data - The chess game data for the current move
     * @param {string} config.layout - The layout type to use
     * @param {string} config.graphType - The graph type to visualize (combined, white, black)
     * @param {Object} config.options - Visualization options
     */
    api.init = function(config) {
        console.log('Initializing D3 visualization', config);
        
        // Validate configuration
        if (!config || !config.container) {
            console.error('Invalid configuration for D3 visualization: missing container');
            return;
        }
        
        // Store configuration
        container = config.container;
        currentData = config.data || { graph_nodes: [], graph_edges: [] };
        currentLayout = config.layout || 'force';
        currentGraphType = config.graphType || 'combined';
        currentOptions = { ...currentOptions, ...(config.options || {}) };
        
        // Get container dimensions
        width = container.clientWidth;
        height = container.clientHeight;
        
        // Create SVG element
        svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .classed('network-svg', true);
        
        // Add a background rect to handle zoom events
        svg.append('rect')
            .attr('width', width)
            .attr('height', height)
            .attr('fill', 'none')
            .attr('pointer-events', 'all');
        
        // Create a group for the visualization elements
        const vizGroup = svg.append('g')
            .classed('viz-group', true);
        
        // Setup zoom behavior
        zoomBehavior = d3.zoom()
            .scaleExtent([0.1, 8])
            .on('zoom', function(event) {
                vizGroup.attr('transform', event.transform);
            });
        
        svg.call(zoomBehavior);
        
        // Create groups for different elements
        vizGroup.append('g').classed('hull-group', true);
        vizGroup.append('g').classed('link-group', true);
        vizGroup.append('g').classed('node-group', true);
        
        // Get tooltip element - check if it exists first
        const tooltipEl = document.getElementById('tooltip');
        if (tooltipEl) {
            tooltip = d3.select('#tooltip');
        } else {
            // Create a tooltip element if it doesn't exist
            console.warn('Tooltip element not found, creating one');
            const tooltipDiv = document.createElement('div');
            tooltipDiv.id = 'tooltip';
            tooltipDiv.className = 'tooltip hidden';
            document.body.appendChild(tooltipDiv);
            tooltip = d3.select('#tooltip');
        }
        
        // Setup arrow definitions for directed edges
        arrowDefs = svg.append('defs');
        setupArrowDefinitions();
        
        // Initialize window.force if it doesn't exist
        if (!window.force) {
            window.force = {
                nodes: function() { return []; }
            };
        }
        
        // Create force simulation with customizable parameters
        simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id(function(d) { return d.id; })
                .distance(currentOptions.forceParams.linkDistance))
            .force('charge', d3.forceManyBody()
                .strength(currentOptions.forceParams.charge))
            .force('center', d3.forceCenter(width / 2, height / 2)
                .strength(currentOptions.forceParams.gravity))
            .force('collision', d3.forceCollide()
                .radius(function(d) { return getNodeRadius(d) + 5; })
                .strength(currentOptions.forceParams.collisionStrength));
        
        // Set up tick function
        simulation.on('tick', function() {
            // Update link paths
            if (linkElements) {
                linkElements.attr('d', linkArc);
            }
            
            // Update node positions
            if (nodeElements) {
                nodeElements.attr('transform', function(d) { 
                    return `translate(${d.x || 0},${d.y || 0})`; 
                });
            }
            
            // Update community hulls
            if (hullElements && currentOptions.showCommunities) {
                hullElements.attr('d', function(d) { return drawHull(d.nodes); });
            }
        });
        
        // Initialize the visualization with data
        updateVisualization(currentData, currentLayout, currentGraphType, currentOptions);
        
        // Add a small delay before auto-fitting to ensure nodes are positioned
        setTimeout(() => {
            api.resetZoom(); // Auto-fit on initialization
        }, 300);
    };
    
    /**
     * Updates the visualization with new data
     * 
     * @param {Object} config - Update configuration
     * @param {Object} config.data - The chess game data for the current move
     * @param {string} config.layout - The layout type to use
     * @param {string} config.graphType - The graph type to visualize (combined, white, black)
     * @param {Object} config.options - Visualization options
     */
      /**
 * Updates the visualization with new data
 * 
 * @param {Object} config - Update configuration
 * @param {Object} config.data - The chess game data for the current move
 * @param {string} config.layout - The layout type to use
 * @param {string} config.graphType - The graph type to visualize (combined, white, black)
 * @param {Object} config.options - Visualization options
 */
api.update = function(config) {
    // Validate input
    if (!config) {
        console.error('Invalid configuration for D3 visualization update');
        return;
    }
    
    // Clear existing visualization first
    if (typeof this.clear === 'function') {
        this.clear();
    }
    
    // Store updated configuration
    currentData = config.data || currentData;
    currentLayout = config.layout || currentLayout;
    currentGraphType = config.graphType || currentGraphType;
    currentOptions = { ...currentOptions, ...(config.options || {}) };
    
    // Log update details for debugging
    console.log(`Updating visualization with layout: ${currentLayout}, graphType: ${currentGraphType}`);
    console.log('Node count:', currentData.graph_nodes ? currentData.graph_nodes.length : 0);
    console.log('Link count:', currentData.graph_edges ? currentData.graph_edges.length : 0);
    
    // Stop any ongoing simulation
    if (simulation) {
        simulation.stop();
    }
    
    // Update the visualization
    updateVisualization(currentData, currentLayout, currentGraphType, currentOptions);
};
    
    /**
     * Resizes the visualization to match container size
     */
    api.resize = function() {
        if (!svg || !container) return;
        
        width = container.clientWidth;
        height = container.clientHeight;
        
        svg.attr('width', width)
           .attr('height', height);
        
        svg.select('rect')
           .attr('width', width)
           .attr('height', height);
        
        // Update force center
        if (simulation) {
            simulation.force('center', d3.forceCenter(width / 2, height / 2));
            
            // Restart simulation
            simulation.alpha(0.3).restart();
        }
    };
    
    /**
     * Zooms in on the visualization
     */
    api.zoomIn = function() {
        if (svg && zoomBehavior) {
            svg.transition().duration(300).call(
                zoomBehavior.scaleBy, 1.3
            );
        }
    };
    
    /**
     * Zooms out of the visualization
     */
    api.zoomOut = function() {
        if (svg && zoomBehavior) {
            svg.transition().duration(300).call(
                zoomBehavior.scaleBy, 0.7
            );
        }
    };
    
    /**
     * Resets the zoom level and fits the graph to the available space
     */
    api.resetZoom = function() {
        if (!svg || !zoomBehavior || !nodeElements || !nodeElements.data().length) {
            return;
        }
        
        try {
            // Get current bounds of all nodes
            let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
            
            nodeElements.each(function(d) {
                if (d && d.x !== undefined && d.y !== undefined) {
                    xMin = Math.min(xMin, d.x);
                    xMax = Math.max(xMax, d.x);
                    yMin = Math.min(yMin, d.y);
                    yMax = Math.max(yMax, d.y);
                }
            });
            
            // Handle edge cases
            if (xMin === Infinity || xMax === -Infinity || yMin === Infinity || yMax === -Infinity) {
                // Fallback to center if no valid bounds
                svg.transition().duration(500).call(
                    zoomBehavior.transform,
                    d3.zoomIdentity
                );
                return;
            }
            
            // Add padding around the graph
            const padding = 40;
            xMin -= padding;
            xMax += padding;
            yMin -= padding;
            yMax += padding;
            
            // Calculate the scale and translate to fit the graph
            const graphWidth = xMax - xMin;
            const graphHeight = yMax - yMin;
            const scale = Math.min(width / graphWidth, height / graphHeight, 1);
            
            // Calculate center point of the graph
            const centerX = (xMin + xMax) / 2;
            const centerY = (yMin + yMax) / 2;
            
            // Calculate translation to center the graph
            const translateX = width / 2 - centerX * scale;
            const translateY = height / 2 - centerY * scale;
            
            // Apply the transform
            svg.transition().duration(500).call(
                zoomBehavior.transform,
                d3.zoomIdentity
                    .translate(translateX, translateY)
                    .scale(scale)
            );
        } catch (e) {
            console.error("Error fitting graph to view:", e);
            // Fallback to default reset
            svg.transition().duration(500).call(
                zoomBehavior.transform,
                d3.zoomIdentity
            );
        }
    };
    
    /**
     * Gets the current simulation object
     * 
     * @returns {Object} - The D3 force simulation
     */
    api.getSimulation = function() {
        return simulation;
    };
    
    /**
 * Updates the network visualization
 * 
 * @param {Object} data - The chess game data
 * @param {string} layout - The layout type
 * @param {string} graphType - The graph type
 * @param {Object} options - Visualization options
 */
    /**
 * Updates the network visualization
 * 
 * @param {Object} data - The chess game data
 * @param {string} layout - The layout type
 * @param {string} graphType - The graph type
 * @param {Object} options - Visualization options
 */
function updateVisualization(data, layout, graphType, options) {
    if (!data) {
        console.warn('Invalid data for visualization', data);
        data = data || {};
        data.graph_nodes = data.graph_nodes || [];
        data.graph_edges = data.graph_edges || [];
    }
    
    console.log('Updating visualization with graph type:', graphType);
    
    // Get the graph data based on the selected graph type
    let activeNodes = [];
    let inactiveNodes = [];
    let links = [];
    
    // Check for pre-separated graph data first (new schema format)
    const prefix = graphType === 'combined' ? '' : `${graphType}_`;
    const nodeKey = `${prefix}graph_nodes`;
    const edgeKey = `${prefix}graph_edges`;
    
    if (data[nodeKey] && Array.isArray(data[nodeKey]) && 
        data[edgeKey] && Array.isArray(data[edgeKey])) {
        // Use pre-separated graph data
        console.log(`Using pre-separated ${graphType} graph data`);
        
        // Find active nodes in influence graph
        activeNodes = data[nodeKey].filter(function(node) {
            return !node.status || node.status === 'active';
        });
        
        // Find inactive nodes in influence graph
        inactiveNodes = data[nodeKey].filter(function(node) {
            return node.status === 'inactive';
        });
        
        links = [...data[edgeKey]];
    } else if (data.graph_nodes && Array.isArray(data.graph_nodes) && 
               data.graph_edges && Array.isArray(data.graph_edges)) {
        // Fall back to filtering the combined graph data
        console.log(`Filtering combined graph data for ${graphType}`);
        
        let allNodes = [...data.graph_nodes];
        
        if (graphType !== 'combined') {
            // Filter for the selected graph type
            allNodes = allNodes.filter(function(node) {
                if (!node.has_piece) return true; // Keep empty squares
                return node.piece_color === graphType; // Keep only pieces of selected color
            });
        }
        
        // Separate active nodes
        activeNodes = allNodes.filter(function(node) {
            return !node.status || node.status === 'active';
        });
        
        // Separate inactive nodes
        inactiveNodes = allNodes.filter(function(node) {
            return node.status === 'inactive';
        });
        
        links = [...data.graph_edges];
        
        if (graphType !== 'combined') {
            // Filter links for selected graph type
            links = links.filter(function(link) {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                
                return allNodes.some(function(node) { return node.id === sourceId; }) && 
                       allNodes.some(function(node) { return node.id === targetId; });
            });
        }
    } else {
        // If we reach here, we don't have valid graph data
        console.error('No valid graph data found for visualization');
        
        // Create minimal valid data to prevent rendering errors
        activeNodes = [];
        links = [];
        
        // Try to extract any usable data from pieces array if it exists
        if (data.pieces && Array.isArray(data.pieces)) {
            console.log('Attempting to create nodes from pieces array');
            
            // Create basic nodes from pieces
            activeNodes = data.pieces
                .filter(function(piece) { return piece.status === 'active'; })
                .map(function(piece, index) {
                    return {
                        id: piece.id || `piece-${index}`,
                        type: 'square',
                        position: piece.current_square || `unknown-${index}`,
                        has_piece: true,
                        piece_symbol: piece.type ? getPieceSymbolFromType(piece.type, piece.color) : 'P',
                        piece_color: piece.color || 'white',
                        piece_type: piece.type || 'pawn',
                        in_degree_centrality: Math.random() * 0.2, // Random value for visualization
                        out_degree_centrality: Math.random() * 0.2,
                        component_id: 0,
                        community_id: 0
                    };
                });
                
            // Find inactive pieces too
            inactiveNodes = data.pieces
                .filter(function(piece) { return piece.status === 'inactive'; })
                .map(function(piece, index) {
                    return {
                        id: piece.id || `inactive-${index}`,
                        type: 'square',
                        position: piece.current_square || `unknown-inactive-${index}`,
                        has_piece: true,
                        piece_symbol: piece.type ? getPieceSymbolFromType(piece.type, piece.color) : 'P',
                        piece_color: piece.color || 'white',
                        piece_type: piece.type || 'pawn',
                        status: 'inactive',
                        in_degree_centrality: 0,
                        out_degree_centrality: 0,
                        component_id: -1,
                        community_id: -1
                    };
                });
                
            // Create simple links between adjacent nodes
            if (activeNodes.length > 1) {
                for (let i = 1; i < activeNodes.length; i++) {
                    links.push({
                        source: activeNodes[i-1].id,
                        target: activeNodes[i].id,
                        weight: 1
                    });
                }
            }
        }
    }
    
    // Apply influence threshold filter
    if (options.influenceThreshold > 0) {
        links = links.filter(function(link) {
            return (link.weight || 1) >= options.influenceThreshold;
        });
        
        // After threshold filtering, remove any nodes that no longer have connections
        const remainingNodeIds = new Set();
        
        links.forEach(function(link) {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            
            remainingNodeIds.add(sourceId);
            remainingNodeIds.add(targetId);
        });
        
        // Only filter active nodes if there are still active nodes with connections
        if (remainingNodeIds.size > 0) {
            activeNodes = activeNodes.filter(function(node) {
                return remainingNodeIds.has(node.id);
            });
        }
    }
    
    // Apply sorting if specified
    if (options.sortNodesBy !== 'none') {
        sortNodes(activeNodes, options.sortNodesBy);
    }
    
    // Calculate communities if showing communities
    let communities = [];
    if (options.showCommunities) {
        communities = getCommunities(activeNodes);
    }
    
    // Make sure links have proper source/target references
    links = links.map(function(link) {
        // If link source/target are already objects, return as is
        if (typeof link.source === 'object' && typeof link.target === 'object') {
            return link;
        }
        
        // Otherwise, find the node objects by ID
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        
        const sourceNode = activeNodes.find(function(node) { return node.id === sourceId; });
        const targetNode = activeNodes.find(function(node) { return node.id === targetId; });
        
        // If both nodes exist, update the link
        if (sourceNode && targetNode) {
            return {
                ...link,
                source: sourceNode,
                target: targetNode
            };
        }
        
        // If nodes don't exist, return the original link (it will be filtered out later)
        return link;
    });
    
    // Final filter to ensure all links have valid source and target nodes
    links = links.filter(function(link) {
        if (typeof link.source !== 'object' || typeof link.target !== 'object') {
            return false;
        }
        return link.source && link.target;
    });
    
    // Apply the layout by setting up forces
    setupForces(activeNodes, inactiveNodes, links, layout, options);
    
    // Update visuals
    updateNodes(activeNodes, inactiveNodes, options);
    updateLinks(links, options);
    updateCommunities(communities, activeNodes, options);
    
    // Update window.force with the current nodes
    if (!window.force) window.force = {};
    window.force.nodes = function() { return [...activeNodes, ...inactiveNodes]; };
    
    // Start or restart the simulation
    if (simulation) {
        // Add all nodes to the simulation
        simulation.nodes([...activeNodes, ...inactiveNodes]);
        
        // Only add links between active nodes
        if (simulation.force('link')) {
            simulation.force('link').links(links);
        }
        
        // Update simulation parameters based on options
        updateForceParameters(options);
        
        // Stop any existing simulation
        simulation.stop();
        
        // Restart the simulation with proper alpha
        simulation.alpha(0.5).restart();
        
        console.log('Simulation restarted with new data:', activeNodes.length, 'active nodes,', inactiveNodes.length, 'inactive nodes,', links.length, 'links');
        
        // Auto-fit after layout changes (with delay to allow simulation to settle)
        if (currentLayoutType !== layout) {
            currentLayoutType = layout;
            setTimeout(function() {
                api.resetZoom();
            }, 700);
        }
    }
}
    
    /**
     * Gets a piece symbol based on piece type and color
     * 
     * @param {string} pieceType - The type of the piece (e.g., 'pawn', 'knight')
     * @param {string} pieceColor - The color of the piece ('white' or 'black')
     * @returns {string} - The piece symbol
     */
    function getPieceSymbolFromType(pieceType, pieceColor) {
        const symbols = {
            'pawn': pieceColor === 'white' ? 'P' : 'p',
            'knight': pieceColor === 'white' ? 'N' : 'n',
            'bishop': pieceColor === 'white' ? 'B' : 'b',
            'rook': pieceColor === 'white' ? 'R' : 'r',
            'queen': pieceColor === 'white' ? 'Q' : 'q',
            'king': pieceColor === 'white' ? 'K' : 'k'
        };
        
        return symbols[pieceType] || (pieceColor === 'white' ? 'P' : 'p');
    }
    
    /**
     * Updates force parameters based on options
     * 
     * @param {Object} options - The visualization options
     */
    function updateForceParameters(options) {
        if (!simulation) return;
        
        // Update charge force
        if (simulation.force('charge')) {
            simulation.force('charge')
                .strength(function(d) {
                    // Base charge - make it relative to node size for better layout
                    const baseCharge = options.forceParams.charge;
                    const nodeSize = getNodeRadius(d);
                    
                    // Scale charge based on node size and status
                    let chargeStrength = baseCharge * Math.pow(nodeSize / 15, 2);
                    
                    // Inactive nodes have weaker charge
                    if (d.status === 'inactive') {
                        chargeStrength *= 0.5;
                    }
                    
                    return chargeStrength;
                });
        }
        
        // Update link distance
        if (simulation.force('link')) {
            simulation.force('link')
                .distance(function(d) {
                    // Base link distance
                    const baseDistance = options.forceParams.linkDistance;
                    
                    // Adjust based on link weight if available
                    return d.weight ? baseDistance * (1 / (d.weight + 0.1)) : baseDistance;
                })
                .strength(function(d) {
                    // Default strength
                    const baseStrength = 0.7;
                    
                    // Adjust based on link weight if available
                    return d.weight ? Math.min(1, baseStrength * d.weight) : baseStrength;
                });
        }
        
        // Update collision force
        if (simulation.force('collision')) {
            simulation.force('collision')
                .radius(function(d) { return getNodeRadius(d) + 5; })
                .strength(options.forceParams.collisionStrength);
        }
        
        // Update gravity (center force)
        if (simulation.force('center')) {
            simulation.force('center')
                .strength(options.forceParams.gravity);
        }
    }
    
    /**
     * Sets up the forces for the current layout
     * 
     * @param {Array} activeNodes - Array of active node objects
     * @param {Array} inactiveNodes - Array of inactive node objects
     * @param {Array} links - Array of link objects
     * @param {string} layout - The layout type
     * @param {Object} options - Visualization options
     */
    /**
 * Updates to D3BaseVisualization.js
 * 
 * This contains the implementation of setupForces() function 
 * which needs to be integrated into D3BaseVisualization.js
 * to ensure consistent force-driven behavior across all layouts.
 */

/**
 * Sets up the forces for the current layout
 * 
 * @param {Array} activeNodes - Array of active node objects
 * @param {Array} inactiveNodes - Array of inactive node objects
 * @param {Array} links - Array of link objects
 * @param {string} layout - The layout type
 * @param {Object} options - Visualization options
 */
    /**
 * Sets up the forces for the current layout
 * 
 * @param {Array} activeNodes - Array of active node objects
 * @param {Array} inactiveNodes - Array of inactive node objects
 * @param {Array} links - Array of link objects
 * @param {string} layout - The layout type
 * @param {Object} options - Visualization options
 */
function setupForces(activeNodes, inactiveNodes, links, layout, options) {
    if (!simulation) return;
    
    // Reset forces - keep basic forces
    simulation.force('link', d3.forceLink().id(function(d) { return d.id; })
            .distance(options.forceParams.linkDistance))
        .force('charge', d3.forceManyBody()
            .strength(options.forceParams.charge))
        .force('center', d3.forceCenter(width / 2, height / 2)
            .strength(options.forceParams.gravity))
        .force('collision', d3.forceCollide()
            .radius(function(d) { return getNodeRadius(d) + 5; })
            .strength(options.forceParams.collisionStrength));
    
    // Remove any custom forces
    simulation.force('radial', null);
    simulation.force('component', null);
    simulation.force('bubble-radial', null);
    simulation.force('community', null);
    simulation.force('inactive', null);
    simulation.force('walls', null);
    simulation.force('boundary', null);
    simulation.force('community-attraction', null);
    simulation.force('community-repulsion', null);
    simulation.force('component-attraction', null);
    simulation.force('component-repulsion', null);
    simulation.force('active-inactive-repulsion', null);
    simulation.force('jitter', null);
    simulation.force('component-sorting', null);
    simulation.force('community-sorting', null);
    simulation.force('grid', null);
    simulation.force('bubble-containment', null);
    simulation.force('component-internal', null);
    simulation.force('component-gravity', null);
    
    // Apply the layout by using the ForceLayoutManager
    if (window.ForceLayoutManager) {
        switch (layout) {
            case 'radial':
                if (window.D3RadialLayout) {
                    window.D3RadialLayout.applyRadialLayout(simulation, [...activeNodes, ...inactiveNodes], width, height);
                }
                break;
                
            case 'bubble+force':
                if (window.D3BubbleLayout) {
                    window.D3BubbleLayout.applyBubbleForceLayout(simulation, [...activeNodes, ...inactiveNodes], width, height);
                }
                break;
                
            case 'bubble+radial':
                if (window.D3BubbleLayout) {
                    window.D3BubbleLayout.applyBubbleRadialLayout(simulation, [...activeNodes, ...inactiveNodes], width, height);
                }
                break;
                
            case 'force':
            default:
                // Use enhanced force layout for default layout
                window.ForceLayoutManager.applyForceLayout(simulation, [...activeNodes, ...inactiveNodes], width, height, options);
                break;
        }
    } else {
        // Fallback to basic wall forces for inactive nodes if ForceLayoutManager is not available
        setupWallForces(inactiveNodes);
    }
}
    /**
 * Setup forces to keep inactive nodes along walls (top and bottom edges)
 * 
 * @param {Array} inactiveNodes - Array of inactive node objects
 */
 /**
 * Setup forces to keep inactive nodes along walls (top and bottom edges)
 * Enhanced to handle the schema 2.0 format
 * 
 * @param {Object} simulation - The D3 force simulation
 * @param {Array} inactiveNodes - Array of inactive node objects
 * @param {number} width - The width of the container
 * @param {number} height - The height of the container
 */
function setupWallForces(simulation, inactiveNodes, width, height) {
    if (!inactiveNodes || !inactiveNodes.length) return;
    
    // Configure edge attraction strength
    const edgeAttraction = 0.8; // Base strength for edge attraction
    
    // Force to keep inactive nodes on the walls
    simulation.force('walls', function(alpha) {
        const strength = alpha * edgeAttraction; // Scale by alpha for stability
        
        inactiveNodes.forEach(node => {
            if (!node.x || !node.y) return;
            
            // Determine which edge to stick to based on piece color
            const isWhite = node.piece_color === 'white';
            
            // Target Y position - bottom edge for white, top for black
            const targetY = isWhite ? 
                height - 20 : // 20px from bottom for white pieces
                20;           // 20px from top for black pieces
            
            // Calculate force towards the target Y position
            const dy = targetY - node.y;
            node.vy += dy * strength;
            
            // Distribute pieces horizontally based on their index or h_position
            // This creates natural spacing between inactive pieces
            const horizontalSpacing = width / 9; // Divide width into 8 segments + margins
            let targetX;
            
            if (node.h_position !== undefined) {
                // Use the provided horizontal position if available
                targetX = 20 + node.h_position * (width - 40);
            } else if (node.wall_index !== undefined) {
                // Use the wall index if available
                targetX = 20 + (node.wall_index + 0.5) * horizontalSpacing;
            } else if (node.waiting_index !== undefined) {
                // Fall back to waiting index
                targetX = 20 + (node.waiting_index % 8 + 0.5) * horizontalSpacing;
            } else {
                // Default horizontal positioning if no index is available
                const randomOffset = (node.id ? node.id.charCodeAt(0) % 8 : 0) / 8;
                targetX = 20 + randomOffset * (width - 40);
            }
            
            // Apply horizontal force
            const dx = targetX - node.x;
            node.vx += dx * strength;
            
            // Add slight horizontal jitter to prevent perfect alignment
            node.vx += (Math.random() - 0.5) * alpha * 0.3;
        });
        
        // Add repulsion between nodes on the same wall for more natural spacing
        for (let i = 0; i < inactiveNodes.length; i++) {
            for (let j = i + 1; j < inactiveNodes.length; j++) {
                const nodeA = inactiveNodes[i];
                const nodeB = inactiveNodes[j];
                
                // Only apply repulsion between pieces on the same wall (same color)
                if (nodeA.piece_color !== nodeB.piece_color) continue;
                
                // Calculate horizontal distance
                const dx = nodeA.x - nodeB.x;
                const distance = Math.abs(dx);
                
                // Apply repulsion if nodes are too close
                if (distance < 40) { // Minimum desired spacing
                    const repulsion = 0.1 * alpha * (1 - distance / 40);
                    
                    nodeA.vx += dx > 0 ? repulsion : -repulsion;
                    nodeB.vx -= dx > 0 ? repulsion : -repulsion;
                }
            }
        }
    });
    
    // Add repulsion between active and inactive nodes
    simulation.force('active-inactive-repulsion', function(alpha) {
        const repulsion = alpha * 1.0;
        
        // Get active nodes from simulation
        const activeNodes = simulation.nodes().filter(n => !n.status || n.status === 'active');
        
        activeNodes.forEach(activeNode => {
            inactiveNodes.forEach(inactiveNode => {
                const dx = activeNode.x - inactiveNode.x;
                const dy = activeNode.y - inactiveNode.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance === 0) return;
                
                // Apply strong repulsion between active and inactive nodes
                // to maintain clear visual separation
                if (distance < 100) {
                    const force = repulsion * (1 - distance / 100);
                    const fx = dx / distance * force;
                    const fy = dy / distance * force;
                    
                    activeNode.vx += fx;
                    activeNode.vy += fy;
                    inactiveNode.vx -= fx * 0.3; // Less effect on inactive nodes
                    inactiveNode.vy -= fy * 0.3;
                }
            });
        });
    });
}
    /**
     * Applies radial forces to create a radial layout
     * 
     * @param {Array} nodes - Array of node objects
     * @param {Object} options - Visualization options
     */
    function applyRadialForces(nodes, options) {
        if (!simulation) return;
        
        // Group nodes by community
        const communities = {};
        nodes.forEach(node => {
            const communityId = node.community_id || 0;
            if (!communities[communityId]) {
                communities[communityId] = [];
            }
            communities[communityId].push(node);
        });
        
        const communityIds = Object.keys(communities);
        const radius = Math.min(width, height) * 0.35;
        
        // Add a radial force
        simulation.force('radial', function(alpha) {
            // For each community, position nodes in a circle around the center
            communityIds.forEach((communityId, communityIndex) => {
                const communityNodes = communities[communityId];
                if (!communityNodes.length) return;
                
                // Calculate the angular position of this community
                const communityAngle = (communityIndex * 2 * Math.PI) / communityIds.length;
                
                // Calculate the center point for this community
                const centerX = width / 2 + radius * Math.cos(communityAngle);
                const centerY = height / 2 + radius * Math.sin(communityAngle);
                
                // Position nodes in a smaller circle around community center
                communityNodes.forEach((node, i) => {
                    const nodeAngle = communityAngle + ((i * 2 * Math.PI) / communityNodes.length) * 0.5;
                    const nodeRadius = radius * 0.3;
                    
                    const targetX = centerX + nodeRadius * Math.cos(nodeAngle);
                    const targetY = centerY + nodeRadius * Math.sin(nodeAngle);
                    
                    // Apply force toward target position
                    const strength = alpha * 0.8;
                    node.vx += (targetX - node.x) * strength;
                    node.vy += (targetY - node.y) * strength;
                });
            });
        });
        
        // Reduce the strength of the center force
        if (simulation.force('center')) {
            simulation.force('center').strength(0.05);
        }
    }
    
    /**
     * Applies bubble force layout
     * 
     * @param {Array} nodes - Array of node objects
     * @param {Object} options - Visualization options
     */
    function applyBubbleForceLayout(nodes, options) {
        if (!simulation) return;
        
        // Group nodes by component
        const components = {};
        nodes.forEach(node => {
            const componentId = node.component_id || 0;
            if (!components[componentId]) {
                components[componentId] = [];
            }
            components[componentId].push(node);
        });
        
        const componentIds = Object.keys(components);
        
        // Add a component bubble force
        simulation.force('bubble-force', function(alpha) {
            // Calculate component centers (they move with the simulation)
            const componentCenters = {};
            componentIds.forEach(componentId => {
                const componentNodes = components[componentId];
                if (!componentNodes.length) return;
                
                // Calculate center of mass for this component
                let centerX = 0, centerY = 0;
                componentNodes.forEach(node => {
                    centerX += node.x || 0;
                    centerY += node.y || 0;
                });
                centerX /= componentNodes.length;
                centerY /= componentNodes.length;
                
                componentCenters[componentId] = { x: centerX, y: centerY };
                
                // Calculate appropriate radius based on node count
                const nodeCount = componentNodes.length;
                const radius = Math.sqrt(nodeCount) * 20;
                
                // Apply force to keep nodes within their component bubble
                componentNodes.forEach(node => {
                    const dx = node.x - centerX;
                    const dy = node.y - centerY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    // Force increases with distance from center
                    const strength = alpha * Math.min(1, distance / radius);
                    
                    node.vx -= dx * strength;
                    node.vy -= dy * strength;
                    
                    // Hard constraint to keep nodes within bubble
                    if (distance > radius) {
                        const scale = radius / distance;
                        node.x = centerX + dx * scale;
                        node.y = centerY + dy * scale;
                    }
                });
            });
            
            // Add repulsion between component centers
            const repulsionStrength = alpha * 2.0;
            
            for (let i = 0; i < componentIds.length; i++) {
                for (let j = i + 1; j < componentIds.length; j++) {
                    const centerA = componentCenters[componentIds[i]];
                    const centerB = componentCenters[componentIds[j]];
                    
                    if (!centerA || !centerB) continue;
                    
                    // Calculate repulsion
                    const dx = centerA.x - centerB.x;
                    const dy = centerA.y - centerB.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance > 0) {
                        // Apply repulsion force
                        const force = repulsionStrength / Math.max(distance, 10);
                        const fx = dx / distance * force;
                        const fy = dy / distance * force;
                        
                        components[componentIds[i]].forEach(node => {
                            node.vx += fx;
                            node.vy += fy;
                        });
                        
                        components[componentIds[j]].forEach(node => {
                            node.vx -= fx;
                            node.vy -= fy;
                        });
                    }
                }
            }
        });
        
        // Reduce the strength of the center force
        if (simulation.force('center')) {
            simulation.force('center').strength(0.05);
        }
    }
    
    /**
     * Applies bubble-radial layout
     * 
     * @param {Array} nodes - Array of node objects
     * @param {Object} options - Visualization options
     */
    function applyBubbleRadialLayout(nodes, options) {
        if (!simulation) return;
        
        // Group nodes by component and community
        const components = {};
        const communitiesInComponents = {};
        
        nodes.forEach(node => {
            const componentId = node.component_id || 0;
            const communityId = node.community_id || 0;
            
            if (!components[componentId]) {
                components[componentId] = [];
                communitiesInComponents[componentId] = {};
            }
            
            components[componentId].push(node);
            
            if (!communitiesInComponents[componentId][communityId]) {
                communitiesInComponents[componentId][communityId] = [];
            }
            
            communitiesInComponents[componentId][communityId].push(node);
        });
        
        const componentIds = Object.keys(components);
        
        // Add a component bubble + community radial force
        simulation.force('bubble-radial', function(alpha) {
            // Position components in a circle around the center
            componentIds.forEach((componentId, componentIndex) => {
                const componentNodes = components[componentId];
                if (!componentNodes.length) return;
                
                // Calculate the angular position of this component
                const componentAngle = (componentIndex * 2 * Math.PI) / componentIds.length;
                const radius = Math.min(width, height) * 0.35;
                
                // Calculate the center point for this component
                const centerX = width / 2 + radius * Math.cos(componentAngle);
                const centerY = height / 2 + radius * Math.sin(componentAngle);
                
                // Calculate appropriate bubble radius based on node count
                const nodeCount = componentNodes.length;
                const bubbleRadius = Math.sqrt(nodeCount) * 15;
                
                // Get communities in this component
                const communities = communitiesInComponents[componentId];
                const communityIds = Object.keys(communities);
                
                // Position communities in a circle within their component
                communityIds.forEach((communityId, communityIndex) => {
                    const communityNodes = communities[communityId];
                    if (!communityNodes.length) return;
                    
                    // Calculate the angular position of this community within component
                    const communityAngle = componentAngle + ((communityIndex * 2 * Math.PI) / communityIds.length) * 0.8;
                    
                    // Calculate the center point for this community (slightly inside bubble)
                    const communityCenterX = centerX + bubbleRadius * 0.6 * Math.cos(communityAngle);
                    const communityCenterY = centerY + bubbleRadius * 0.6 * Math.sin(communityAngle);
                    
                    // Position nodes in a smaller circle around community center
                    communityNodes.forEach((node, i) => {
                        const nodeAngle = communityAngle + ((i * 2 * Math.PI) / communityNodes.length) * 0.5;
                        const nodeRadius = bubbleRadius * 0.3;
                        
                        const targetX = communityCenterX + nodeRadius * Math.cos(nodeAngle);
                        const targetY = communityCenterY + nodeRadius * Math.sin(nodeAngle);
                        
                        // Apply force toward target position
                        const strength = alpha * 0.8;
                        node.vx += (targetX - node.x) * strength;
                        node.vy += (targetY - node.y) * strength;
                    });
                });
                
                // Apply force to keep nodes within their component bubble
                componentNodes.forEach(node => {
                    const dx = node.x - centerX;
                    const dy = node.y - centerY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    // Hard constraint to keep nodes within bubble
                    if (distance > bubbleRadius) {
                        const scale = bubbleRadius / distance;
                        node.x = centerX + dx * scale;
                        node.y = centerY + dy * scale;
                    }
                });
            });
        });
        
        // Turn off the center force
        if (simulation.force('center')) {
            simulation.force('center').strength(0);
        }
    }
    
    /**
     * Sorts nodes based on the specified criteria
     * 
     * @param {Array} nodes - Array of node objects to sort
     * @param {string} sortBy - The sorting criteria
     */
    function sortNodes(nodes, sortBy) {
        switch (sortBy) {
            case 'in-degree':
                nodes.sort((a, b) => (b.in_degree_centrality || 0) - (a.in_degree_centrality || 0));
                break;
            case 'out-degree':
                nodes.sort((a, b) => (b.out_degree_centrality || 0) - (a.out_degree_centrality || 0));
                break;
            case 'component':
                nodes.sort((a, b) => (a.component_id || 0) - (b.component_id || 0));
                break;
            case 'community':
                nodes.sort((a, b) => (a.community_id || 0) - (b.community_id || 0));
                break;
            case 'piece-type':
                // Order: king, queen, rook, bishop, knight, pawn
                const typeOrder = { king: 1, queen: 2, rook: 3, bishop: 4, knight: 5, pawn: 6 };
                nodes.sort((a, b) => {
                    const aType = a.piece_type ? typeOrder[a.piece_type.toLowerCase()] || 7 : 7;
                    const bType = b.piece_type ? typeOrder[b.piece_type.toLowerCase()] || 7 : 7;
                    return aType - bType;
                });
                break;
            case 'piece-color':
                // Order: white, black, empty
                nodes.sort((a, b) => {
                    const aColor = a.piece_color === 'white' ? 0 : a.piece_color === 'black' ? 1 : 2;
                    const bColor = b.piece_color === 'white' ? 0 : b.piece_color === 'black' ? 1 : 2;
                    return aColor - bColor;
                });
                break;
        }
    }
    
    /**
     * Updates the node elements
     * 
     * @param {Array} activeNodes - Array of active node objects
     * @param {Array} inactiveNodes - Array of inactive node objects
     * @param {Object} options - Visualization options
     */
    function updateNodes(activeNodes, inactiveNodes, options) {
        if (!svg) return;
        
        // Select all node groups
        const nodeGroup = svg.select('.node-group');
        if (!nodeGroup.node()) return;
        
        // Combine active and inactive nodes for rendering
        const allNodes = [...activeNodes];
        
        if (options.showInactiveNodes) {
            allNodes.push(...inactiveNodes);
        }
        
        // Join data with node groups
        nodeElements = nodeGroup.selectAll('.node')
            .data(allNodes, function(d) { return d.id; });
        
        // Remove old nodes with exit animation
        nodeElements.exit()
            .transition()
            .duration(options.animationEnabled ? 500 : 0)
            .attr('opacity', 0)
            .remove();
        
        // Create new node groups
        const nodeEnter = nodeElements.enter()
            .append('g')
            .attr('class', function(d) { 
                return `node ${d.status === 'inactive' ? 'inactive-node' : 'active-node'}`; 
            })
            .attr('id', function(d) { return `node-${d.id}`; });
        
        // Add node circles - colored by the selected attribute
        nodeEnter.append('circle')
            .attr('class', 'node-circle')
            .attr('r', function(d) { return getNodeRadius(d); })
            .attr('fill', function(d) { return getNodeFill(d, options); })
            .attr('stroke', '#666')
            .attr('stroke-width', 1.5)
            .attr('opacity', function(d) { return d.status === 'inactive' ? 0.7 : 1; });
        
        // Add chess pieces as Unicode symbols with PROPER COLORING
        nodeEnter.filter(function(d) { return d.has_piece === true; })
            .append('text')
            .attr('class', 'chess-piece')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('dy', '0.05em')
            .style('font-size', function(d) { return getNodeRadius(d) * 1.2 + 'px'; })
            .style('font-family', "'Arial Unicode MS', 'Segoe UI Symbol', sans-serif")
            .style('pointer-events', 'none')
            .style('fill', function(d) {
                // EXPLICITLY set fill color based on piece color
                return d.piece_color === 'white' ? 'white' : 'black';
            })
            .style('stroke', function(d) {
                // Add contrasting outline for better visibility
                return d.piece_color === 'white' ? 'black' : 'white';
            })
            .style('stroke-width', '0.5px')
            .style('paint-order', 'stroke') // Draw stroke behind fill
            .text(function(d) {
                // Map piece symbols to Unicode chess symbols
                if (!d.piece_symbol) return "♙";
                
                const symbol = d.piece_symbol.toLowerCase();
                
                // Map to Unicode chess symbols - use same symbol set regardless of color
                // We'll control color with fill instead
                switch(symbol) {
                    case 'p': return '♟';
                    case 'n': return '♞';
                    case 'b': return '♝';
                    case 'r': return '♜';
                    case 'q': return '♛';
                    case 'k': return '♚';
                    default: return '♟';
                }
            });
        
        // Add status indicator for inactive nodes
        nodeEnter.filter(function(d) { return d.status === 'inactive'; })
            .append('text')
            .attr('class', 'status-indicator')
            .attr('text-anchor', 'middle')
            .attr('dy', function(d) { return getNodeRadius(d) + 15; })
            .style('font-size', '10px')
            .style('font-style', 'italic')
            .style('fill', '#FFC107')
            .style('text-shadow', '0 0 3px #000, 0 0 2px #000')
            .style('pointer-events', 'none')
            .text('waiting');
        
        // Add node position labels with different positioning based on piece presence
        nodeEnter.append('text')
            .attr('class', 'node-label')
            .attr('dy', function(d) { 
                return d.has_piece ? getNodeRadius(d) + 12 : '0.35em'; 
            })
            .text(function(d) { return d.position; })
            .attr('text-anchor', 'middle')
            .style('font-size', function(d) {
                return d.has_piece ? '12px' : '10px';
            })
            .style('font-weight', 'bold')
            .style('fill', '#fff')
            .style('text-shadow', '0 0 3px #000, 0 0 2px #000')
            .style('pointer-events', 'none')
            .style('opacity', function(d) {
                return d.status === 'inactive' ? 0.7 : 1;
            });
        
        // Merge enter + update selections
        nodeElements = nodeEnter.merge(nodeElements);
        
        // Update existing nodes
        nodeElements.select('.node-circle')
            .transition()
            .duration(options.animationEnabled ? 500 : 0)
            .attr('r', function(d) { return getNodeRadius(d); })
            .attr('fill', function(d) { return getNodeFill(d, options); });
        
        // Handle chess pieces correctly during updates
        nodeElements.each(function(d) {
            const node = d3.select(this);
            const hasPieceElement = node.select('.chess-piece').size() > 0;
            
            if (!d.has_piece && hasPieceElement) {
                // Remove chess piece from nodes that shouldn't have them
                node.select('.chess-piece').remove();
            } else if (d.has_piece && !hasPieceElement) {
                // Add chess piece to nodes that should have them but don't
                node.append('text')
                    .attr('class', 'chess-piece')
                    .attr('text-anchor', 'middle')
                    .attr('dominant-baseline', 'central')
                    .attr('dy', '0.05em')
                    .style('font-size', getNodeRadius(d) * 1.2 + 'px')
                    .style('font-family', "'Arial Unicode MS', 'Segoe UI Symbol', sans-serif")
                    .style('pointer-events', 'none')
                    .style('fill', d.piece_color === 'white' ? 'white' : 'black')
                    .style('stroke', d.piece_color === 'white' ? 'black' : 'white')
                    .style('stroke-width', '0.5px')
                    .style('paint-order', 'stroke')
                    .text(function() {
                        if (!d.piece_symbol) return "♙";
                        
                        const symbol = d.piece_symbol.toLowerCase();
                        switch(symbol) {
                            case 'p': return '♟';
                            case 'n': return '♞';
                            case 'b': return '♝';
                            case 'r': return '♜';
                            case 'q': return '♛';
                            case 'k': return '♚';
                            default: return '♟';
                        }
                    });
            }
        });
        
        // Update existing chess pieces
        nodeElements.select('.chess-piece')
            .style('font-size', function(d) { return getNodeRadius(d) * 1.2 + 'px'; })
            .style('fill', function(d) {
                return d.piece_color === 'white' ? 'white' : 'black';
            })
            .style('stroke', function(d) {
                return d.piece_color === 'white' ? 'black' : 'white';
            });
        
        // Update node labels
        nodeElements.select('.node-label')
            .style('opacity', function(d) { 
                const baseOpacity = getLabelOpacity(d, options.labelVisibility);
                return d.status === 'inactive' ? baseOpacity * 0.7 : baseOpacity;
            })
            .attr('dy', function(d) { 
                return d.has_piece ? getNodeRadius(d) + 12 : '0.35em';
            })
            .style('font-size', function(d) {
                return d.has_piece ? '12px' : '10px';
            });
        
        // Add hover behavior
        nodeElements
            .on('mouseover', handleNodeMouseover)
            .on('mouseout', handleNodeMouseout)
            .on('click', handleNodeClick);
        
        // Update node drag behavior
        if (simulation) {
            nodeElements.call(d3.drag()
                .on('start', dragStarted)
                .on('drag', dragged)
                .on('end', dragEnded));
        }
    }
    
    /**
     * Updates the link elements
     * 
     * @param {Array} links - Array of link objects
     * @param {Object} options - Visualization options
     */
    function updateLinks(links, options) {
        if (!svg) return;
        
        // Select all links
        const linkGroup = svg.select('.link-group');
        if (!linkGroup.node()) return;
        
        // Join data with links
        linkElements = linkGroup.selectAll('.link')
            .data(links, function(d) { 
                return `${typeof d.source === 'object' ? d.source.id : d.source}-${typeof d.target === 'object' ? d.target.id : d.target}`; 
            });
        
        // Remove old links with exit animation
        linkElements.exit()
            .transition()
            .duration(options.animationEnabled ? 500 : 0)
            .attr('opacity', 0)
            .remove();
        
        // Create new links
        const linkEnter = linkElements.enter()
            .append('path')
            .attr('class', 'link')
            .attr('marker-mid', function(d) { return getArrowMarker(d, options.arrowStyle); });
        
        // Merge enter + update selections
        linkElements = linkEnter.merge(linkElements);
        
        // Update all links
        linkElements
            .attr('stroke-width', function(d) { return 1 + (d.weight || 1) * 2; })
            .classed('animated', options.animationEnabled && options.arrowStyle === 'animated')
            .attr('marker-mid', function(d) { return getArrowMarker(d, options.arrowStyle); })
            .attr('stroke', function(d) {
                // Color links based on source node color if possible
                if (typeof d.source === 'object' && d.source && options.colorBy) {
                    const color = getNodeFill(d.source, options);
                    // Make the link color more subtle
                    const rgbColor = d3.rgb(color);
                    return rgbColor.darker(1).toString();
                }
                return 'rgba(255, 255, 255, 0.3)';
            });
        
        // Add hover behavior
        linkElements
            .on('mouseover', handleLinkMouseover)
            .on('mouseout', handleLinkMouseout);
    }
    
    /**
     * Updates the community hulls
     * 
     * @param {Array} communities - Array of community objects
     * @param {Array} nodes - Array of node objects
     * @param {Object} options - Visualization options
     */
    function updateCommunities(communities, nodes, options) {
        if (!svg || !options.showCommunities) {
            // Remove all hulls if communities should not be shown
            if (svg) svg.select('.hull-group').selectAll('.community-hull').remove();
            return;
        }
        
        const hullGroup = svg.select('.hull-group');
        if (!hullGroup.node()) return;
        
        // Join data with hulls
        hullElements = hullGroup.selectAll('.community-hull')
            .data(communities, function(d) { return d.id; });
        
        // Remove old hulls
        hullElements.exit().remove();
        
        // Create new hulls
        const hullEnter = hullElements.enter()
            .append('path')
            .attr('class', 'community-hull')
            .attr('fill', function(d) { 
                // Use the same color scale as the nodes
                return colorScales.community(d.id); 
            })
            .attr('stroke', function(d) { 
                const color = d3.color(colorScales.community(d.id));
                return color ? color.darker(0.5) : '#666'; 
            });
        
        // Merge enter + update selections
        hullElements = hullEnter.merge(hullElements);
        
        // Update hull colors if the color scheme has changed
        if (options.colorBy === 'community') {
            hullElements
                .attr('fill', function(d) { return colorScales.community(d.id); })
                .attr('stroke', function(d) { 
                    const color = d3.color(colorScales.community(d.id));
                    return color ? color.darker(0.5) : '#666'; 
                });
        }
    }
    
    /**
     * Sets up the arrow definitions for directed edges
     */
    function setupArrowDefinitions() {
        if (!arrowDefs) return;
        
        // Remove any existing markers
        arrowDefs.selectAll('marker').remove();
        
        // Mid-arrow classic marker (white fill for better visibility)
        arrowDefs.append('marker')
            .attr('id', 'arrow-classic-mid')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 5) // Center the reference point
            .attr('refY', 0)
            .attr('markerWidth', 8) // Increased size for better visibility
            .attr('markerHeight', 8) // Increased size for better visibility
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', '#FFFFFF'); // White fill for better visibility
        
        // Mid-arrow tapered marker (white fill for better visibility)
        arrowDefs.append('marker')
            .attr('id', 'arrow-tapered-mid')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 5) // Center the reference point
            .attr('refY', 0)
            .attr('markerWidth', 8) // Increased size for better visibility
            .attr('markerHeight', 8) // Increased size for better visibility
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-3L10,0L0,3')
            .attr('fill', '#FFFFFF'); // White fill for better visibility
        
        // Mid-arrow animated marker (white fill for better visibility)
        arrowDefs.append('marker')
            .attr('id', 'arrow-animated-mid')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 5) // Center the reference point
            .attr('refY', 0)
            .attr('markerWidth', 8) // Increased size for better visibility
            .attr('markerHeight', 8) // Increased size for better visibility
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-4L10,0L0,4L4,0Z')
            .attr('fill', '#FFFFFF'); // White fill for better visibility
    }
    
    /**
     * Determines the radius of a node
     * 
     * @param {Object} node - The node object
     * @returns {number} - The radius in pixels
     */
    function getNodeRadius(node) {
        // Minimum base radius to ensure nodes are always visible
        const minBaseRadius = 15;
        
        if (!node) return minBaseRadius;
        
        // Inactive nodes are slightly smaller
        const statusFactor = node.status === 'inactive' ? 0.8 : 1.0;
        
        // Based on selected sizing option
        switch (currentOptions.nodeSize) {
            case 'in-degree':
                // Scale in-degree with a higher minimum size and stronger scaling
                return minBaseRadius * statusFactor * (0.9 + (node.in_degree_centrality || 0) * 2.5);
                
            case 'out-degree':
                // Scale out-degree with a higher minimum size and stronger scaling
                return minBaseRadius * statusFactor * (0.9 + (node.out_degree_centrality || 0) * 2.5);
                
            case 'community':
                // Vary size by community with a higher baseline
                return minBaseRadius * statusFactor * (0.9 + ((node.community_id || 0) % 3) * 0.25);
                
            case 'component':
                // Vary size by component
                return minBaseRadius * statusFactor * (0.9 + ((node.component_id || 0) % 3) * 0.3);
                
            case 'fixed':
            default:
                return minBaseRadius * statusFactor;
        }
    }
    
    /**
     * Determines the fill color of a node
     * 
     * @param {Object} node - The node object
     * @param {Object} options - The visualization options
     * @returns {string} - CSS color value
     */
    function getNodeFill(node, options) {
        if (!node) return '#666';
        
        // Get the color based on the selected attribute
        const colorBy = options.colorBy || 'community';
        
        switch (colorBy) {
            case 'community':
                return colorScales.community(node.community_id || 0);
                
            case 'component':
                return colorScales.component(node.component_id || 0);
                
            case 'piece-type':
                if (node.has_piece && node.piece_type) {
                    return colorScales['piece-type'](node.piece_type.toLowerCase());
                }
                return '#A9A9A9'; // Default gray for empty squares
                
            case 'piece-color':
                if (node.has_piece && node.piece_color) {
                    const baseColor = colorScales['piece-color'](node.piece_color);
                    // Make black pieces dark gray for better visibility
                    return node.piece_color === 'black' ? '#333333' : baseColor;
                }
                return '#A9A9A9'; // Default gray for empty squares
                
            case 'status':
                return colorScales.status(node.status || 'active');
                
            default:
                return colorScales.community(node.community_id || 0);
        }
    }
    
    /**
     * Determines the label opacity based on visibility setting
     * 
     * @param {Object} node - The node object
     * @param {string} visibility - The label visibility setting
     * @returns {number} - Opacity value (0-1)
     */
    function getLabelOpacity(node, visibility) {
        if (!node) return 0;
        
        switch (visibility) {
            case 'all':
                return 1;
            case 'hover':
                return 0; // Will be shown on hover
            case 'pieces':
                return node.has_piece ? 1 : 0;
            case 'none':
                return 0;
            default:
                return 1;
        }
    }
    
    /**
     * Gets the appropriate arrow marker based on style
     * 
     * @param {Object} link - The link object
     * @param {string} style - The arrow style
     * @returns {string} - The marker URL
     */
    function getArrowMarker(link, style) {
        switch (style) {
            case 'classic':
                return 'url(#arrow-classic-mid)';
            case 'tapered':
                return 'url(#arrow-tapered-mid)';
            case 'animated':
                return 'url(#arrow-animated-mid)';
            default:
                return 'url(#arrow-tapered-mid)';
        }
    }
    
    /**
     * Creates a straight line path for a link with middle point for arrow placement
     * 
     * @param {Object} d - The link data
     * @returns {string} - SVG path data
     */
    function linkArc(d) {
        if (!d) return 'M0,0L0,0';
        
        const sourceX = (typeof d.source === 'object' ? d.source.x : 0) || 0;
        const sourceY = (typeof d.source === 'object' ? d.source.y : 0) || 0;
        const targetX = (typeof d.target === 'object' ? d.target.x : 0) || 0;
        const targetY = (typeof d.target === 'object' ? d.target.y : 0) || 0;
        
        // Calculate midpoint for arrow placement
        const midX = (sourceX + targetX) / 2;
        const midY = (sourceY + targetY) / 2;
        
        // Create a straight line path with explicit midpoint for marker-mid
        return `M${sourceX},${sourceY}L${midX},${midY}L${targetX},${targetY}`;
    }
    
    /**
     * Extracts communities from nodes
     * 
     * @param {Array} nodes - Array of node objects
     * @returns {Array} - Array of community objects
     */
    function getCommunities(nodes) {
        const communities = new Map();
        
        if (!nodes || !Array.isArray(nodes)) return [];
        
        // Group nodes by community
        nodes.forEach(node => {
            if (!node) return;
            
            const communityId = node.community_id || 0;
            if (!communities.has(communityId)) {
                communities.set(communityId, {
                    id: communityId,
                    nodes: []
                });
            }
            communities.get(communityId).nodes.push(node);
        });
        
        return Array.from(communities.values());
    }
    
    /**
     * Handles mouseover events on nodes
     * 
     * @param {Event} event - The mouse event
     * @param {Object} d - The node data
     */
    function handleNodeMouseover(event, d) {
        if (!d || !nodeElements) return;
        
        // Highlight the node
        d3.select(this).select('circle')
            .transition().duration(200)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);
        
        // Show label if visibility is set to hover
        if (currentOptions.labelVisibility === 'hover') {
            d3.select(this).select('.node-label')
                .style('opacity', 1);
        }
        
        // Highlight connected links and nodes
        highlightConnectedElements(d);
        
        // Show tooltip
        showNodeTooltip(event, d);
    }
    
    /**
     * Handles mouseout events on nodes
     * 
     * @param {Event} event - The mouse event
     * @param {Object} d - The node data
     */
    function handleNodeMouseout(event, d) {
        if (!d || !nodeElements) return;
        
        // Reset node style
        d3.select(this).select('circle')
            .transition().duration(200)
            .attr('stroke', '#666')
            .attr('stroke-width', 1.5);
        
        // Hide label if visibility is set to hover
        if (currentOptions.labelVisibility === 'hover') {
            d3.select(this).select('.node-label')
                .style('opacity', 0);
        }
        
        // Unhighlight connected elements
        unhighlightConnectedElements();
        
        // Hide tooltip
        hideTooltip();
    }
    
    /**
     * Handles click events on nodes
     * 
     * @param {Event} event - The mouse event
     * @param {Object} d - The node data
     */
    function handleNodeClick(event, d) {
        if (!d || !currentData) return;
        
        // Toggle selection
        if (d === currentData.selectedNode) {
            currentData.selectedNode = null;
        } else {
            currentData.selectedNode = d;
        }
        
        // Update selected node info in metrics panel
        updateSelectedNodeInfo(d);
        
        // Highlight the connected elements
        highlightConnectedElements(d, true);
        
        // Prevent event propagation
        event.stopPropagation();
    }
    
    /**
     * Handles mouseover events on links
     * 
     * @param {Event} event - The mouse event
     * @param {Object} d - The link data
     */
    function handleLinkMouseover(event, d) {
        if (!d || !linkElements) return;
        
        // Highlight the link
        d3.select(this)
            .transition().duration(200)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2 + (d.weight || 1) * 2);
        
        // Get source and target IDs
        const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
        const targetId = typeof d.target === 'object' ? d.target.id : d.target;
        
        // Highlight source and target nodes
        d3.select(`#node-${sourceId}`).select('circle')
            .transition().duration(200)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);
            
        d3.select(`#node-${targetId}`).select('circle')
            .transition().duration(200)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);
        
        // Show tooltip
        showLinkTooltip(event, d);
    }
    
    /**
     * Handles mouseout events on links
     * 
     * @param {Event} event - The mouse event
     * @param {Object} d - The link data
     */
    function handleLinkMouseout(event, d) {
        if (!d || !linkElements) return;
        
        // Reset link style
        d3.select(this)
            .transition().duration(200)
            .attr('stroke', function() {
                // Color links based on source node color if possible
                if (typeof d.source === 'object' && d.source && currentOptions.colorBy) {
                    const color = getNodeFill(d.source, currentOptions);
                    // Make the link color more subtle
                    const rgbColor = d3.rgb(color);
                    return rgbColor.darker(1).toString();
                }
                return 'rgba(255, 255, 255, 0.3)';
            })
            .attr('stroke-width', 1 + (d.weight || 1) * 2);
        
        // Get source and target IDs
        const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
        const targetId = typeof d.target === 'object' ? d.target.id : d.target;
        
        // Reset node styles
        d3.select(`#node-${sourceId}`).select('circle')
            .transition().duration(200)
            .attr('stroke', '#666')
            .attr('stroke-width', 1.5);
            
        d3.select(`#node-${targetId}`).select('circle')
            .transition().duration(200)
            .attr('stroke', '#666')
            .attr('stroke-width', 1.5);
        
        // Hide tooltip
        hideTooltip();
    }
    
    /**
     * Shows a tooltip for a node
     * 
     * @param {Event} event - The mouse event
     * @param {Object} d - The node data
     */
    function showNodeTooltip(event, d) {
        if (!d || !tooltip) return;
        
        let content = `<div><strong>Square: ${d.position || 'Unknown'}</strong></div>`;
        
        if (d.has_piece) {
            content += `<div>Piece: ${d.piece_color || ''} ${d.piece_type || ''}</div>`;
        }
        
        content += `<div>Status: ${d.status || 'active'}</div>`;
        content += `<div>Community: ${d.community_id || 0}</div>`;
        content += `<div>Component: ${d.component_id || 0}</div>`;
        content += `<div>In-Degree: ${((d.in_degree_centrality || 0) * 1000 | 0) / 1000}</div>`;
        content += `<div>Out-Degree: ${((d.out_degree_centrality || 0) * 1000 | 0) / 1000}</div>`;
        
        tooltip.html(content)
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY + 10}px`)
            .classed('hidden', false);
    }
    
    /**
     * Shows a tooltip for a link
     * 
     * @param {Event} event - The mouse event
     * @param {Object} d - The link data
     */
    function showLinkTooltip(event, d) {
        if (!d || !tooltip) return;
        
        const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
        const targetId = typeof d.target === 'object' ? d.target.id : d.target;
        
        let content = `<div><strong>Influence</strong></div>`;
        content += `<div>From: ${sourceId || 'Unknown'}</div>`;
        content += `<div>To: ${targetId || 'Unknown'}</div>`;
        content += `<div>Weight: ${d.weight || 1}</div>`;
        
        tooltip.html(content)
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY + 10}px`)
            .classed('hidden', false);
    }
    
    /**
     * Hides the tooltip
     */
    function hideTooltip() {
        if (tooltip) {
            tooltip.classed('hidden', true);
        }
    }
    
    /**
     * Highlights connected nodes and links
     * 
     * @param {Object} node - The central node
     * @param {boolean} isPermanent - Whether the highlight is permanent (from click)
     */
    function highlightConnectedElements(node, isPermanent = false) {
        if (!node || !nodeElements || !linkElements) return;
        
        // Dim all nodes and links
        nodeElements.select('circle')
            .transition().duration(200)
            .attr('opacity', 0.3);
        
        linkElements
            .transition().duration(200)
            .attr('opacity', 0.1);
        
        // Get connected nodes and links
        const connectedNodeIds = new Set([node.id]);
        const connectedLinks = [];
        
        // Find incoming links (target is this node)
        linkElements.each(function(link) {
            if (!link) return;
            
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            
            if (targetId === node.id) {
                connectedNodeIds.add(sourceId);
                connectedLinks.push(link);
            }
            
            if (sourceId === node.id) {
                connectedNodeIds.add(targetId);
                connectedLinks.push(link);
            }
        });
        
        // Highlight connected nodes
        nodeElements.filter(function(d) { return d && connectedNodeIds.has(d.id); })
            .select('circle')
            .transition().duration(200)
            .attr('opacity', 0.7); // Keep some transparency to see chess pieces
        
        // Also ensure piece backgrounds and symbols remain visible
        nodeElements.filter(function(d) { return d && connectedNodeIds.has(d.id) && d.has_piece; })
            .select('.piece-background')
            .transition().duration(200)
            .attr('opacity', 1);
            
        nodeElements.filter(function(d) { return d && connectedNodeIds.has(d.id) && d.has_piece; })
            .select('.piece-symbol')
            .transition().duration(200)
            .attr('opacity', 1);
        
        // Highlight connected links
        linkElements.filter(function(d) {
            if (!d) return false;
            
            const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
            const targetId = typeof d.target === 'object' ? d.target.id : d.target;
            return (sourceId === node.id || targetId === node.id);
        })
        .transition().duration(200)
        .attr('opacity', 1)
        .attr('stroke-width', function(d) { return 1.5 + (d.weight || 1) * 2; })
        .attr('stroke', '#fff');
        
        // Highlight the current node specifically
        d3.select(`#node-${node.id}`).select('circle')
            .transition().duration(200)
            .attr('stroke', '#ffcc00')
            .attr('stroke-width', 3);
    }
    
    /**
     * Unhighlights all elements
     */
    function unhighlightConnectedElements() {
        if (!nodeElements || !linkElements) return;
        
        // Reset all nodes and links
        nodeElements.select('circle')
            .transition().duration(200)
            .attr('opacity', function(d) { return d.status === 'inactive' ? 0.7 : 1; });
        
        // Ensure piece elements are fully visible
        nodeElements.select('.piece-background')
            .transition().duration(200)
            .attr('opacity', 1);
            
        nodeElements.select('.piece-symbol')
            .transition().duration(200)
            .attr('opacity', 1);
        
        linkElements
            .transition().duration(200)
            .attr('opacity', 1)
            .attr('stroke', function(d) {
                // Color links based on source node color if possible
                if (typeof d.source === 'object' && d.source && currentOptions.colorBy) {
                    const color = getNodeFill(d.source, currentOptions);
                    // Make the link color more subtle
                    const rgbColor = d3.rgb(color);
                    return rgbColor.darker(1).toString();
                }
                return 'rgba(255, 255, 255, 0.3)';
            })
            .attr('stroke-width', function(d) { return 1 + (d.weight || 1) * 2; });
    }
    
    /**
     * Updates the selected node info in the metrics panel
     * 
     * @param {Object} node - The selected node
     */
    function updateSelectedNodeInfo(node) {
        const selectedNodeInfo = document.getElementById('selected-node-info');
        if (!selectedNodeInfo) return;
        
        if (!node) {
            selectedNodeInfo.innerHTML = '<p>No node selected</p>';
            return;
        }
        
        let content = `<div><strong>Square: ${node.position || 'Unknown'}</strong></div>`;
        
        if (node.has_piece) {
            content += `<div>Piece: ${node.piece_color || ''} ${node.piece_type || ''}</div>`;
        } else {
            content += `<div>Empty square</div>`;
        }
        
        content += `<hr>`;
        content += `<div>Status: ${node.status || 'active'}</div>`;
        content += `<div>Community: ${node.community_id || 0}</div>`;
        content += `<div>Component: ${node.component_id || 0}</div>`;
        content += `<div>In-Degree: ${((node.in_degree_centrality || 0) * 1000 | 0) / 1000}</div>`;
        content += `<div>Out-Degree: ${((node.out_degree_centrality || 0) * 1000 | 0) / 1000}</div>`;
        
        selectedNodeInfo.innerHTML = content;
    }
    
    /**
     * Handles the start of a drag operation
     * 
     * @param {Event} event - The drag event
     */
    function dragStarted(event) {
        if (!event.active && simulation) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }
    
    /**
     * Handles the drag operation
     * 
     * @param {Event} event - The drag event
     */
    function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }
    
    /**
     * Handles the end of a drag operation
     * 
     * @param {Event} event - The drag event
     */
    function dragEnded(event) {
        if (!event.active && simulation) simulation.alphaTarget(0);
        
        // Release the node (don't keep it fixed) - this is the force philosophy!
        // Let the forces determine the final position
        event.subject.fx = null;
        event.subject.fy = null;
    }
    
    /**
     * Creates a hull path around a set of nodes
     * 
     * @param {Array} nodes - Array of node objects
     * @returns {string} - SVG path data
     */
    function drawHull(nodes) {
        if (!nodes || !Array.isArray(nodes) || nodes.length < 2) return '';
        
        // Get node positions and add padding
        const padding = 15;
        const points = nodes
            .filter(d => d && d.x !== undefined && d.y !== undefined)
            .map(d => [d.x, d.y]);
        
        if (points.length < 2) return '';
        
        // Use d3's hull algorithm
        try {
            const hullData = d3.polygonHull(points);
            
            if (!hullData) return '';
            
            // Add padding to the hull
            const centroidX = d3.mean(points, d => d[0]);
            const centroidY = d3.mean(points, d => d[1]);
            
            const paddedHull = hullData.map(point => {
                const [x, y] = point;
                
                const dx = x - centroidX;
                const dy = y - centroidY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                const paddingRatio = (distance + padding) / distance;
                
                return [
                    centroidX + dx * paddingRatio,
                    centroidY + dy * paddingRatio
                ];
            });
            
            // Convert to SVG path
            return 'M' + paddedHull.join('L') + 'Z';
        } catch (e) {
            console.error('Error creating hull:', e);
            return '';
        }
    }
    
    // Return the API
    return api;
};

// Make the constructor available globally
window.D3Visualization = D3BaseVisualization;