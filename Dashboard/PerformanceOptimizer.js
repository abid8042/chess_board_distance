/**
 * PerformanceOptimizer.js
 * Provides performance optimizations for chess influence network visualizations.
 * Handles node culling, level-of-detail rendering, and force simulation optimizations
 * for large networks.
 */

const PerformanceOptimizer = (function() {
    // Private variables
    let isEnabled = true;
    let currentZoomLevel = 1;
    let lastOptimizationTime = 0;
    let optimizationInterval = 200; // ms between optimization passes
    let nodeCullingEnabled = true;
    let lodRenderingEnabled = true;
    let forceOptimizationEnabled = true;
    let currentNodeCount = 0;
    let currentLinkCount = 0;
    let d3vizInstance = null;
    let simulationInstance = null;
    let container = null;
    
    // Thresholds for optimization stages
    const thresholds = {
        // Node count thresholds for different optimizations
        nodeCulling: 100,         // Start culling when more than 100 nodes
        lodRendering: 50,         // Start LOD when more than 50 nodes
        forceOptimization: 200,   // Optimize simulation when more than 200 nodes
        
        // Alpha decay and velocity decay adjustments based on node count
        alphaDecay: {
            small: 0.02,          // Default for small graphs (<100 nodes)
            medium: 0.01,         // Medium graphs (100-500 nodes)
            large: 0.005          // Large graphs (>500 nodes)
        },
        
        velocityDecay: {
            small: 0.4,           // Default for small graphs
            medium: 0.5,          // Medium graphs 
            large: 0.6            // Large graphs
        },
        
        // Zoom level thresholds for detail levels
        zoom: {
            high: 1.5,            // Show full details above this zoom
            medium: 0.7,          // Show medium details above this zoom
            low: 0.3              // Show minimal details above this zoom
        }
    };
    
    // Public API
    const api = {};
    
    /**
     * Initializes the performance optimizer
     * 
     * @param {Object} config - Configuration object
     * @param {boolean} config.enabled - Whether optimizations are enabled
     * @param {Object} config.d3viz - The D3 visualization instance
     * @param {HTMLElement} config.container - The container element
     * @param {Object} config.thresholds - Optional custom thresholds
     */
    api.init = function(config) {
        console.log('Initializing PerformanceOptimizer with config:', config);
        
        if (!config || !config.d3viz) {
            console.error('Invalid configuration: d3viz instance required');
            return;
        }
        
        isEnabled = config.enabled !== undefined ? config.enabled : true;
        d3vizInstance = config.d3viz;
        container = config.container || document.getElementById('network-container');
        
        // Get simulation instance
        if (d3vizInstance.getSimulation) {
            simulationInstance = d3vizInstance.getSimulation();
        }
        
        // Override default thresholds if provided
        if (config.thresholds) {
            Object.assign(thresholds, config.thresholds);
        }
        
        // Initialize LOD observer
        initZoomObserver();
        
        console.log('PerformanceOptimizer initialized');
    };
    
    /**
     * Updates the performance optimizer with new data and state
     * 
     * @param {Object} config - Update configuration
     * @param {Array} config.nodes - Array of node objects
     * @param {Array} config.links - Array of link objects
     * @param {number} config.zoomLevel - Current zoom level
     */
    api.update = function(config) {
        if (!isEnabled) return;
        
        // Check for throttling - don't optimize too frequently
        const now = Date.now();
        if (now - lastOptimizationTime < optimizationInterval) return;
        lastOptimizationTime = now;
        
        // Check if we have valid data
        if (!config || (!config.nodes && !config.links)) {
            return;
        }
        
        // Update current counts
        currentNodeCount = config.nodes ? config.nodes.length : currentNodeCount;
        currentLinkCount = config.links ? config.links.length : currentLinkCount;
        
        // Update zoom level if provided
        if (config.zoomLevel !== undefined) {
            currentZoomLevel = config.zoomLevel;
        }
        
        // Apply optimizations based on thresholds
        if (nodeCullingEnabled && currentNodeCount > thresholds.nodeCulling) {
            applyCulling(config.nodes, config.links);
        }
        
        if (lodRenderingEnabled && currentNodeCount > thresholds.lodRendering) {
            applyLevelOfDetail(currentZoomLevel);
        }
        
        if (forceOptimizationEnabled && currentNodeCount > thresholds.forceOptimization) {
            optimizeForceSimulation();
        }
    };
    
    /**
     * Sets the enabled state for individual optimization techniques
     * 
     * @param {Object} config - Configuration object
     * @param {boolean} config.nodeCulling - Enable/disable node culling
     * @param {boolean} config.lodRendering - Enable/disable level-of-detail rendering
     * @param {boolean} config.forceOptimization - Enable/disable force simulation optimization
     */
    api.setOptimizationOptions = function(config) {
        if (!config) return;
        
        if (config.nodeCulling !== undefined) nodeCullingEnabled = config.nodeCulling;
        if (config.lodRendering !== undefined) lodRenderingEnabled = config.lodRendering;
        if (config.forceOptimization !== undefined) forceOptimizationEnabled = config.forceOptimization;
        
        console.log('Optimization options updated:', {
            nodeCulling: nodeCullingEnabled,
            lodRendering: lodRenderingEnabled,
            forceOptimization: forceOptimizationEnabled
        });
    };
    
    /**
     * Gets the current optimization state
     * 
     * @returns {Object} - The current optimization state
     */
    api.getState = function() {
        return {
            enabled: isEnabled,
            nodeCulling: nodeCullingEnabled,
            lodRendering: lodRenderingEnabled,
            forceOptimization: forceOptimizationEnabled,
            currentNodeCount: currentNodeCount,
            currentLinkCount: currentLinkCount,
            zoomLevel: currentZoomLevel,
            thresholds: { ...thresholds }
        };
    };
    
    /**
     * Enables or disables all optimizations
     * 
     * @param {boolean} enabled - Whether optimizations should be enabled
     */
    api.setEnabled = function(enabled) {
        isEnabled = enabled;
        
        // If we're enabling optimizations after they were disabled,
        // immediately run an optimization pass
        if (isEnabled) {
            lastOptimizationTime = 0; // Reset throttling timer
            api.update({
                nodes: currentNodeCount ? Array(currentNodeCount) : undefined,
                links: currentLinkCount ? Array(currentLinkCount) : undefined,
                zoomLevel: currentZoomLevel
            });
        } else if (d3vizInstance) {
            // If we're disabling optimizations, reset any visualization changes
            resetOptimizations();
        }
    };
    
    /**
     * Applies node culling based on importance metrics and visibility
     * 
     * @param {Array} nodes - Array of node objects
     * @param {Array} links - Array of link objects
     */
    function applyCulling(nodes, links) {
        if (!d3vizInstance || !nodes || !nodes.length) return;
        
        console.log('Applying node culling for', nodes.length, 'nodes');
        
        // We need to examine the actual container and see if nodes are visible
        const svgContainer = d3vizInstance.getSvgContainer ? 
            d3vizInstance.getSvgContainer() : 
            container.querySelector('svg');
            
        if (!svgContainer) return;
        
        // Get the viewport boundaries
        const containerRect = svgContainer.getBoundingClientRect();
        const viewport = {
            x: 0,
            y: 0,
            width: containerRect.width,
            height: containerRect.height
        };
        
        // Add some padding to avoid culling nodes that are just off-screen
        const padding = 100; // pixels
        viewport.x -= padding;
        viewport.y -= padding;
        viewport.width += padding * 2;
        viewport.height += padding * 2;
        
        // Identify nodes outside the viewport
        const visibleNodeIds = new Set();
        const nodeElements = svgContainer.querySelectorAll('.node');
        
        nodeElements.forEach(nodeElement => {
            const nodeRect = nodeElement.getBoundingClientRect();
            const nodeCenter = {
                x: nodeRect.left + nodeRect.width / 2,
                y: nodeRect.top + nodeRect.height / 2
            };
            
            // Check if node center is in viewport
            const isVisible = 
                nodeCenter.x >= containerRect.left - padding &&
                nodeCenter.x <= containerRect.right + padding &&
                nodeCenter.y >= containerRect.top - padding &&
                nodeCenter.y <= containerRect.bottom + padding;
                
            if (isVisible) {
                // Get node ID
                const nodeId = nodeElement.id ? 
                    nodeElement.id.replace('node-', '') : null;
                
                if (nodeId) {
                    visibleNodeIds.add(nodeId);
                }
            }
        });
        
        // Only if we have a significant number of invisible nodes, apply culling
        if (visibleNodeIds.size < nodes.length * 0.8) {
            // Apply different rendering to visible vs. non-visible nodes
            nodeElements.forEach(nodeElement => {
                const nodeId = nodeElement.id ? 
                    nodeElement.id.replace('node-', '') : null;
                
                if (nodeId) {
                    const isVisible = visibleNodeIds.has(nodeId);
                    
                    // For invisible nodes, reduce their rendering complexity
                    if (!isVisible) {
                        // If extremely zoomed out, hide completely
                        if (currentZoomLevel < thresholds.zoom.low) {
                            nodeElement.style.display = 'none';
                        } else {
                            // Otherwise simplify
                            nodeElement.style.display = '';
                            
                            // Reduce rendering quality
                            const nodeCircle = nodeElement.querySelector('circle');
                            if (nodeCircle) {
                                nodeCircle.setAttribute('r', Math.max(2, parseFloat(nodeCircle.getAttribute('r')) * 0.7));
                            }
                            
                            // Hide labels
                            const nodeLabel = nodeElement.querySelector('.node-label');
                            if (nodeLabel) {
                                nodeLabel.style.display = 'none';
                            }
                        }
                    } else {
                        // Restore normal display for visible nodes
                        nodeElement.style.display = '';
                        
                        // Restore node label if we're zoomed in enough
                        const nodeLabel = nodeElement.querySelector('.node-label');
                        if (nodeLabel) {
                            nodeLabel.style.display = currentZoomLevel >= thresholds.zoom.medium ? '' : 'none';
                        }
                    }
                }
            });
            
            // Also apply culling to links that connect to invisible nodes
            const linkElements = svgContainer.querySelectorAll('.link');
            linkElements.forEach(linkElement => {
                // Extract source and target from the data
                const sourceId = linkElement.getAttribute('data-source') || '';
                const targetId = linkElement.getAttribute('data-target') || '';
                
                // If both nodes are visible, show the link
                const bothVisible = visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
                
                // If extremely zoomed out, hide all links
                if (currentZoomLevel < thresholds.zoom.low) {
                    linkElement.style.display = 'none';
                } else if (!bothVisible) {
                    // Hide links to invisible nodes when zoomed out
                    linkElement.style.display = currentZoomLevel < thresholds.zoom.medium ? 'none' : '';
                    
                    // Reduce opacity for links to invisible nodes
                    linkElement.style.opacity = currentZoomLevel < thresholds.zoom.high ? '0.3' : '';
                } else {
                    // Normal display for links between visible nodes
                    linkElement.style.display = '';
                    linkElement.style.opacity = '';
                }
            });
        } else {
            // If most nodes are visible, restore all nodes to normal display
            nodeElements.forEach(nodeElement => {
                nodeElement.style.display = '';
                
                // Restore labels based on zoom level
                const nodeLabel = nodeElement.querySelector('.node-label');
                if (nodeLabel) {
                    nodeLabel.style.display = currentZoomLevel >= thresholds.zoom.medium ? '' : 'none';
                }
            });
            
            // Restore all links based on zoom level
            const linkElements = svgContainer.querySelectorAll('.link');
            linkElements.forEach(linkElement => {
                linkElement.style.display = currentZoomLevel < thresholds.zoom.low ? 'none' : '';
                linkElement.style.opacity = '';
            });
        }
    }
    
    /**
     * Applies level-of-detail rendering based on zoom level
     * 
     * @param {number} zoomLevel - Current zoom level
     */
    function applyLevelOfDetail(zoomLevel) {
        if (!d3vizInstance) return;
        
        console.log('Applying level-of-detail rendering for zoom level:', zoomLevel);
        
        // Get the SVG container
        const svgContainer = d3vizInstance.getSvgContainer ? 
            d3vizInstance.getSvgContainer() : 
            container.querySelector('svg');
            
        if (!svgContainer) return;
        
        // Define detail levels
        let detailLevel;
        if (zoomLevel >= thresholds.zoom.high) {
            detailLevel = 'high';
        } else if (zoomLevel >= thresholds.zoom.medium) {
            detailLevel = 'medium';
        } else {
            detailLevel = 'low';
        }
        
        // Set the detail level as a data attribute on the container
        svgContainer.setAttribute('data-detail-level', detailLevel);
        
        // Apply detail-level-specific styles
        const nodeElements = svgContainer.querySelectorAll('.node');
        nodeElements.forEach(nodeElement => {
            // Base visibility on zoom level and importance
            switch (detailLevel) {
                case 'high':
                    // Full detail - show everything
                    nodeElement.style.display = '';
                    
                    // Show all labels
                    const nodeLabels = nodeElement.querySelectorAll('.node-label');
                    nodeLabels.forEach(label => label.style.display = '');
                    
                    // Show piece symbols at full size
                    const pieceSymbols = nodeElement.querySelectorAll('.chess-piece');
                    pieceSymbols.forEach(symbol => {
                        symbol.style.fontSize = ''; // Use default (full) size
                    });
                    
                    // Full-quality circles
                    const nodeCircles = nodeElement.querySelectorAll('circle');
                    nodeCircles.forEach(circle => {
                        circle.setAttribute('stroke-width', '1.5');
                    });
                    break;
                    
                case 'medium':
                    // Medium detail - show nodes but simplify
                    nodeElement.style.display = '';
                    
                    // Only show labels for pieces
                    const hasPiece = nodeElement.getAttribute('data-has-piece') === 'true';
                    const mediumLabels = nodeElement.querySelectorAll('.node-label');
                    mediumLabels.forEach(label => label.style.display = hasPiece ? '' : 'none');
                    
                    // Slightly smaller piece symbols
                    const mediumSymbols = nodeElement.querySelectorAll('.chess-piece');
                    mediumSymbols.forEach(symbol => {
                        const currentSize = symbol.style.fontSize;
                        const baseSize = currentSize ? parseFloat(currentSize) : 15;
                        symbol.style.fontSize = `${baseSize * 0.85}px`;
                    });
                    
                    // Simplified circles
                    const mediumCircles = nodeElement.querySelectorAll('circle');
                    mediumCircles.forEach(circle => {
                        circle.setAttribute('stroke-width', '1');
                    });
                    break;
                    
                case 'low':
                    // Low detail - hide labels, simplify rendering
                    
                    // Hide all labels
                    const lowLabels = nodeElement.querySelectorAll('.node-label');
                    lowLabels.forEach(label => label.style.display = 'none');
                    
                    // Minimal piece symbols
                    const lowSymbols = nodeElement.querySelectorAll('.chess-piece');
                    lowSymbols.forEach(symbol => {
                        const currentSize = symbol.style.fontSize;
                        const baseSize = currentSize ? parseFloat(currentSize) : 15;
                        symbol.style.fontSize = `${baseSize * 0.7}px`;
                    });
                    
                    // Simplest circles
                    const lowCircles = nodeElement.querySelectorAll('circle');
                    lowCircles.forEach(circle => {
                        circle.setAttribute('stroke-width', '0.5');
                    });
                    break;
            }
        });
        
        // Apply detail level to links
        const linkElements = svgContainer.querySelectorAll('.link');
        linkElements.forEach(linkElement => {
            switch (detailLevel) {
                case 'high':
                    // Full detail links
                    linkElement.style.display = '';
                    linkElement.style.opacity = '';
                    linkElement.style.strokeWidth = '';
                    break;
                    
                case 'medium':
                    // Medium detail links - thinner, slightly transparent
                    linkElement.style.display = '';
                    
                    // Get original stroke width and reduce it
                    const mediumStrokeWidth = linkElement.getAttribute('stroke-width') || '1';
                    const mediumNewWidth = Math.max(0.5, parseFloat(mediumStrokeWidth) * 0.7);
                    linkElement.style.strokeWidth = `${mediumNewWidth}px`;
                    
                    // Slightly transparent
                    linkElement.style.opacity = '0.7';
                    break;
                    
                case 'low':
                    // Low detail - only show most important links
                    // Try to get the weight from the data
                    const weight = parseFloat(linkElement.getAttribute('data-weight') || '1');
                    
                    // Only show links with significant weight when zoomed out
                    if (weight > 0.5) {
                        linkElement.style.display = '';
                        
                        // Very thin lines
                        linkElement.style.strokeWidth = '0.5px';
                        
                        // More transparent
                        linkElement.style.opacity = '0.4';
                    } else {
                        // Hide less important links
                        linkElement.style.display = 'none';
                    }
                    break;
            }
        });
        
        // Apply detail level to hulls (community outlines)
        const hullElements = svgContainer.querySelectorAll('.community-hull');
        hullElements.forEach(hullElement => {
            switch (detailLevel) {
                case 'high':
                    // Full detail hulls
                    hullElement.style.display = '';
                    hullElement.style.opacity = '';
                    hullElement.style.strokeWidth = '';
                    break;
                    
                case 'medium':
                    // Medium detail hulls - simplify
                    hullElement.style.display = '';
                    hullElement.style.opacity = '0.08'; // More transparent
                    hullElement.style.strokeWidth = '0.7px'; // Thinner stroke
                    break;
                    
                case 'low':
                    // Low detail - hide hulls completely
                    hullElement.style.display = 'none';
                    break;
            }
        });
    }
    
    /**
     * Optimizes the force simulation for large networks
     */
    function optimizeForceSimulation() {
        if (!simulationInstance) {
            if (d3vizInstance && d3vizInstance.getSimulation) {
                simulationInstance = d3vizInstance.getSimulation();
            }
            
            if (!simulationInstance) {
                console.warn('No simulation instance available for optimization');
                return;
            }
        }
        
        console.log('Optimizing force simulation for', currentNodeCount, 'nodes');
        
        // Determine graph size category
        let sizeCategory = 'small';
        if (currentNodeCount > 500) {
            sizeCategory = 'large';
        } else if (currentNodeCount > 100) {
            sizeCategory = 'medium';
        }
        
        // Adjust alpha decay rate based on graph size
        // Smaller value means slower cooling, allowing the simulation to reach more stable state
        if (typeof simulationInstance.alphaDecay === 'function') {
            simulationInstance.alphaDecay(thresholds.alphaDecay[sizeCategory]);
        }
        
        // Adjust velocity decay based on graph size
        // Higher value means more dampening, helping prevent chaotic movement
        if (typeof simulationInstance.velocityDecay === 'function') {
            simulationInstance.velocityDecay(thresholds.velocityDecay[sizeCategory]);
        }
        
        // For large graphs, we can also selectively deactivate secondary forces
        if (sizeCategory === 'large') {
            // Reduce collision detection complexity
            if (simulationInstance.force && typeof simulationInstance.force === 'function') {
                const collisionForce = simulationInstance.force('collision');
                if (collisionForce && typeof collisionForce.strength === 'function') {
                    // Get current strength
                    const currentStrength = collisionForce.strength()();
                    // Set reduced strength (capped at 0.5)
                    collisionForce.strength(Math.min(0.5, currentStrength));
                }
            }
            
            // Reduce complexity of custom forces for very large graphs
            const customForces = [
                'component-attraction', 'community-attraction', 
                'component-repulsion', 'community-repulsion',
                'bubble-force', 'bubble-radial', 'bubble-containment',
                'radial'
            ];
            
            // Simplify or disable some of the custom forces
            if (simulationInstance.force && typeof simulationInstance.force === 'function') {
                customForces.forEach(forceName => {
                    const customForce = simulationInstance.force(forceName);
                    if (customForce) {
                        // Either reduce strength or remove entirely
                        if (currentNodeCount > 1000) {
                            // For extreme cases, disable entirely
                            simulationInstance.force(forceName, null);
                        } else if (typeof customForce.strength === 'function') {
                            // For large but manageable cases, reduce intensity
                            // This assumes the force is using alpha in its calculations
                            const currentStrength = customForce.strength()();
                            customForce.strength(currentStrength * 0.7);
                        }
                    }
                });
            }
            
            // DON'T call iterations(1) since it's causing the error
            // in the D3.js version being used
        }
        
        // For any size graph, prioritize the most important forces
        if (simulationInstance.force && typeof simulationInstance.force === 'function') {
            const linkForce = simulationInstance.force('link');
            
            if (linkForce && typeof linkForce.strength === 'function') {
                // Links are important for visual understanding, keep them strong
                linkForce.strength(d => {
                    // Use original strength calculation but cap for performance
                    const weight = d.weight || 1;
                    return Math.min(0.7, 0.3 + weight * 0.2);
                });
            }
        }
        
        // Apply adaptive updates based on performance
        // If we detect the browser is struggling, we can further optimize
        if (isLowFps()) {
            console.log('Low FPS detected, applying emergency optimizations');
            
            // Emergency optimizations for low FPS
            if (simulationInstance.force && typeof simulationInstance.force === 'function') {
                const chargeForce = simulationInstance.force('charge');
                
                if (chargeForce) {
                    // Simplify charge calculation if the method exists
                    if (typeof chargeForce.strength === 'function') {
                        chargeForce.strength(d => -30); // Fixed value instead of complex calculation
                    }
                    
                    if (typeof chargeForce.theta === 'function') {
                        chargeForce.theta(0.9); // Increase approximation, less accurate but faster
                    }
                }
                
                // Apply additional optimizations
                const centerForce = simulationInstance.force('center');
                if (centerForce && typeof centerForce.strength === 'function') {
                    // Get current strength
                    const currentStrength = centerForce.strength()();
                    // Increase center force to speed up stabilization
                    centerForce.strength(currentStrength * 1.5);
                }
            }
            
            // Stop simulation earlier if alphaMin is a function
            if (typeof simulationInstance.alphaMin === 'function') {
                simulationInstance.alphaMin(0.01); // Higher alpha min means earlier stopping
            }
        }
    }
    
    /**
     * Monitors the zoom level for level-of-detail rendering
     */
    function initZoomObserver() {
        // This would ideally observe the D3 zoom event
        // For now, we'll provide a method for main.js to call when zoom changes
        
        // If d3viz exposes zoom events, we can listen to them
        if (d3vizInstance && d3vizInstance.onZoom) {
            d3vizInstance.onZoom(zoomLevel => {
                currentZoomLevel = zoomLevel;
                
                if (lodRenderingEnabled && isEnabled) {
                    applyLevelOfDetail(currentZoomLevel);
                }
            });
        }
    }
    
    /**
     * Updates the current zoom level
     * 
     * @param {number} zoomLevel - The current zoom level
     */
    api.updateZoomLevel = function(zoomLevel) {
        currentZoomLevel = zoomLevel;
        
        if (lodRenderingEnabled && isEnabled) {
            applyLevelOfDetail(currentZoomLevel);
        }
    };
    
    /**
     * Detects if the frame rate is low, indicating performance issues
     * 
     * @returns {boolean} - Whether the frame rate is low
     */
    function isLowFps() {
        // This is a simple approximation for now
        // In a real implementation, you would track frame times
        
        // For now, we'll use a simpler heuristic based on node count
        return currentNodeCount > 1000 || currentLinkCount > 3000;
    }
    
    /**
     * Resets all optimizations, reverting to normal rendering
     */
    function resetOptimizations() {
        if (!d3vizInstance) return;
        
        console.log('Resetting all optimizations');
        
        // Get the SVG container
        const svgContainer = d3vizInstance.getSvgContainer ? 
            d3vizInstance.getSvgContainer() : 
            container.querySelector('svg');
            
        if (!svgContainer) return;
        
        // Reset all nodes
        const nodeElements = svgContainer.querySelectorAll('.node');
        nodeElements.forEach(nodeElement => {
            nodeElement.style.display = '';
            
            // Reset labels
            const nodeLabels = nodeElement.querySelectorAll('.node-label');
            nodeLabels.forEach(label => label.style.display = '');
            
            // Reset piece symbols
            const pieceSymbols = nodeElement.querySelectorAll('.chess-piece');
            pieceSymbols.forEach(symbol => {
                symbol.style.fontSize = ''; // Use default size
            });
            
            // Reset circles
            const nodeCircles = nodeElement.querySelectorAll('circle');
            nodeCircles.forEach(circle => {
                circle.setAttribute('stroke-width', '1.5');
            });
        });
        
        // Reset all links
        const linkElements = svgContainer.querySelectorAll('.link');
        linkElements.forEach(linkElement => {
            linkElement.style.display = '';
            linkElement.style.opacity = '';
            linkElement.style.strokeWidth = '';
        });
        
        // Reset all hulls
        const hullElements = svgContainer.querySelectorAll('.community-hull');
        hullElements.forEach(hullElement => {
            hullElement.style.display = '';
            hullElement.style.opacity = '';
            hullElement.style.strokeWidth = '';
        });
        
        // Reset force simulation to D3 defaults
        if (simulationInstance) {
            // Only call methods that exist to avoid errors
            if (typeof simulationInstance.alphaDecay === 'function') {
                simulationInstance.alphaDecay(0.0228);    // D3 default
            }
            
            if (typeof simulationInstance.velocityDecay === 'function') {
                simulationInstance.velocityDecay(0.4);    // D3 default
            }
            
            // DON'T call iterations() since it doesn't exist in this D3 version
            
            if (typeof simulationInstance.alphaMin === 'function') {
                simulationInstance.alphaMin(0.001);       // D3 default
            }
        }
    }
    
    // Make the API available globally
    window.PerformanceOptimizer = api;
    
    return api;
})();