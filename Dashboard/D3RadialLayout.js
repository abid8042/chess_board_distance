/**
 * D3RadialLayout.js
 * Force-based radial layout implementation for chess influence networks.
 * Embraces the philosophy of "using and abusing" the force simulation.
 */

const D3RadialLayout = (function() {
    // Public API
    const api = {};
    
    /**
     * Applies radial layout to the simulation by adding custom forces
     * Instead of explicitly positioning nodes, we leverage force dynamics
     * 
     * @param {Object} simulation - The D3 force simulation
     * @param {Array} nodes - Array of node objects
     * @param {number} width - The width of the container
     * @param {number} height - The height of the container
     */
    api.applyRadialLayout = function(simulation, nodes, width, height) {
        if (!simulation || !nodes || !nodes.length) return;
        
        // Filter out inactive nodes
        const activeNodes = nodes.filter(node => !node.status || node.status === 'active');
        const inactiveNodes = nodes.filter(node => node.status === 'inactive');
        
        // Add radial force to position active nodes in communities
        setupRadialForces(simulation, activeNodes, width, height);
        
        // Add wall forces for inactive nodes
        setupWallForces(simulation, inactiveNodes, width, height);
        
        // Reduce default forces
        if (simulation.force('charge')) {
            simulation.force('charge').strength(d => {
                return d.status === 'inactive' ? -20 : -120;
            });
        }
        
        if (simulation.force('center')) {
            simulation.force('center').strength(0.03);
        }
    };
    
    /**
     * Setup radial forces to position nodes in a circle by community
     * 
     * @param {Object} simulation - The D3 force simulation
     * @param {Array} nodes - Array of active node objects
     * @param {number} width - The width of the container
     * @param {number} height - The height of the container
     */
    function setupRadialForces(simulation, nodes, width, height) {
        // Group nodes by community
        const communities = {};
        nodes.forEach(node => {
            const communityId = node.community_id || 0;
            if (!communities[communityId]) {
                communities[communityId] = [];
            }
            communities[communityId].push(node);
        });
        
        let communityIds = Object.keys(communities);
        
        // Get all links from the simulation to use for optimization
        const links = simulation.force('link') ? simulation.force('link').links() : [];
        
        // Use LayoutSorter if available to optimize community order
        // Sort communities by size (larger ones first) by default
        if (window.LayoutSorter) {
            // Convert to array of community objects for sorting
            const communityObjects = communityIds.map(id => ({
                id: id,
                nodes: communities[id]
            }));
            
            // First sort by size (larger communities first)
            const sortedCommunities = window.LayoutSorter.sortComponents(communityObjects, 'size', true);
            
            // Then optimize order if we have links
            const optimizedCommunities = links.length ? 
                window.LayoutSorter.optimizeComponentOrder(sortedCommunities, links) : 
                sortedCommunities;
            
            // Extract IDs in optimized order
            communityIds = optimizedCommunities.map(c => c.id);
        }
        
        // Add custom radial force 
        simulation.force('radial', function(alpha) {
            const strength = alpha * 0.8; // Strong force for clear circle formation
            const baseRadius = Math.min(width, height) * 0.35; // Radius of community circle
            
            // For each community, position nodes in a circle around a point on the radial
            communityIds.forEach((communityId, communityIndex) => {
                const communityNodes = communities[communityId];
                if (!communityNodes.length) return;
                
                // Calculate community position on the circle
                const angle = (communityIndex * 2 * Math.PI) / communityIds.length;
                const communityX = width / 2 + baseRadius * Math.cos(angle);
                const communityY = height / 2 + baseRadius * Math.sin(angle);
                
                // Apply community center force
                const communityStrength = strength * 0.2;
                communityNodes.forEach(node => {
                    node.vx += (communityX - node.x) * communityStrength;
                    node.vy += (communityY - node.y) * communityStrength;
                });
                
                // Sort nodes within community if LayoutSorter is available
                let sortedNodes = communityNodes;
                if (window.LayoutSorter) {
                    sortedNodes = window.LayoutSorter.sortNodes(communityNodes, 'in-degree', true);
                }
                
                // Position nodes in a smaller circle around community center
                sortedNodes.forEach((node, nodeIndex) => {
                    const nodeAngle = angle + ((nodeIndex * 2 * Math.PI) / sortedNodes.length) * 0.5;
                    const nodeRadius = baseRadius * 0.2;
                    
                    const targetX = communityX + nodeRadius * Math.cos(nodeAngle);
                    const targetY = communityY + nodeRadius * Math.sin(nodeAngle);
                    
                    // Apply force toward target position, stronger than the community force
                    const nodeStrength = strength * 0.8;
                    node.vx += (targetX - node.x) * nodeStrength;
                    node.vy += (targetY - node.y) * nodeStrength;
                });
            });
        });
        
        // Add inter-community repulsion to maintain spacing
        simulation.force('community-repulsion', function(alpha) {
            const repulsion = alpha * 1.5; // Strong repulsion
            
            for (let i = 0; i < communityIds.length; i++) {
                for (let j = i + 1; j < communityIds.length; j++) {
                    // Get community centers (as average positions)
                    const communityA = communities[communityIds[i]];
                    const communityB = communities[communityIds[j]];
                    
                    if (!communityA.length || !communityB.length) continue;
                    
                    // Calculate community centers
                    let centerAx = 0, centerAy = 0, centerBx = 0, centerBy = 0;
                    
                    communityA.forEach(node => {
                        centerAx += node.x || 0;
                        centerAy += node.y || 0;
                    });
                    centerAx /= communityA.length;
                    centerAy /= communityA.length;
                    
                    communityB.forEach(node => {
                        centerBx += node.x || 0;
                        centerBy += node.y || 0;
                    });
                    centerBx /= communityB.length;
                    centerBy /= communityB.length;
                    
                    // Calculate repulsion
                    const dx = centerAx - centerBx;
                    const dy = centerAy - centerBy;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance === 0) continue;
                    
                    // Apply repulsion to all nodes in communities
                    const force = repulsion / Math.max(10, distance);
                    const fx = dx / distance * force;
                    const fy = dy / distance * force;
                    
                    communityA.forEach(node => {
                        node.vx += fx;
                        node.vy += fy;
                    });
                    
                    communityB.forEach(node => {
                        node.vx -= fx;
                        node.vy -= fy;
                    });
                }
            }
        });
        
        // Add intra-community node repulsion to prevent overlapping
        simulation.force('node-repulsion', function(alpha) {
            const repulsion = alpha * 0.3;
            
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const nodeA = nodes[i];
                    const nodeB = nodes[j];
                    
                    // Only apply repulsion between nodes in the same community
                    if (nodeA.community_id !== nodeB.community_id) continue;
                    
                    const dx = nodeA.x - nodeB.x;
                    const dy = nodeA.y - nodeB.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance === 0) continue;
                    
                    // Repel nodes that are too close to each other
                    const minDistance = 15; // Minimum desired distance
                    if (distance < minDistance) {
                        const force = repulsion * (1 - distance / minDistance);
                        const fx = dx / distance * force;
                        const fy = dy / distance * force;
                        
                        nodeA.vx += fx;
                        nodeA.vy += fy;
                        nodeB.vx -= fx;
                        nodeB.vy -= fy;
                    }
                }
            }
        });
    }
    
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
     * Positions nodes along a radial arrangement
     * Used for initializing node positions
     * 
     * @param {Array} nodes - Array of node objects
     * @param {Object} centers - Object mapping keys to center positions
     * @param {Function} keyFn - Function to determine the key for a node
     * @param {number} radius - Base radius for the layout
     */
    api.positionNodesRadially = function(nodes, centers, keyFn, radius) {
        if (!nodes || !centers || !keyFn) return;
        
        // Group nodes by key
        const groups = {};
        
        nodes.forEach(node => {
            if (!node) return;
            
            const key = keyFn(node);
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(node);
        });
        
        // Use LayoutSorter to sort nodes within each group if available
        Object.keys(groups).forEach(key => {
            if (window.LayoutSorter) {
                groups[key] = window.LayoutSorter.sortNodes(groups[key], 'in-degree', true);
            }
        });
        
        // Arrange nodes in concentric circles around their centers
        Object.keys(groups).forEach(key => {
            const center = centers[key];
            if (!center) return;
            
            const nodeGroup = groups[key];
            const nodeCount = nodeGroup.length;
            
            nodeGroup.forEach((node, i) => {
                // Arrange in a spiral pattern
                const angle = (i * 2 * Math.PI) / nodeCount;
                const r = radius * (0.2 + 0.8 * (i / Math.max(nodeCount - 1, 1)));
                
                // Initialize position if not set
                if (!node.x || !node.y) {
                    node.x = center.x + r * Math.cos(angle);
                    node.y = center.y + r * Math.sin(angle);
                }
            });
        });
    };
    
    /**
     * Factory function to create a radial placement utility
     * Provides a more declarative way to position nodes in a circular layout
     * 
     * @returns {Object} - Radial placement utility
     */
    api.createRadialPlacement = function() {
        return function() {
            let centerX = 0;
            let centerY = 0;
            let radius = 100;
            let increment = 20;
            let keys = [];
            let values = {};
            
            // create a new placement or reset the current one
            const placement = {};
            
            placement.center = function(xy) {
                if (!xy) {
                    return { x: centerX, y: centerY };
                }
                centerX = xy.x;
                centerY = xy.y;
                return placement;
            };
            
            placement.radius = function(r) {
                if (!r) {
                    return radius;
                }
                radius = r;
                return placement;
            };
            
            placement.increment = function(inc) {
                if (!inc) {
                    return increment;
                }
                increment = inc;
                return placement;
            };
            
            placement.keys = function(ks) {
                if (!ks) {
                    return keys;
                }
                
                // If LayoutSorter is available, optimize key order
                if (window.LayoutSorter && typeof ks[0] === 'object') {
                    ks = window.LayoutSorter.sortComponents(ks, 'size', true).map(c => c.id);
                }
                
                keys = ks;
                return placement;
            };
            
            placement.place = function(key) {
                if (values[key]) {
                    return values[key];
                }
                
                const count = keys.length;
                const angle = 2 * Math.PI * (keys.indexOf(key) / count);
                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);
                
                values[key] = { x: x, y: y, angle: angle };
                return values[key];
            };
            
            return placement;
        };
    };
    
    // Make the API available globally
    window.D3RadialLayout = api;
    
    return api;
})();