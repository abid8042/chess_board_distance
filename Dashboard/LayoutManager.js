/*
 * LayoutManager.js
 * Manages layout calculations and forces for the network
 */
var LayoutManager = function() {
  // Constants
  var width = 900;
  var height = 600;
  
  // Force layout parameters
  var forceParams = {
    charge: -300,
    linkDistance: 60,
    gravity: 0.1
  };
  
  // Radial layout parameters
  var radialParams = {
    radius: 200,
    centerOffset: 100,
    increment: 18
  };
  
  // Layout-specific variables
  var radialLayout = null;
  var bubbleForceLayout = null;
  var bubbleRadialLayout = null;
  var groupCenters = null;
  
  // Public API
  var api = {};
  
  // Initialize with dimensions
  api.init = function(w, h) {
    width = w || width;
    height = h || height;
    return api;
  };
  
  // Get force parameters
  api.getForceParams = function() {
    return forceParams;
  };
  
  // Get radial parameters
  api.getRadialParams = function() {
    return radialParams;
  };
  
  // Calculate charge based on layout type
  api.getCharge = function(layoutType) {
    if (layoutType === "force") {
      return forceParams.charge;
    } else {
      return function(d) {
        return -Math.pow(d.radius, 2.0) / 2;
      };
    }
  };
  
  // Get the appropriate tick function for a layout
  api.getTick = function(layoutType) {
    switch(layoutType) {
      case "force": return api.forceTick;
      case "radial": return api.radialTick;
      case "bubble+force": return api.bubbleForceTick;
      case "bubble+radial": return api.bubbleRadialTick;
      default: return api.forceTick;
    }
  };
  
  // Prepare the appropriate layout
  api.prepareLayout = function(layoutType, nodes, links, sort) {
    if (layoutType === "radial") {
      var communities = api.sortedCommunities(nodes, links, sort);
      api.updateRadialCenters(communities);
    } else if (layoutType === "bubble+force" || layoutType === "bubble+radial") {
      api.setupBubbleLayout(nodes, links);
    }
  };
  
  // Configure force for the current layout
  api.configureForce = function(force, layoutType) {
    if (layoutType === "force") {
      force.charge(forceParams.charge)
        .linkDistance(forceParams.linkDistance)
        .gravity(forceParams.gravity)
        .friction(0.9)
        .on("tick", api.forceTick);
    } else if (layoutType === "radial") {
      force.charge(function(d) {
        return -Math.pow(d.radius, 2.0) / 2;
      })
        .linkDistance(forceParams.linkDistance)
        .gravity(forceParams.gravity / 2)
        .friction(0.9)
        .on("tick", api.radialTick);
    } else if (layoutType === "bubble+force") {
      force.charge(function(d) {
        return -Math.pow(d.radius, 2.0) / 2;
      })
        .linkDistance(forceParams.linkDistance * 0.8)
        .gravity(forceParams.gravity / 4) // Reduced gravity to let bubbles control positioning
        .friction(0.9)
        .on("tick", api.bubbleForceTick);
    } else if (layoutType === "bubble+radial") {
      force.charge(function(d) {
        return -Math.pow(d.radius, 2.0) / 2;
      })
        .linkDistance(forceParams.linkDistance * 0.8)
        .gravity(forceParams.gravity / 4) // Reduced gravity to let bubbles control positioning
        .friction(0.9)
        .on("tick", api.bubbleRadialTick);
    }
  };
  
  // Setup collision detection - Modified to work with D3.js v3
  api.setupCollision = function(force, nodes) {
    // In D3 v3, we can't add a collision force directly
    // Instead, we'll modify the tick function to handle collisions
    
    // Store the original tick handler
    var originalTick = force.on("tick");
    
    // Set a new tick handler that adds collision resolution
    force.on("tick", function(e) {
      // Call the original tick handler if it exists
      if (originalTick) originalTick(e);
      
      // Then resolve collisions
      api.resolveCollisions(e.alpha);
      
      // Constrain nodes to bounds if needed
      nodes.forEach(function(d) {
        api.constrainToBounds(d);
      });
    });
    
    return force;
  };
  
  // Constrain nodes to bounds
  api.constrainToBounds = function(d) {
    var r = d.radius || 3;
    d.x = Math.max(r, Math.min(width - r, d.x));
    d.y = Math.max(r, Math.min(height - r, d.y));
  };
  
  // Tick function for force-directed layout
  api.forceTick = function(e) {
    // Update node and link positions (will be provided by the caller)
  };
  
  // Tick function for radial layout
  api.radialTick = function(e) {
    // Update node and link positions (will be provided by the caller)
  };
  
  // Tick function for bubble + force layout
  api.bubbleForceTick = function(e) {
    // Update node and link positions (will be provided by the caller)
  };
  
  // Tick function for bubble + radial layout
  api.bubbleRadialTick = function(e) {
    // Update node and link positions (will be provided by the caller)
  };
  
  // Helper function to move nodes to their proper radial position
  api.moveToRadialLayout = function(alpha) {
    var k = alpha * 0.1;
    return function(d) {
      var centerNode = groupCenters(d.artist);
      if (centerNode) {
        d.x += (centerNode.x - d.x) * k;
        d.y += (centerNode.y - d.y) * k;
      }
    };
  };
  
  // Helper function to move nodes to their component bubble (force layout inside)
  api.moveToBubbleForceLayout = function(alpha) {
    var k = alpha * 0.5; // Significantly increased from 0.15 for stronger containment
    return function(d) {
      // Get component center
      if (!bubbleForceLayout || !bubbleForceLayout.centers) return;
      
      var componentCenter = bubbleForceLayout.centers[d.componentId];
      
      if (componentCenter) {
        // Get component radius to contain nodes
        var radius = bubbleForceLayout.radii[d.componentId] || 50;
        
        // Vector from center to node
        var dx = d.x - componentCenter.x;
        var dy = d.y - componentCenter.y;
        var distance = Math.sqrt(dx * dx + dy * dy);
        
        // Radius to constrain nodes within
        var nodeRadius = d.radius || 5;
        var constraintRadius = radius * 0.85; // Keep nodes within 85% of bubble radius
        
        // Apply strong centering force - increases with distance
        var centerForce = Math.min(1, distance / constraintRadius);
        d.x += (componentCenter.x - d.x) * k * (0.3 + centerForce * 0.7);
        d.y += (componentCenter.y - d.y) * k * (0.3 + centerForce * 0.7);
        
        // Hard constraint - ensure nodes stay within bubble boundaries
        if (distance > constraintRadius - nodeRadius) {
          var scale = (constraintRadius - nodeRadius) / distance;
          d.x = componentCenter.x + dx * scale;
          d.y = componentCenter.y + dy * scale;
        }
        
        // Add jitter to avoid nodes clumping at the center
        if (distance < radius * 0.2) {
          d.x += (Math.random() - 0.5) * 2;
          d.y += (Math.random() - 0.5) * 2;
        }
      }
    };
  };
  
  // Helper function to move nodes to their component bubble with radial layout inside
  api.moveToBubbleRadialLayout = function(alpha) {
    var k = alpha * 0.5; // Significantly increased from 0.15 for stronger containment
    return function(d) {
      // Get component center
      if (!bubbleRadialLayout || !bubbleRadialLayout.centers) return;
      
      var componentCenter = bubbleRadialLayout.centers[d.componentId];
      
      if (componentCenter) {
        // Get component radius and community centers
        var componentRadius = bubbleRadialLayout.radii[d.componentId] || 50;
        var communityCenter = null;
        
        if (bubbleRadialLayout.communityCenters && 
            bubbleRadialLayout.communityCenters[d.componentId]) {
          communityCenter = bubbleRadialLayout.communityCenters[d.componentId][d.community];
        }
        
        // Calculate target position (either community center or component center)
        var targetX, targetY;
        if (communityCenter) {
          targetX = communityCenter.x;
          targetY = communityCenter.y;
        } else {
          targetX = componentCenter.x;
          targetY = componentCenter.y;
        }
        
        // Strong force toward target position
        d.x += (targetX - d.x) * k;
        d.y += (targetY - d.y) * k;
        
        // Add repulsion between nodes in same community (simplified)
        window.force.nodes().forEach(function(other) {
          if (other !== d && other.componentId === d.componentId && other.community === d.community) {
            var diffX = d.x - other.x;
            var diffY = d.y - other.y;
            var dist = Math.sqrt(diffX * diffX + diffY * diffY);
            if (dist < (d.radius + other.radius) * 3) {
              var moveFactor = k * 0.3 * (1 / (dist + 0.1));
              d.x += diffX * moveFactor;
              d.y += diffY * moveFactor;
            }
          }
        });
        
        // Hard boundary constraint - ensure nodes stay within bubble
        var dx = d.x - componentCenter.x;
        var dy = d.y - componentCenter.y;
        var distance = Math.sqrt(dx * dx + dy * dy);
        var nodeRadius = d.radius || 5;
        var maxDistance = componentRadius * 0.85 - nodeRadius; // Reduce to 85% of radius
        
        if (distance > maxDistance) {
          var scale = maxDistance / distance;
          d.x = componentCenter.x + dx * scale;
          d.y = componentCenter.y + dy * scale;
        }
      }
    };
  };
  
  // Resolve collisions between nodes
  api.resolveCollisions = function(alpha) {
    // Make sure we have a valid force with nodes
    if (!window.force || !window.force.nodes) return;
    
    var quadtree = d3.geom.quadtree(window.force.nodes());
    
    // Visit each node in the quadtree
    window.force.nodes().forEach(function(d) {
      var r = d.radius + 3, // Add a small buffer
          nx1 = d.x - r,
          nx2 = d.x + r,
          ny1 = d.y - r,
          ny2 = d.y + r;
      
      // Check for collisions with nearby nodes
      quadtree.visit(function(quad, x1, y1, x2, y2) {
        if (quad.point && (quad.point !== d)) {
          var x = d.x - quad.point.x,
              y = d.y - quad.point.y,
              l = Math.sqrt(x * x + y * y),
              r = d.radius + quad.point.radius + 2; // Added buffer
              
          // Push nodes apart if they overlap
          if (l < r) {
            l = (l - r) / l * alpha * 0.5;
            d.x -= x *= l;
            d.y -= y *= l;
            quad.point.x += x;
            quad.point.y += y;
          }
        }
        
        // Return true if we don't need to check this quad
        return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
      });
    });
  };
  
  // Function to get sorted communities by nodes or links
  api.sortedCommunities = function(nodes, links, sort) {
    var communities = [];
    var communityMap = d3.map();
    
    // Count songs by community
    nodes.forEach(function(n) {
      var key = n.artist; // Using artist for community to match original code
      if (!communityMap.has(key)) {
        communityMap.set(key, 0);
        communities.push(key);
      }
      communityMap.set(key, communityMap.get(key) + 1);
    });
    
    // If sorting by links, count links by community
    if (sort === "links") {
      links.forEach(function(l) {
        if (l.source && l.source.artist) {
          communityMap.set(l.source.artist, communityMap.get(l.source.artist) + 1);
        }
        if (l.target && l.target.artist) {
          communityMap.set(l.target.artist, communityMap.get(l.target.artist) + 1);
        }
      });
    }
    
    // Sort communities by count
    communities.sort(function(a, b) {
      return communityMap.get(b) - communityMap.get(a);
    });
    
    return communities;
  };
  
  // Updates centers for radial layout
  api.updateRadialCenters = function(communities) {
    radialLayout = RadialPlacement()
      .center({"x": width/2, "y": height/2 - radialParams.centerOffset})
      .radius(radialParams.radius)
      .increment(radialParams.increment)
      .keys(communities);
    
    groupCenters = radialLayout;
  };
  
  // Setup bubble layout for components
  api.setupBubbleLayout = function(nodes, links) {
    console.log("Setting up bubble layout");
    
    // Safety check for inputs
    if (!nodes || nodes.length === 0) {
      console.warn("No nodes provided for bubble layout setup");
      return [];
    }
    
    // Get unique components from nodes
    var components = [];
    var componentMap = {};
    
    try {
      // First pass: create component objects
      nodes.forEach(function(node) {
        if (node && node.componentId) {
          if (!componentMap[node.componentId]) {
            componentMap[node.componentId] = {
              id: node.componentId,
              nodes: [],
              edges: []
            };
            components.push(componentMap[node.componentId]);
          }
        }
      });
      
      // Second pass: add nodes to their components
      nodes.forEach(function(node) {
        if (node && node.componentId && componentMap[node.componentId]) {
          componentMap[node.componentId].nodes.push(node);
        }
      });
      
      // Add links to components
      if (links && links.length) {
        links.forEach(function(link) {
          if (link && link.source && link.source.componentId) {
            var componentId = link.source.componentId;
            if (componentMap[componentId]) {
              componentMap[componentId].edges.push(link);
            }
          }
        });
      }
      
      console.log("Components extracted for bubble layout:", components.length);
      
      // Use ComponentMetrics to calculate bubble layout parameters
      var componentMetrics = ComponentMetrics();
      bubbleForceLayout = componentMetrics.calculateBubbleParams(components, width, height);
      
      // For radial layout within bubbles, also calculate community centers
      bubbleRadialLayout = {
        centers: bubbleForceLayout.centers,
        radii: bubbleForceLayout.radii,
        communityCenters: componentMetrics.calculateCommunityCenters(components, bubbleForceLayout)
      };
      
      // Make bubble layout parameters accessible to window.force
      window.force = window.force || {};
      window.force.bubbleParams = bubbleForceLayout;
      
      return components;
    } catch (e) {
      console.error("Error setting up bubble layout:", e);
      return [];
    }
  };
  
  // Update force layout parameters
  api.updateForceParams = function(params) {
    if (params.charge !== undefined) forceParams.charge = params.charge;
    if (params.linkDistance !== undefined) forceParams.linkDistance = params.linkDistance;
    if (params.gravity !== undefined) forceParams.gravity = params.gravity;
    return api;
  };
  
  // Update radial layout parameters
  api.updateRadialParams = function(params) {
    if (params.radius !== undefined) radialParams.radius = params.radius;
    if (params.centerOffset !== undefined) radialParams.centerOffset = params.centerOffset;
    if (params.increment !== undefined) radialParams.increment = params.increment;
    return api;
  };
  
  // Automatically tune parameters based on graph characteristics
  api.autoTuneParameters = function(nodeCount, linkCount) {
    console.log("Auto-tuning parameters for " + nodeCount + " nodes and " + linkCount + " links");
    
    var density = linkCount / (nodeCount * (nodeCount - 1) / 2); // Graph density
    
    // Base adjustments for all layouts
    forceParams.charge = -300 * Math.pow(nodeCount / 10, 0.3); // Scale charge by node count
    forceParams.linkDistance = 60 + 40 * (1 - density); // Longer distances for sparser graphs
    forceParams.gravity = 0.1 * Math.pow(nodeCount / 20, 0.2); // Stronger gravity for larger graphs
    
    // Update radial parameters too
    radialParams.radius = 100 + 20 * Math.log(nodeCount);
    radialParams.centerOffset = 80 + 10 * Math.log(nodeCount);
    radialParams.increment = Math.max(8, 20 - nodeCount / 10);
    
    // Special handling for bubble layouts
    if (window.layout && window.layout.startsWith("bubble+")) {
      console.log("Auto-tuning bubble layout parameters");
      
      // Recalculate bubble layout with optimized parameters
      if (window.force && window.force.nodes) {
        // Group nodes by component for component-specific analysis
        var nodesByComponent = {};
        window.force.nodes().forEach(function(node) {
          if (!nodesByComponent[node.componentId]) {
            nodesByComponent[node.componentId] = [];
          }
          nodesByComponent[node.componentId].push(node);
        });
        
        // Get component counts for balanced layout
        var componentCounts = Object.keys(nodesByComponent).length;
        
        // Adjust charge based on component count
        if (componentCounts > 1) {
          // Stronger repulsion between nodes in multi-component view
          forceParams.charge = -350 * Math.pow(nodeCount / 10, 0.3);
          
          // Reduce global gravity to let bubble forces dominate
          forceParams.gravity = 0.05 * Math.pow(nodeCount / 20, 0.2);
        }
        
        // Create new components array for bubble calculation
        var components = [];
        Object.keys(nodesByComponent).forEach(function(componentId) {
          components.push({
            id: componentId,
            nodes: nodesByComponent[componentId],
            edges: [] // We don't need edges for sizing/positioning
          });
        });
        
        if (componentCounts === 3) {
          // Special optimization for 3 components - triangle layout
          // This is handled in ComponentMetrics.calculateBubbleParams
        }
        
        // Recalculate bubble parameters with the current node distribution
        var componentMetrics = ComponentMetrics();
        bubbleForceLayout = componentMetrics.calculateBubbleParams(components, width, height);
        
        // For radial layout within bubbles, also recalculate community centers
        bubbleRadialLayout = {
          centers: bubbleForceLayout.centers,
          radii: bubbleForceLayout.radii,
          communityCenters: componentMetrics.calculateCommunityCenters(components, bubbleForceLayout)
        };
        
        // Make bubble layout parameters accessible to window.force
        window.force.bubbleParams = bubbleForceLayout;
        
        console.log("Recalculated bubble parameters for " + components.length + " components");
      }
    }
    
    return api;
  };
  
  return api;
};