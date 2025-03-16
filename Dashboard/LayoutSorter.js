/**
 * LayoutSorter.js
 * Handles sorting of nodes, communities, and components for chess network layouts.
 * Provides metric-based sorting to optimize visual organization.
 */

const LayoutSorter = (function() {
    // Public API
    const api = {};
    
    /**
     * Sorts components based on specified metric
     * 
     * @param {Array} components - Array of component objects
     * @param {string} metric - Metric to sort by ('size', 'centrality', 'diameter', etc.)
     * @param {boolean} descending - Whether to sort in descending order (default: true)
     * @returns {Array} - Sorted array of components
     */
    api.sortComponents = function(components, metric = 'size', descending = true) {
        if (!components || !Array.isArray(components)) return [];
        
        // Clone the array to avoid modifying the original
        const sorted = [...components];
        
        // Define compare functions for different metrics
        const compareFns = {
            // Sort by number of nodes (size)
            size: (a, b) => {
                const aSize = a.nodes ? a.nodes.length : 0;
                const bSize = b.nodes ? b.nodes.length : 0;
                return descending ? bSize - aSize : aSize - bSize;
            },
            
            // Sort by average in-degree centrality
            'in-centrality': (a, b) => {
                const aAvg = getAverageCentrality(a.nodes, 'in_degree_centrality');
                const bAvg = getAverageCentrality(b.nodes, 'in_degree_centrality');
                return descending ? bAvg - aAvg : aAvg - bAvg;
            },
            
            // Sort by average out-degree centrality
            'out-centrality': (a, b) => {
                const aAvg = getAverageCentrality(a.nodes, 'out_degree_centrality');
                const bAvg = getAverageCentrality(b.nodes, 'out_degree_centrality');
                return descending ? bAvg - aAvg : aAvg - bAvg;
            },
            
            // Sort by component ID (numeric)
            id: (a, b) => {
                const aId = a.id !== undefined ? Number(a.id) : 0;
                const bId = b.id !== undefined ? Number(b.id) : 0;
                return descending ? bId - aId : aId - bId;
            },
            
            // Sort by number of links (edge density)
            density: (a, b) => {
                const aEdges = a.edges ? a.edges.length : 0;
                const bEdges = b.edges ? b.edges.length : 0;
                // Calculate density: edges / (nodes * (nodes-1))
                const aSize = a.nodes ? a.nodes.length : 0;
                const bSize = b.nodes ? b.nodes.length : 0;
                const aDensity = aSize > 1 ? aEdges / (aSize * (aSize - 1) / 2) : 0;
                const bDensity = bSize > 1 ? bEdges / (bSize * (bSize - 1) / 2) : 0;
                return descending ? bDensity - aDensity : aDensity - bDensity;
            }
        };
        
        // Use the appropriate compare function or default to size
        const compareFn = compareFns[metric] || compareFns.size;
        
        // Sort the array
        return sorted.sort(compareFn);
    };
    
    /**
     * Sorts communities within each component
     * 
     * @param {Array} components - Array of component objects
     * @param {Object} communitiesInComponents - Object mapping components to communities
     * @param {string} metric - Metric to sort by ('size', 'centrality', etc.)
     * @param {boolean} descending - Whether to sort in descending order (default: true)
     * @returns {Object} - Sorted communities within components
     */
    api.sortCommunities = function(components, communitiesInComponents, metric = 'size', descending = true) {
        if (!components || !communitiesInComponents) return {};
        
        const result = {};
        
        components.forEach(component => {
            if (!component || !component.id) return;
            
            const componentId = component.id;
            const communities = communitiesInComponents[componentId];
            
            if (!communities) {
                result[componentId] = {};
                return;
            }
            
            // Convert communities object to array for sorting
            const communitiesArray = Object.keys(communities).map(communityId => ({
                id: communityId,
                nodes: communities[communityId] || []
            }));
            
            // Sort communities using the same logic as components
            const sortedCommunities = api.sortComponents(communitiesArray, metric, descending);
            
            // Convert back to object format
            result[componentId] = {};
            sortedCommunities.forEach(community => {
                result[componentId][community.id] = community.nodes;
            });
        });
        
        return result;
    };
    
    /**
     * Sorts nodes within a community or component
     * 
     * @param {Array} nodes - Array of node objects
     * @param {string} metric - Metric to sort by ('in-degree', 'out-degree', 'piece-type', etc.)
     * @param {boolean} descending - Whether to sort in descending order (default: true)
     * @returns {Array} - Sorted array of nodes
     */
    api.sortNodes = function(nodes, metric = 'in-degree', descending = true) {
        if (!nodes || !Array.isArray(nodes)) return [];
        
        // Clone the array to avoid modifying the original
        const sorted = [...nodes];
        
        // Define compare functions for different metrics
        const compareFns = {
            'in-degree': (a, b) => {
                const aValue = a.in_degree_centrality !== undefined ? a.in_degree_centrality : 0;
                const bValue = b.in_degree_centrality !== undefined ? b.in_degree_centrality : 0;
                return descending ? bValue - aValue : aValue - bValue;
            },
            
            'out-degree': (a, b) => {
                const aValue = a.out_degree_centrality !== undefined ? a.out_degree_centrality : 0;
                const bValue = b.out_degree_centrality !== undefined ? b.out_degree_centrality : 0;
                return descending ? bValue - aValue : aValue - bValue;
            },
            
            'piece-type': (a, b) => {
                // Order: king, queen, rook, bishop, knight, pawn, empty
                const typeOrder = { 
                    king: 1, 
                    queen: 2, 
                    rook: 3, 
                    bishop: 4, 
                    knight: 5, 
                    pawn: 6,
                    '': 7 
                };
                
                // Ensure we're working with strings and handle nulls/undefined
                const aType = a.piece_type ? typeOrder[String(a.piece_type).toLowerCase()] || 7 : 7;
                const bType = b.piece_type ? typeOrder[String(b.piece_type).toLowerCase()] || 7 : 7;
                
                return descending ? aType - bType : bType - aType; // For piece type, lower is more important
            },
            
            'piece-color': (a, b) => {
                // Order: white, black, empty
                const aColor = a.piece_color === 'white' ? 0 : a.piece_color === 'black' ? 1 : 2;
                const bColor = b.piece_color === 'white' ? 0 : b.piece_color === 'black' ? 1 : 2;
                return descending ? aColor - bColor : bColor - aColor;
            },
            
            status: (a, b) => {
                // Order: active, inactive, captured
                const statusOrder = { active: 0, inactive: 1, captured: 2, '': 3 };
                const aStatus = statusOrder[a.status || ''] || 3;
                const bStatus = statusOrder[b.status || ''] || 3;
                return descending ? aStatus - bStatus : bStatus - aStatus;
            },
            
            position: (a, b) => {
                // Sort by algebraic notation (a1, a2, ..., h8)
                if (!a.position || !b.position) return 0;
                
                // Compare files (a-h)
                const aFile = a.position.charAt(0);
                const bFile = b.position.charAt(0);
                if (aFile !== bFile) {
                    return descending ? bFile.localeCompare(aFile) : aFile.localeCompare(bFile);
                }
                
                // Compare ranks (1-8)
                const aRank = parseInt(a.position.charAt(1)) || 0;
                const bRank = parseInt(b.position.charAt(1)) || 0;
                return descending ? bRank - aRank : aRank - bRank;
            }
        };
        
        // Use the appropriate compare function or default to in-degree
        const compareFn = compareFns[metric] || compareFns['in-degree'];
        
        // Sort the array
        return sorted.sort(compareFn);
    };
    
    /**
     * Optimizes the order of components for radial layout
     * Places components with connections closer together
     * 
     * @param {Array} components - Array of component objects
     * @param {Array} links - Array of link objects
     * @returns {Array} - Reordered array of components
     */
    api.optimizeComponentOrder = function(components, links) {
        if (!components || components.length <= 2 || !links) {
            return components; // No need to reorder for 0-2 components
        }
        
        // First, sort by size (default order)
        const sortedComponents = api.sortComponents(components, 'size', true);
        
        // For small numbers of components, we can try all permutations
        if (sortedComponents.length <= 5) {
            return optimizeByPermutation(sortedComponents, links);
        }
        
        // For larger numbers, use a greedy approach
        return optimizeGreedy(sortedComponents, links);
    };
    
    /**
     * Optimizes the radial position of communities within a component
     * 
     * @param {Object} component - Component object
     * @param {Object} communities - Communities within the component
     * @param {Array} links - Array of link objects
     * @returns {Array} - Ordered array of community IDs
     */
    api.optimizeCommunityOrder = function(component, communities, links) {
        if (!component || !communities || !links) return [];
        
        // Extract community IDs
        const communityIds = Object.keys(communities);
        
        if (communityIds.length <= 2) {
            return communityIds; // No need to reorder for 0-2 communities
        }
        
        // Create community objects with nodes
        const communityObjects = communityIds.map(id => ({
            id,
            nodes: communities[id] || []
        }));
        
        // Sort by size first
        const sortedCommunities = api.sortComponents(communityObjects, 'size', true);
        
        // Get just the IDs
        return sortedCommunities.map(c => c.id);
    };
    
    /**
     * Calculates the average centrality value for a set of nodes
     * 
     * @param {Array} nodes - Array of node objects
     * @param {string} centralityKey - The key for the centrality value to average
     * @returns {number} - The average centrality value
     */
    function getAverageCentrality(nodes, centralityKey) {
        if (!nodes || !Array.isArray(nodes) || nodes.length === 0) return 0;
        
        let sum = 0;
        let count = 0;
        
        nodes.forEach(node => {
            if (node && node[centralityKey] !== undefined) {
                sum += node[centralityKey];
                count++;
            }
        });
        
        return count > 0 ? sum / count : 0;
    }
    
    /**
     * Optimizes component order by trying all permutations (for small numbers)
     * Minimizes the "stress" on the layout by placing connected components closer together
     * 
     * @param {Array} components - Array of component objects
     * @param {Array} links - Array of link objects
     * @returns {Array} - Optimally ordered array of components
     */
    function optimizeByPermutation(components, links) {
        if (components.length <= 1) return components;
        
        // Create a connection matrix between components
        const connectionMatrix = {};
        
        // Initialize matrix
        components.forEach(c1 => {
            if (!c1 || !c1.id) return;
            connectionMatrix[c1.id] = {};
            
            components.forEach(c2 => {
                if (!c2 || !c2.id) return;
                connectionMatrix[c1.id][c2.id] = 0;
            });
        });
        
        // Fill the matrix with connection counts
        links.forEach(link => {
            if (!link || !link.source || !link.target) return;
            
            const sourceNode = typeof link.source === 'object' ? link.source : null;
            const targetNode = typeof link.target === 'object' ? link.target : null;
            
            if (!sourceNode || !targetNode) return;
            
            const sourceComponentId = sourceNode.component_id;
            const targetComponentId = targetNode.component_id;
            
            if (sourceComponentId === targetComponentId) return;
            
            if (connectionMatrix[sourceComponentId] && connectionMatrix[sourceComponentId][targetComponentId] !== undefined) {
                connectionMatrix[sourceComponentId][targetComponentId]++;
            }
            
            if (connectionMatrix[targetComponentId] && connectionMatrix[targetComponentId][sourceComponentId] !== undefined) {
                connectionMatrix[targetComponentId][sourceComponentId]++;
            }
        });
        
        // Helper function to generate all permutations
        function getPermutations(arr) {
            if (arr.length <= 1) return [arr];
            
            const result = [];
            for (let i = 0; i < arr.length; i++) {
                const current = arr[i];
                const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
                const permutations = getPermutations(remaining);
                
                permutations.forEach(perm => {
                    result.push([current, ...perm]);
                });
            }
            
            return result;
        }
        
        // Calculate the "stress" of a particular ordering
        function calculateStress(ordering) {
            let stress = 0;
            
            for (let i = 0; i < ordering.length; i++) {
                for (let j = i + 1; j < ordering.length; j++) {
                    // The further apart, the more stress if they're connected
                    const distanceFactor = Math.min(
                        Math.abs(j - i),
                        Math.abs(j - i - ordering.length),
                        Math.abs(j - i + ordering.length)
                    );
                    
                    const c1 = ordering[i];
                    const c2 = ordering[j];
                    
                    if (connectionMatrix[c1.id] && connectionMatrix[c1.id][c2.id]) {
                        stress += connectionMatrix[c1.id][c2.id] * distanceFactor;
                    }
                }
            }
            
            return stress;
        }
        
        // Generate all permutations and find the one with minimum stress
        const permutations = getPermutations(components);
        let minStress = Number.MAX_VALUE;
        let bestOrder = components;
        
        permutations.forEach(perm => {
            const stress = calculateStress(perm);
            if (stress < minStress) {
                minStress = stress;
                bestOrder = perm;
            }
        });
        
        return bestOrder;
    }
    
    /**
     * Optimizes component order using a greedy approach (for larger numbers)
     * 
     * @param {Array} components - Array of component objects
     * @param {Array} links - Array of link objects
     * @returns {Array} - Greedily ordered array of components
     */
    function optimizeGreedy(components, links) {
        if (components.length <= 1) return components;
        
        // Create a connection matrix between components
        const connectionMatrix = {};
        
        // Initialize matrix
        components.forEach(c1 => {
            if (!c1 || !c1.id) return;
            connectionMatrix[c1.id] = {};
            
            components.forEach(c2 => {
                if (!c2 || !c2.id) return;
                connectionMatrix[c1.id][c2.id] = 0;
            });
        });
        
        // Fill the matrix with connection counts
        links.forEach(link => {
            if (!link || !link.source || !link.target) return;
            
            const sourceNode = typeof link.source === 'object' ? link.source : null;
            const targetNode = typeof link.target === 'object' ? link.target : null;
            
            if (!sourceNode || !targetNode) return;
            
            const sourceComponentId = sourceNode.component_id;
            const targetComponentId = targetNode.component_id;
            
            if (sourceComponentId === targetComponentId) return;
            
            if (connectionMatrix[sourceComponentId] && connectionMatrix[sourceComponentId][targetComponentId] !== undefined) {
                connectionMatrix[sourceComponentId][targetComponentId]++;
            }
            
            if (connectionMatrix[targetComponentId] && connectionMatrix[targetComponentId][sourceComponentId] !== undefined) {
                connectionMatrix[targetComponentId][sourceComponentId]++;
            }
        });
        
        // Start with the largest component
        const result = [components[0]];
        const remaining = components.slice(1);
        
        // Greedily add the next most connected component
        while (remaining.length > 0) {
            let bestNextIndex = 0;
            let bestConnectionScore = -1;
            
            // Find the remaining component with the strongest connection to any in result
            for (let i = 0; i < remaining.length; i++) {
                const candidate = remaining[i];
                let connectionScore = 0;
                
                result.forEach(placedComponent => {
                    if (connectionMatrix[placedComponent.id] && connectionMatrix[placedComponent.id][candidate.id]) {
                        connectionScore += connectionMatrix[placedComponent.id][candidate.id];
                    }
                });
                
                if (connectionScore > bestConnectionScore) {
                    bestConnectionScore = connectionScore;
                    bestNextIndex = i;
                }
            }
            
            // Add the best component to result
            result.push(remaining[bestNextIndex]);
            remaining.splice(bestNextIndex, 1);
        }
        
        return result;
    }
    
    // Make the API available globally
    window.LayoutSorter = api;
    
    return api;
})();