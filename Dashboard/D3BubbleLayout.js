/**
 * D3BubbleLayout.js
 * Force-based bubble layouts for chess influence networks.
 * Implements bubble+force and bubble+radial layouts using pure force dynamics.
 */

const D3BubbleLayout = (function() {
    // Public API
    const api = {};
    
    /**
     * Applies bubble+force layout to the simulation
     * Groups nodes by component in bubbles, using forces to maintain boundaries
     * 
     * @param {Object} simulation - The D3 force simulation
     * @param {Array} nodes - Array of node objects
     * @param {number} width - The width of the container
     * @param {number} height - The height of the container
     */
    api.applyBubbleForceLayout = function(simulation, nodes, width, height) {
        if (!simulation || !nodes || !nodes.length) return;
        
        // Filter out inactive nodes
        const activeNodes = nodes.filter(node => !node.status || node.status === 'active');
        const inactiveNodes = nodes.filter(node => node.status === 'inactive');
        
        // Add bubble forces to organize by component
        setupBubbleForces(simulation, activeNodes, width, height);
        
        // Add wall forces for inactive nodes
        setupWallForces(simulation, inactiveNodes, width, height);
        
        // Reduce center force but keep some to prevent bubbles from drifting too far
        if (simulation.force('center')) {
            simulation.force('center').strength(0.03);
        }
        
        // Adjust charge force for better bubble layout
        if (simulation.force('charge')) {
            simulation.force('charge').strength(d => {
                if (d.status === 'inactive') return -20; // Weak repulsion for inactive nodes
                
                // Stronger repulsion for active nodes based on their size
                const nodeSize = d.radius || 10;
                return -30 - nodeSize * 2;
            });
        }
        
        // Set collision force to keep nodes from overlapping
        if (simulation.force('collision')) {
            simulation.force('collision').radius(d => (d.radius || 10) + 2);
        }
    };
    
    /**
     * Applies bubble+radial layout to the simulation
     * Nodes are grouped by component in bubbles, with community-based organization inside
     * 
     * @param {Object} simulation - The D3 force simulation
     * @param {Array} nodes - Array of node objects
     * @param {number} width - The width of the container
     * @param {number} height - The height of the container
     */
    api.applyBubbleRadialLayout = function(simulation, nodes, width, height) {
        if (!simulation || !nodes || !nodes.length) return;
        
        // Filter out inactive nodes
        const activeNodes = nodes.filter(node => !node.status || node.status === 'active');
        const inactiveNodes = nodes.filter(node => node.status === 'inactive');
        
        // Add bubble+radial forces
        setupBubbleRadialForces(simulation, activeNodes, width, height);
        
        // Add wall forces for inactive nodes
        setupWallForces(simulation, inactiveNodes, width, height);
        
        // Turn off the center force
        if (simulation.force('center')) {
            simulation.force('center').strength(0);
        }
        
        // Adjust charge force for better bubble layout
        if (simulation.force('charge')) {
            simulation.force('charge').strength(d => {
                if (d.status === 'inactive') return -20; // Weak repulsion for inactive nodes
                
                // Weaker repulsion for active nodes in bubble+radial (positions are more controlled)
                const nodeSize = d.radius || 10;
                return -15 - nodeSize;
            });
        }
    };
    
    /**
     * Setup forces to create component bubbles with force layout inside
     * 
     * @param {Object} simulation - The D3 force simulation
     * @param {Array} nodes - Array of active node objects
     * @param {number} width - The width of the container
     * @param {number} height - The height of the container
     */
    function setupBubbleForces(simulation, nodes, width, height) {
        // Group nodes by component
        const components = {};
        nodes.forEach(node => {
            const componentId = node.component_id || 0;
            if (!components[componentId]) {
                components[componentId] = [];
            }
            components[componentId].push(node);
        });
        
        // Get all links from the simulation to use for optimization
        const links = simulation.force('link') ? simulation.force('link').links() : [];
        
        let componentIds = Object.keys(components);
        
        // Use LayoutSorter if available to organize components
        if (window.LayoutSorter) {
            // Convert to component objects for sorting
            const componentObjects = componentIds.map(id => ({
                id: id,
                nodes: components[id],
                edges: []
            }));
            
            // First sort by size
            let sortedComponents = window.LayoutSorter.sortComponents(componentObjects, 'size', true);
            
            // Then optimize positioning if we have links
            if (links.length) {
                sortedComponents = window.LayoutSorter.optimizeComponentOrder(sortedComponents, links);
            }
            
            // Extract ids in optimized order
            componentIds = sortedComponents.map(c => c.id);
        }
        
        // Add component containment force
        simulation.force('bubble-containment', function(alpha) {
            // Calculate dynamic component centers
            const componentCenters = {};
            const numComponents = componentIds.length;
            
            // Calculate optimal component positions
            // Small number of components get special treatment
            if (numComponents <= 3) {
                if (numComponents === 1) {
                    // Single component centered
                    componentCenters[componentIds[0]] = { x: width/2, y: height/2 };
                } else if (numComponents === 2) {
                    // Two components side by side
                    componentCenters[componentIds[0]] = { x: width * 0.35, y: height/2 };
                    componentCenters[componentIds[1]] = { x: width * 0.65, y: height/2 };
                } else { // numComponents === 3
                    // Three components in triangle
                    componentCenters[componentIds[0]] = { x: width/2, y: height * 0.3 };
                    componentCenters[componentIds[1]] = { x: width * 0.3, y: height * 0.7 };
                    componentCenters[componentIds[2]] = { x: width * 0.7, y: height * 0.7 };
                }
            } else {
                // Four or more in circle arrangement
                componentIds.forEach((componentId, i) => {
                    const angle = (i * 2 * Math.PI) / numComponents;
                    const radius = Math.min(width, height) * 0.35;
                    
                    componentCenters[componentId] = {
                        x: width/2 + radius * Math.cos(angle),
                        y: height/2 + radius * Math.sin(angle)
                    };
                });
            }
            
            // Calculate radius for each component
            const componentRadii = {};
            Object.keys(components).forEach(componentId => {
                const componentNodes = components[componentId];
                if (!componentNodes.length) return;
                
                // Calculate radius based on node count and average size
                const nodeCount = componentNodes.length;
                let avgNodeSize = 10;
                if (componentNodes.some(n => n.radius)) {
                    avgNodeSize = componentNodes.reduce((sum, n) => sum + (n.radius || 10), 0) / nodeCount;
                }
                
                componentRadii[componentId] = Math.max(
                    Math.sqrt(nodeCount) * 20,
                    nodeCount * avgNodeSize * 0.5
                );
            });
            
            // Apply containment force to each component
            componentIds.forEach(componentId => {
                const componentNodes = components[componentId];
                if (!componentNodes.length) return;
                
                const center = componentCenters[componentId];
                const radius = componentRadii[componentId];
                
                // Sort nodes within component if LayoutSorter is available
                // The effect isn't as pronounced as in radial layouts, but it helps
                if (window.LayoutSorter) {
                    components[componentId] = window.LayoutSorter.sortNodes(componentNodes, 'in-degree', true);
                }
                
                // Apply containment force - stronger with distance from center
                const containmentStrength = alpha * 0.7;
                componentNodes.forEach(node => {
                    // Vector from center to node
                    const dx = node.x - center.x;
                    const dy = node.y - center.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    // Force increases with distance from center
                    const strength = containmentStrength * Math.min(1, distance / radius);
                    
                    // Apply force toward center
                    node.vx -= dx * strength;
                    node.vy -= dy * strength;
                    
                    // Hard constraint to keep nodes within bubble (with some flexibility)
                    if (distance > radius * 1.1) {
                        const scale = (radius * 1.1) / distance;
                        node.x = center.x + dx * scale;
                        node.y = center.y + dy * scale;
                    }
                });
            });
            
            // Component repulsion to separate bubbles
            const repulsionStrength = alpha * 2.0;
            
            for (let i = 0; i < componentIds.length; i++) {
                for (let j = i + 1; j < componentIds.length; j++) {
                    const centerA = componentCenters[componentIds[i]];
                    const centerB = componentCenters[componentIds[j]];
                    
                    if (!centerA || !centerB) continue;
                    
                    // Vector from center A to center B
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
        
        // Add internal force to improve component layout
        simulation.force('component-internal', function(alpha) {
            // For each component, ensure internal repulsion
            componentIds.forEach(componentId => {
                const componentNodes = components[componentId];
                if (componentNodes.length < 2) return;
                
                // Internal node repulsion to prevent overlap
                const internalRepulsion = alpha * 0.2;
                
                for (let i = 0; i < componentNodes.length; i++) {
                    for (let j = i + 1; j < componentNodes.length; j++) {
                        const nodeA = componentNodes[i];
                        const nodeB = componentNodes[j];
                        
                        const dx = nodeA.x - nodeB.x;
                        const dy = nodeA.y - nodeB.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance === 0) continue;
                        
                        // Minimum desired distance based on node sizes
                        const minDistance = (nodeA.radius || 10) + (nodeB.radius || 10) + 3;
                        
                        if (distance < minDistance) {
                            const force = internalRepulsion * (1 - distance / minDistance);
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
        });
        
        // Add slight gravity to each component center
        simulation.force('component-gravity', function(alpha) {
            componentIds.forEach(componentId => {
                const componentNodes = components[componentId];
                if (!componentNodes.length) return;
                
                // Calculate component center
                let centerX = 0, centerY = 0;
                componentNodes.forEach(node => {
                    centerX += node.x || 0;
                    centerY += node.y || 0;
                });
                centerX /= componentNodes.length;
                centerY /= componentNodes.length;
                
                // Apply gentle gravity toward center
                const gravityStrength = alpha * 0.03;
                componentNodes.forEach(node => {
                    node.vx += (centerX - node.x) * gravityStrength;
                    node.vy += (centerY - node.y) * gravityStrength;
                });
            });
        });
    }
    
    /**
     * Setup forces to create component bubbles with radial community layout inside
     * 
     * @param {Object} simulation - The D3 force simulation
     * @param {Array} nodes - Array of active node objects
     * @param {number} width - The width of the container
     * @param {number} height - The height of the container
     */
     /**
 * Setup forces to create component bubbles with radial community layout inside
 * 
 * @param {Object} simulation - The D3 force simulation
 * @param {Array} nodes - Array of node objects
 * @param {number} width - The width of the container
 * @param {number} height - The height of the container
 */
function setupBubbleRadialForces(simulation, nodes, width, height) {
    // Group nodes by component and community
    const components = {};
    const communitiesInComponents = {};
    
    nodes.forEach(function(node) {
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
    
    // Get all links from the simulation to use for optimization
    const links = simulation.force('link') ? simulation.force('link').links() : [];
    
    // Get component IDs (using var instead of let/const to avoid assignment issues)
    var componentIdArray = Object.keys(components);
    
    // Use LayoutSorter if available to optimize component order
    if (window.LayoutSorter) {
        // Convert to component objects for sorting
        const componentObjects = componentIdArray.map(function(id) {
            return {
                id: id,
                nodes: components[id]
            };
        });
        
        // First sort by size
        const sortedComponents = window.LayoutSorter.sortComponents(componentObjects, 'size', true);
        
        // Then optimize positioning if we have links
        const optimizedComponents = links.length ? 
            window.LayoutSorter.optimizeComponentOrder(sortedComponents, links) : sortedComponents;
        
        // Extract ids in optimized order - create a NEW array instead of modifying
        componentIdArray = optimizedComponents.map(function(c) { return c.id; });
    }
    
    // Add component positions force
    simulation.force('component-positions', function(alpha) {
        const strength = alpha * 0.8;
        const radius = Math.min(width, height) * 0.35;
        
        // Position components in a circle
        componentIdArray.forEach(function(componentId, i) {
            const componentNodes = components[componentId];
            if (!componentNodes.length) return;
            
            // Calculate target position for this component
            const angle = (i * 2 * Math.PI) / componentIdArray.length;
            const targetX = width / 2 + radius * Math.cos(angle);
            const targetY = height / 2 + radius * Math.sin(angle);
            
            // Calculate current component center
            let currentX = 0, currentY = 0;
            componentNodes.forEach(function(node) {
                currentX += node.x || 0;
                currentY += node.y || 0;
            });
            currentX /= componentNodes.length;
            currentY /= componentNodes.length;
            
            // Vector from current to target
            const dx = targetX - currentX;
            const dy = targetY - currentY;
            
            // Apply force to move component toward target
            componentNodes.forEach(function(node) {
                node.vx += dx * strength * 0.1;
                node.vy += dy * strength * 0.1;
            });
            
            // Now position communities within the component in a radial pattern
            const communities = communitiesInComponents[componentId];
            // Use var instead of let/const to avoid assignment issues
            var communityIdArray = Object.keys(communities);
            
            // Use LayoutSorter to optimize community order within this component
            if (window.LayoutSorter && links.length) {
                const communityIdsOptimized = window.LayoutSorter.optimizeCommunityOrder({
                    id: componentId,
                    nodes: componentNodes
                }, communities, links);
                
                // Use the optimized IDs if available
                if (communityIdsOptimized && communityIdsOptimized.length) {
                    communityIdArray = communityIdsOptimized;
                }
            }
            
            communityIdArray.forEach(function(communityId, j) {
                const communityNodes = communities[communityId];
                if (!communityNodes.length) return;
                
                // Calculate community position within component (in a circle)
                const communityAngle = (j * 2 * Math.PI) / communityIdArray.length;
                const communityRadius = Math.sqrt(componentNodes.length) * 10;
                const communityX = currentX + communityRadius * Math.cos(communityAngle);
                const communityY = currentY + communityRadius * Math.sin(communityAngle);
                
                // Sort nodes within community if LayoutSorter is available
                let sortedNodes = communityNodes;
                if (window.LayoutSorter) {
                    sortedNodes = window.LayoutSorter.sortNodes(communityNodes, 'in-degree', true);
                }
                
                // Position each node in the community
                sortedNodes.forEach(function(node, k) {
                    const nodeAngle = communityAngle + ((k * 2 * Math.PI) / sortedNodes.length) * 0.8;
                    const nodeRadius = communityRadius * 0.4;
                    
                    const targetNodeX = communityX + nodeRadius * Math.cos(nodeAngle);
                    const targetNodeY = communityY + nodeRadius * Math.sin(nodeAngle);
                    
                    // Apply force to position node
                    const nodeStrength = strength * 0.7;
                    node.vx += (targetNodeX - node.x) * nodeStrength;
                    node.vy += (targetNodeY - node.y) * nodeStrength;
                });
            });
            
            // Ensure component stays together (containment force)
            const componentRadius = Math.sqrt(componentNodes.length) * 20;
            componentNodes.forEach(function(node) {
                const nodeDx = node.x - currentX;
                const nodeDy = node.y - currentY;
                const distance = Math.sqrt(nodeDx * nodeDx + nodeDy * nodeDy);
                
                // Force increases with distance
                if (distance > componentRadius * 0.8) {
                    const containmentStrength = strength * (distance / componentRadius);
                    
                    node.vx -= nodeDx * containmentStrength;
                    node.vy -= nodeDy * containmentStrength;
                    
                    // Hard boundary to prevent nodes from escaping
                    if (distance > componentRadius) {
                        const scale = componentRadius / distance;
                        node.x = currentX + nodeDx * scale;
                        node.y = currentY + nodeDy * scale;
                    }
                }
            });
        });
    });
    
    // Add intra-community forces to maintain community structure
    simulation.force('community-containment', function(alpha) {
        const strength = alpha * 0.3;
        
        // For each component, enforce community structure
        componentIdArray.forEach(function(componentId) {
            const communities = communitiesInComponents[componentId];
            const communityIds = Object.keys(communities);
            
            communityIds.forEach(function(communityId) {
                const communityNodes = communities[communityId];
                if (communityNodes.length < 2) return;
                
                // Calculate community center
                let centerX = 0, centerY = 0;
                communityNodes.forEach(function(node) {
                    centerX += node.x || 0;
                    centerY += node.y || 0;
                });
                centerX /= communityNodes.length;
                centerY /= communityNodes.length;
                
                // Apply containment force
                communityNodes.forEach(function(node) {
                    node.vx += (centerX - node.x) * strength;
                    node.vy += (centerY - node.y) * strength;
                });
                
                // Add intra-community node repulsion to prevent overlap
                const repulsionStrength = strength * 0.5;
                for (let i = 0; i < communityNodes.length; i++) {
                    for (let j = i + 1; j < communityNodes.length; j++) {
                        const nodeA = communityNodes[i];
                        const nodeB = communityNodes[j];
                        
                        const dx = nodeA.x - nodeB.x;
                        const dy = nodeA.y - nodeB.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance === 0) continue;
                        
                        // Minimum desired distance based on node sizes
                        const minDistance = (nodeA.radius || 10) + (nodeB.radius || 10) + 2;
                        
                        if (distance < minDistance) {
                            const force = repulsionStrength * (1 - distance / minDistance);
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
        });
    });
    
    // Add inter-community repulsion within components
    simulation.force('community-separation', function(alpha) {
        const strength = alpha * 0.5;
        
        // For each component, separate communities
        componentIdArray.forEach(function(componentId) {
            const communities = communitiesInComponents[componentId];
            const communityIds = Object.keys(communities);
            
            // Skip components with only one community
            if (communityIds.length < 2) return;
            
            // Calculate community centers
            const communityCenters = {};
            communityIds.forEach(function(communityId) {
                const communityNodes = communities[communityId];
                if (!communityNodes.length) return;
                
                let centerX = 0, centerY = 0;
                communityNodes.forEach(function(node) {
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
                    const centerA = communityCenters[communityIds[i]];
                    const centerB = communityCenters[communityIds[j]];
                    
                    if (!centerA || !centerB) continue;
                    
                    const dx = centerA.x - centerB.x;
                    const dy = centerA.y - centerB.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance === 0) continue;
                    
                    // Calculate repulsion force
                    const force = strength / Math.max(distance, 10);
                    const fx = dx / distance * force;
                    const fy = dy / distance * force;
                    
                    // Apply to all nodes in the communities
                    communities[communityIds[i]].forEach(function(node) {
                        node.vx += fx;
                        node.vy += fy;
                    });
                    
                    communities[communityIds[j]].forEach(function(node) {
                        node.vx -= fx;
                        node.vy -= fy;
                    });
                }
            }
        });
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
     * Component metrics utility functions
     * For calculating bubble parameters, and community centers
     */
    api.calculateBubbleParams = function(components, width, height) {
        const result = {
            centers: {},
            radii: {}
        };
        
        if (!components || !components.length) return result;
        
        // If LayoutSorter is available, sort components by size first
        // Then optimize for connected components
        if (window.LayoutSorter) {
            components = window.LayoutSorter.sortComponents(components, 'size', true);
            
            // Extract all edges from components for optimization
            let allLinks = [];
            components.forEach(c => {
                if (c.edges && c.edges.length) {
                    allLinks = allLinks.concat(c.edges);
                }
            });
            
            if (allLinks.length) {
                components = window.LayoutSorter.optimizeComponentOrder(components, allLinks);
            }
        }
        
        const componentIds = components.map(c => c.id);
        
        // Calculate positions based on component count
        if (componentIds.length === 1) {
            // Single component centered
            result.centers[componentIds[0]] = { x: width/2, y: height/2 };
        } else if (componentIds.length === 2) {
            // Two components side by side
            result.centers[componentIds[0]] = { x: width * 0.35, y: height/2 };
            result.centers[componentIds[1]] = { x: width * 0.65, y: height/2 };
        } else if (componentIds.length === 3) {
            // Three components in triangle
            result.centers[componentIds[0]] = { x: width/2, y: height * 0.3 };
            result.centers[componentIds[1]] = { x: width * 0.3, y: height * 0.7 };
            result.centers[componentIds[2]] = { x: width * 0.7, y: height * 0.7 };
        } else {
            // Four or more in circle arrangement
            componentIds.forEach((componentId, i) => {
                const angle = (i * 2 * Math.PI) / componentIds.length;
                const radius = Math.min(width, height) * 0.35;
                
                result.centers[componentId] = {
                    x: width/2 + radius * Math.cos(angle),
                    y: height/2 + radius * Math.sin(angle)
                };
            });
        }
        
        // Calculate radius for each component based on node count and size
        components.forEach(component => {
            if (!component || !component.nodes) return;
            
            const nodeCount = component.nodes.length;
            // Calculate based on both count and average node size if available
            let avgNodeSize = 10;
            if (component.nodes.some(n => n.radius)) {
                avgNodeSize = component.nodes.reduce((sum, n) => sum + (n.radius || 10), 0) / nodeCount;
            }
            
            result.radii[component.id] = Math.max(
                Math.sqrt(nodeCount) * 15,
                nodeCount * avgNodeSize * 0.5
            );
        });
        
        return result;
    };
    
    /**
     * Calculate community centers within each component
     */
    api.calculateCommunityCenters = function(components, bubbleParams) {
        const result = {};
        
        if (!components || !bubbleParams || !bubbleParams.centers || !bubbleParams.radii) {
            return result;
        }
        
        components.forEach(component => {
            if (!component || !component.id || !component.nodes) return;
            
            const componentId = component.id;
            const componentCenter = bubbleParams.centers[componentId];
            const componentRadius = bubbleParams.radii[componentId];
            
            if (!componentCenter || !componentRadius) return;
            
            // Find communities in this component
            const communities = new Map();
            component.nodes.forEach(node => {
                if (!node) return;
                
                const communityId = node.community_id || 0;
                if (!communities.has(communityId)) {
                    communities.set(communityId, []);
                }
                communities.get(communityId).push(node);
            });
            
            // Convert to array and sort by size if LayoutSorter is available
            let communityArray = Array.from(communities.entries()).map(([id, nodes]) => ({
                id, 
                nodes
            }));
            
            if (window.LayoutSorter) {
                communityArray = window.LayoutSorter.sortComponents(communityArray, 'size', true);
                
                // Extract links for optimization if available
                const links = component.edges || [];
                if (links.length) {
                    communityArray = window.LayoutSorter.optimizeComponentOrder(communityArray, links);
                }
            }
            
            // Get community IDs in sorted order
            const communityIds = communityArray.map(c => c.id);
            result[componentId] = {};
            
            // Position communities in a circle within the component
            communityIds.forEach((communityId, i) => {
                const angle = (i * 2 * Math.PI) / communityIds.length;
                const distance = componentRadius * 0.6; // Slightly inside the component bubble
                
                result[componentId][communityId] = {
                    x: componentCenter.x + distance * Math.cos(angle),
                    y: componentCenter.y + distance * Math.sin(angle)
                };
            });
        });
        
        return result;
    };
    
    // Make the API available globally
    window.D3BubbleLayout = api;
    
    return api;
})();