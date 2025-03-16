/**
 * ForceLayoutManager.js
 * Manages force-based layouts for chess influence networks.
 * Provides consistent force-driven behavior across all layout types.
 */

const ForceLayoutManager = (function() {
    // Public API
    const api = {};
    
    /**
     * Applies the basic force layout
     * 
     * @param {Object} simulation - The D3 force simulation
     * @param {Array} nodes - Array of node objects
     * @param {number} width - The width of the container
     * @param {number} height - The height of the container
     * @param {Object} options - Visualization options
     */
    api.applyForceLayout = function(simulation, nodes, width, height, options) {
        if (!simulation || !nodes || !nodes.length) return;
        
        // Filter out inactive nodes
        const activeNodes = nodes.filter(node => !node.status || node.status === 'active');
        const inactiveNodes = nodes.filter(node => node.status === 'inactive');
        
        // Setup active nodes with enhanced forces
        setupEnhancedForceLayout(simulation, activeNodes, width, height, options);
        
        // Add wall forces for inactive nodes
        setupWallForces(simulation, inactiveNodes, width, height);
        
        // Component and community-based enhancement forces
        if (options.componentAttraction > 0) {
            setupComponentForces(simulation, activeNodes, options.componentAttraction, width, height);
        }
        
        if (options.communityAttraction > 0) {
            setupCommunityForces(simulation, activeNodes, options.communityAttraction, width, height);
        }
        
        // Apply node sorting if LayoutSorter is available
        if (window.LayoutSorter && options.sortNodesBy !== 'none') {
            applySorting(simulation, activeNodes, options.sortNodesBy, width, height);
        }
    };
    
    /**
     * Applies sorting to the nodes based on specified criteria
     * 
     * @param {Object} simulation - The D3 force simulation
     * @param {Array} nodes - Array of node objects
     * @param {string} sortBy - The sorting criteria
     * @param {number} width - The width of the container
     * @param {number} height - The height of the container
     */
    function applySorting(simulation, nodes, sortBy, width, height) {
        if (!window.LayoutSorter || !nodes.length) return;
        
        // Group nodes by component
        const components = {};
        nodes.forEach(node => {
            const componentId = node.component_id || 0;
            if (!components[componentId]) {
                components[componentId] = [];
            }
            components[componentId].push(node);
        });
        
        // Get all links from the simulation
        const links = simulation.force('link') ? simulation.force('link').links() : [];
        
        // Optimize component positions
        if (Object.keys(components).length > 1 && links.length) {
            // Sort components first
            const componentObjects = Object.keys(components).map(id => ({
                id: id,
                nodes: components[id],
                edges: links.filter(link => {
                    const sourceId = typeof link.source === 'object' ? 
                        (link.source.component_id || 0) : 0;
                    const targetId = typeof link.target === 'object' ? 
                        (link.target.component_id || 0) : 0;
                    return sourceId === parseInt(id) || targetId === parseInt(id);
                })
            }));
            
            // Use LayoutSorter to optimize positioning
            const sortedComponents = window.LayoutSorter.optimizeComponentOrder(
                componentObjects, 
                links
            );
            
            // Apply attractive forces to keep components separated by their sort order
            simulation.force('component-sorting', function(alpha) {
                const sortStrength = alpha * 0.3;
                
                sortedComponents.forEach((component, i) => {
                    const componentId = component.id;
                    const componentNodes = components[componentId];
                    if (!componentNodes.length) return;
                    
                    // Calculate angle for this component
                    const angle = (i * 2 * Math.PI) / sortedComponents.length;
                    const radius = Math.min(width, height) * 0.35;
                    
                    // Calculate target position
                    const targetX = width / 2 + radius * Math.cos(angle);
                    const targetY = height / 2 + radius * Math.sin(angle);
                    
                    // Apply gentle force toward target position
                    componentNodes.forEach(node => {
                        node.vx += (targetX - node.x) * sortStrength * 0.1;
                        node.vy += (targetY - node.y) * sortStrength * 0.1;
                    });
                });
            });
        }
        
        // Sort nodes within each component
        Object.keys(components).forEach(componentId => {
            if (!components[componentId].length) return;
            
            // Group nodes by community within component
            const communities = {};
            components[componentId].forEach(node => {
                const communityId = node.community_id || 0;
                if (!communities[communityId]) {
                    communities[communityId] = [];
                }
                communities[communityId].push(node);
            });
            
            // Sort nodes within each community
            Object.keys(communities).forEach(communityId => {
                const communityNodes = communities[communityId];
                if (!communityNodes.length) return;
                
                // Sort nodes by the specified criteria
                const sortedNodes = window.LayoutSorter.sortNodes(communityNodes, sortBy, true);
                
                // Apply sorting within community - this helps with better distribution
                // but doesn't enforce absolute positioning
                simulation.force(`community-${componentId}-${communityId}-sorting`, function(alpha) {
                    if (alpha < 0.1) return; // Only apply at higher alpha values
                    
                    const sortStrength = alpha * 0.1;
                    
                    sortedNodes.forEach((node, i) => {
                        // Apply slight sorting force based on index
                        // Lower indices (higher values if descending) are pulled toward the center
                        const centerX = width / 2;
                        const centerY = height / 2;
                        const distanceFactor = 1 - (i / sortedNodes.length);
                        
                        node.vx += (centerX - node.x) * sortStrength * distanceFactor;
                        node.vy += (centerY - node.y) * sortStrength * distanceFactor;
                    });
                });
            });
        });
    }
    
    /**
     * Setup forces for component-based organization
     * 
     * @param {Object} simulation - The D3 force simulation
     * @param {Array} nodes - Array of node objects
     * @param {number} strength - The strength of component attraction
     * @param {number} width - The width of the container
     * @param {number} height - The height of the container
     */
    function setupComponentForces(simulation, nodes, strength, width, height) {
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
        
        // Don't apply forces if there's only one component
        if (componentIds.length < 2) return;
        
        // Use LayoutSorter if available to optimize component order
        if (window.LayoutSorter) {
            // Convert to component objects for sorting
            const componentObjects = componentIds.map(id => ({
                id: id,
                nodes: components[id]
            }));
            
            // Get all links from the simulation
            const links = simulation.force('link') ? simulation.force('link').links() : [];
            
            if (links.length) {
                // Optimize component order to minimize link crossings
                const optimizedComponents = window.LayoutSorter.optimizeComponentOrder(
                    componentObjects, 
                    links
                );
                
                // Extract optimized IDs
                componentIds.length = 0;
                optimizedComponents.forEach(c => componentIds.push(c.id));
            }
        }
        
        // Add component attraction force
        simulation.force('component-attraction', function(alpha) {
            // Scale based on alpha to smooth transitions
            const componentStrength = alpha * strength;
            
            // For each component, attract nodes to their component's center of mass
            componentIds.forEach(componentId => {
                const componentNodes = components[componentId];
                if (componentNodes.length < 2) return;
                
                // Calculate center of mass for this component
                let centerX = 0, centerY = 0;
                componentNodes.forEach(node => {
                    centerX += node.x || 0;
                    centerY += node.y || 0;
                });
                centerX /= componentNodes.length;
                centerY /= componentNodes.length;
                
                // Apply attraction to center
                componentNodes.forEach(node => {
                    node.vx += (centerX - node.x) * componentStrength;
                    node.vy += (centerY - node.y) * componentStrength;
                });
            });
        });
        
        // Add inter-component repulsion
        simulation.force('component-repulsion', function(alpha) {
            const repulsionStrength = alpha * strength * 2;
            
            // Calculate component centers
            const componentCenters = {};
            componentIds.forEach(componentId => {
                const componentNodes = components[componentId];
                if (!componentNodes.length) return;
                
                let centerX = 0, centerY = 0;
                componentNodes.forEach(node => {
                    centerX += node.x || 0;
                    centerY += node.y || 0;
                });
                centerX /= componentNodes.length;
                centerY /= componentNodes.length;
                
                componentCenters[componentId] = { x: centerX, y: centerY };
            });
            
            // Apply repulsion between component centers
            for (let i = 0; i < componentIds.length; i++) {
                for (let j = i + 1; j < componentIds.length; j++) {
                    const centerA = componentCenters[componentIds[i]];
                    const centerB = componentCenters[componentIds[j]];
                    
                    if (!centerA || !centerB) continue;
                    
                    const dx = centerA.x - centerB.x;
                    const dy = centerA.y - centerB.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance === 0) continue;
                    
                    // Calculate repulsion force - stronger when components are close
                    const force = repulsionStrength / Math.max(distance, 10);
                    const fx = dx / distance * force;
                    const fy = dy / distance * force;
                    
                    // Apply to all nodes in the components
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
        });
    }
    
    /**
     * Setup forces for community-based organization
     * 
     * @param {Object} simulation - The D3 force simulation
     * @param {Array} nodes - Array of node objects
     * @param {number} strength - The strength of community attraction
     * @param {number} width - The width of the container  
     * @param {number} height - The height of the container
     */
    function setupCommunityForces(simulation, nodes, strength, width, height) {
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
        
        // Don't apply forces if there's only one community
        if (communityIds.length < 2) return;
        
        // Use LayoutSorter if available to optimize community order
        if (window.LayoutSorter) {
            // Convert to community objects for sorting
            const communityObjects = communityIds.map(id => ({
                id: id,
                nodes: communities[id]
            }));
            
            // Get all links from the simulation
            const links = simulation.force('link') ? simulation.force('link').links() : [];
            
            if (links.length) {
                // Optimize community order to minimize link crossings
                const optimizedCommunities = window.LayoutSorter.optimizeComponentOrder(
                    communityObjects, 
                    links
                );
                
                // Extract optimized IDs
                communityIds.length = 0;
                optimizedCommunities.forEach(c => communityIds.push(c.id));
            }
        }
        
        // Add community attraction force
        simulation.force('community-attraction', function(alpha) {
            // Scale based on alpha to smooth transitions
            const communityStrength = alpha * strength;
            
            // For each community, attract nodes to their community's center of mass
            communityIds.forEach(communityId => {
                const communityNodes = communities[communityId];
                if (communityNodes.length < 2) return;
                
                // Calculate center of mass for this community
                let centerX = 0, centerY = 0;
                communityNodes.forEach(node => {
                    centerX += node.x || 0;
                    centerY += node.y || 0;
                });
                centerX /= communityNodes.length;
                centerY /= communityNodes.length;
                
                // Apply attraction to center
                communityNodes.forEach(node => {
                    node.vx += (centerX - node.x) * communityStrength;
                    node.vy += (centerY - node.y) * communityStrength;
                });
            });
        });
        
        // Add inter-community repulsion (weaker than component repulsion)
        simulation.force('community-repulsion', function(alpha) {
            const repulsionStrength = alpha * strength;
            
            // Calculate community centers
            const communityCenters = {};
            communityIds.forEach(communityId => {
                const communityNodes = communities[communityId];
                if (!communityNodes.length) return;
                
                let centerX = 0, centerY = 0;
                communityNodes.forEach(node => {
                    centerX += node.x || 0;
                    centerY += node.y || 0;
                });
                centerX /= communityNodes.length;
                centerY /= communityNodes.length;
                
                communityCenters[communityId] = { x: centerX, y: centerY };
            });
            
            // Apply repulsion between community centers
            for (let i = 0; i < communityIds.length; i++) {
                for (let j = i + 1; j < communityIds.length; j++) {
                    // Only apply repulsion between communities in the same component
                    const communityNodesA = communities[communityIds[i]];
                    const communityNodesB = communities[communityIds[j]];
                    
                    // Check if they're in the same component
                    const componentA = communityNodesA.length > 0 ? 
                        communityNodesA[0].component_id : null;
                    const componentB = communityNodesB.length > 0 ? 
                        communityNodesB[0].component_id : null;
                    
                    // Skip if different components or component info missing
                    if (!componentA || !componentB || componentA !== componentB) continue;
                    
                    const centerA = communityCenters[communityIds[i]];
                    const centerB = communityCenters[communityIds[j]];
                    
                    if (!centerA || !centerB) continue;
                    
                    const dx = centerA.x - centerB.x;
                    const dy = centerA.y - centerB.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance === 0) continue;
                    
                    // Apply repulsion
                    const force = repulsionStrength / Math.max(distance, 10);
                    const fx = dx / distance * force;
                    const fy = dy / distance * force;
                    
                    communities[communityIds[i]].forEach(node => {
                        node.vx += fx;
                        node.vy += fy;
                    });
                    
                    communities[communityIds[j]].forEach(node => {
                        node.vx -= fx;
                        node.vy -= fy;
                    });
                }
            }
        });
    }

    // Rest of the file remains the same...
    
    /**
     * Enhance the basic force layout with better parameters and behaviors
     * 
     * @param {Object} simulation - The D3 force simulation
     * @param {Array} activeNodes - Array of active node objects
     * @param {number} width - The width of the container
     * @param {number} height - The height of the container
     * @param {Object} options - Visualization options
     */
    function setupEnhancedForceLayout(simulation, activeNodes, width, height, options) {
        // Adjust charge forces to create more space between nodes
        if (simulation.force('charge')) {
            simulation.force('charge')
                .strength(function(d) {
                    // Scale charge by node size for better spacing
                    const nodeSize = d.radius || getNodeRadius(d) || 10;
                    return options.forceParams.charge * Math.pow(nodeSize / 10, 1.2);
                })
                .distanceMax(width / 3); // Limit the distance of charge effect
        }
        
        // Apply a stronger center force to keep nodes from drifting
        if (simulation.force('center')) {
            simulation.force('center')
                .strength(options.forceParams.gravity)
                .x(width / 2)
                .y(height / 2);
        }
        
        // Apply a boundary force to keep nodes within the visible area
        simulation.force('boundary', function(alpha) {
            const strength = alpha * 0.3;
            const padding = 20;
            
            activeNodes.forEach(node => {
                // Keep nodes within horizontal bounds
                if (node.x < padding) {
                    node.vx += (padding - node.x) * strength;
                } else if (node.x > width - padding) {
                    node.vx += (width - padding - node.x) * strength;
                }
                
                // Keep nodes within vertical bounds
                if (node.y < padding) {
                    node.vy += (padding - node.y) * strength;
                } else if (node.y > height - padding) {
                    node.vy += (height - padding - node.y) * strength;
                }
            });
        });
        
        // Enhanced link forces for better visualization
        if (simulation.force('link')) {
            simulation.force('link')
                .distance(function(d) {
                    // Base link distance
                    const baseDistance = options.forceParams.linkDistance;
                    
                    // Make distance dependent on node sizes
                    const sourceSize = d.source.radius || getNodeRadius(d.source) || 10;
                    const targetSize = d.target.radius || getNodeRadius(d.target) || 10;
                    
                    // Adjust based on link weight and node sizes
                    return baseDistance * (1 + (sourceSize + targetSize) / 30) * 
                           (d.weight ? 1 / Math.sqrt(d.weight + 0.1) : 1);
                })
                .strength(function(d) {
                    // Stronger links for higher weights
                    return d.weight ? 0.2 + Math.min(0.6, d.weight * 0.3) : 0.3;
                });
        }
        
        // Apply collision detection with proper radius
        if (simulation.force('collision')) {
            simulation.force('collision')
                .radius(function(d) { 
                    return (d.radius || getNodeRadius(d) || 10) + 2; 
                })
                .strength(options.forceParams.collisionStrength);
        }
        
        // Add a gentle randomizing force to prevent exact overlaps
        simulation.force('jitter', function(alpha) {
            if (alpha < 0.1) return; // Only apply jitter at higher alpha values
            
            const jitterStrength = alpha * 0.1;
            activeNodes.forEach(node => {
                node.vx += (Math.random() - 0.5) * jitterStrength;
                node.vy += (Math.random() - 0.5) * jitterStrength;
            });
        });
    }
    
    // The remaining functions stay the same

    /**
     * Setup forces to keep inactive nodes along walls (top and bottom edges)
     * 
     * @param {Object} simulation - The D3 force simulation
     * @param {Array} inactiveNodes - Array of inactive node objects
     * @param {number} width - The width of the container
     * @param {number} height - The height of the container
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
     * Helper function to get node radius if not directly available
     * 
     * @param {Object} node - The node object
     * @returns {number} - The node radius
     */
    function getNodeRadius(node) {
        if (!node) return 10;
        
        if (node.radius) return node.radius;
        
        // Inactive nodes are slightly smaller
        const statusFactor = node.status === 'inactive' ? 0.8 : 1.0;
        const minBaseRadius = 15;
        
        // Estimate based on common sizing methods
        if (node.in_degree_centrality !== undefined) {
            return minBaseRadius * statusFactor * (0.9 + node.in_degree_centrality * 2.5);
        }
        
        if (node.out_degree_centrality !== undefined) {
            return minBaseRadius * statusFactor * (0.9 + node.out_degree_centrality * 2.5);
        }
        
        return minBaseRadius * statusFactor;
    }
    
    /**
     * Apply a grid layout, but using forces instead of explicit positions
     * Useful as an alternative visualization or for comparison
     * 
     * @param {Object} simulation - The D3 force simulation
     * @param {Array} nodes - Array of node objects
     * @param {number} width - The width of the container
     * @param {number} height - The height of the container
     * @param {Object} options - The grid options
     */
    api.applyForceGridLayout = function(simulation, nodes, width, height, options) {
        if (!simulation || !nodes || !nodes.length) return;
        
        const activeNodes = nodes.filter(node => !node.status || node.status === 'active');
        const inactiveNodes = nodes.filter(node => node.status === 'inactive');
        
        // Apply sorting if LayoutSorter is available
        let sortedNodes = activeNodes;
        if (window.LayoutSorter && options && options.sortNodesBy) {
            sortedNodes = window.LayoutSorter.sortNodes(activeNodes, options.sortNodesBy, true);
        }
        
        // Setup grid force
        simulation.force('grid', function(alpha) {
            const strength = alpha * 0.7;
            
            // Get grid dimensions
            const cols = Math.ceil(Math.sqrt(sortedNodes.length));
            const rows = Math.ceil(sortedNodes.length / cols);
            
            const cellWidth = (width - 40) / cols;
            const cellHeight = (height - 40) / rows;
            
            // Position nodes in a grid using forces
            sortedNodes.forEach((node, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                
                const targetX = 20 + cellWidth * (col + 0.5);
                const targetY = 20 + cellHeight * (row + 0.5);
                
                // Apply force toward target position
                node.vx += (targetX - node.x) * strength;
                node.vy += (targetY - node.y) * strength;
            });
        });
        
        // Add wall forces for inactive nodes
        setupWallForces(simulation, inactiveNodes, width, height);
        
        // Reduce other forces
        if (simulation.force('charge')) {
            simulation.force('charge').strength(-10);
        }
        
        if (simulation.force('center')) {
            simulation.force('center').strength(0);
        }
    };
    
    // Make the API available globally
    window.ForceLayoutManager = api;
    
    return api;
})();