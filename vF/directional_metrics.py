#!/usr/bin/env python
"""
Directional Metrics Module

This module provides functions to analyze directed graphs created from chess positions.
It computes various network metrics including:
- Component decomposition (weak/strong)
- Fiedler values (algebraic connectivity)
- Directed diameters (with detailed paths)
- Centrality measures (in/out degree)
- Community detection (modularity)
- Clustering coefficients
- Size entropy

These metrics provide insights into the structure of chess influence networks.

Author: Your Name
Version: 1.0.0
Date: March 4, 2025
"""

import networkx as nx
import numpy as np
import math
import chess
from typing import Dict, List, Tuple, Set, Any, Optional, Union
from positional_graph import PositionalGraph
from cdlib import algorithms, evaluation


# --- Component Analysis Functions ---

def decompose_into_components(G: nx.DiGraph, component_type: str = 'weak') -> List[nx.DiGraph]:
    """
    Decompose a directed graph into its disconnected components.
    
    Args:
        G: The directed graph to decompose
        component_type: 'weak' for weakly connected components or 'strong' for strongly connected components
        
    Returns:
        A list of DiGraph objects, each representing a component
    """
    if component_type == 'strong':
        components = [G.subgraph(c).copy() for c in nx.strongly_connected_components(G)]
    else:
        components = [G.subgraph(c).copy() for c in nx.weakly_connected_components(G)]
    return components


def verify_no_intercomponent_edges(G: nx.DiGraph, components: List[nx.DiGraph]) -> bool:
    """
    Verify that there are no edges between components.
    
    Args:
        G: The original graph
        components: The list of component subgraphs
        
    Returns:
        True if there are no edges between components, False otherwise
    """
    node_to_component = {}
    for idx, comp in enumerate(components):
        for node in comp.nodes():
            node_to_component[node] = idx
    
    for u, v in G.edges():
        if node_to_component.get(u) != node_to_component.get(v):
            return False
    return True


# --- Fiedler Value Functions ---

def compute_fiedler_value(G: nx.DiGraph) -> Optional[float]:
    """
    Compute the Fiedler value (second smallest eigenvalue of the Laplacian matrix).
    
    The Fiedler value is a measure of how well-connected the graph is. Higher values
    indicate better connectivity.
    
    Args:
        G: The directed graph
        
    Returns:
        The Fiedler value as a float, or None if it can't be computed
    """
    if G.number_of_nodes() < 2:
        return None
    
    L = nx.directed_laplacian_matrix(G)
    try:
        L = L.toarray()
    except AttributeError:
        pass
    
    eigenvalues = np.linalg.eigvals(L)
    eigenvalues_sorted = sorted(eigenvalues, key=lambda x: x.real)
    
    if len(eigenvalues_sorted) < 2:
        return None
    
    return eigenvalues_sorted[1].real


def aggregate_fiedler_value_power(components: List[nx.DiGraph], exponent: float = 2) -> float:
    """
    Aggregate Fiedler values across components using power-law weighting.
    
    Args:
        components: List of component subgraphs
        exponent: Power-law exponent for weighting (larger components have more influence)
        
    Returns:
        Weighted average of Fiedler values across components
    """
    total_weight = sum(comp.number_of_nodes() ** exponent for comp in components)
    aggregated_value = 0.0
    
    for comp in components:
        weight = comp.number_of_nodes() ** exponent
        fiedler = compute_fiedler_value(comp)
        if fiedler is not None:
            aggregated_value += (weight / total_weight) * fiedler
    
    return aggregated_value


# --- Diameter Analysis Functions ---

def compute_directed_out_diameter(G: nx.DiGraph) -> int:
    """
    Compute the directed out-diameter of a graph.
    
    The out-diameter is the maximum shortest path length from any node
    to any other node following edge directions.
    
    Args:
        G: The directed graph
        
    Returns:
        The out-diameter (maximum shortest path length) as an integer
    """
    if G.number_of_nodes() <= 1:
        return 0
    
    max_distance = 0
    for u in G.nodes():
        lengths = dict(nx.single_source_shortest_path_length(G, u))
        if lengths:
            max_distance = max(max_distance, max(lengths.values()))
    
    return max_distance


def compute_directed_in_diameter(G: nx.DiGraph) -> int:
    """
    Compute the directed in-diameter of a graph.
    
    The in-diameter is the maximum shortest path length from any node
    to any other node against edge directions.
    
    Args:
        G: The directed graph
        
    Returns:
        The in-diameter (maximum shortest path length) as an integer
    """
    if G.number_of_nodes() <= 1:
        return 0
    
    max_distance = 0
    for v in G.nodes():
        lengths = dict(nx.single_target_shortest_path_length(G, v))
        if lengths:
            max_distance = max(max_distance, max(lengths.values()))
    
    return max_distance


def compute_directed_out_diameter_details(G: nx.DiGraph) -> Tuple[int, List[Tuple[Any, Any]]]:
    """
    Compute the directed out-diameter and the node pairs at this distance.
    
    Args:
        G: The directed graph
        
    Returns:
        A tuple containing:
        - The out-diameter (maximum shortest path length) as an integer
        - A list of node pairs (u, v) with shortest path length equal to the diameter
    """
    if G.number_of_nodes() <= 1:
        return 0, []
    
    max_distance = 0
    for u in G.nodes():
        lengths = dict(nx.single_source_shortest_path_length(G, u))
        if lengths:
            max_distance = max(max_distance, max(lengths.values()))
    
    pairs = []
    for u in G.nodes():
        lengths = dict(nx.single_source_shortest_path_length(G, u))
        for v, d in lengths.items():
            if d == max_distance:
                pairs.append((u, v))
    
    return max_distance, pairs


def compute_directed_in_diameter_details(G: nx.DiGraph) -> Tuple[int, List[Tuple[Any, Any]]]:
    """
    Compute the directed in-diameter and the node pairs at this distance.
    
    Args:
        G: The directed graph
        
    Returns:
        A tuple containing:
        - The in-diameter (maximum shortest path length) as an integer
        - A list of node pairs (u, v) with shortest path length equal to the diameter
    """
    if G.number_of_nodes() <= 1:
        return 0, []
    
    max_distance = 0
    for v in G.nodes():
        lengths = dict(nx.single_target_shortest_path_length(G, v))
        if lengths:
            max_distance = max(max_distance, max(lengths.values()))
    
    pairs = []
    for v in G.nodes():
        lengths = dict(nx.single_target_shortest_path_length(G, v))
        for u, d in lengths.items():
            if d == max_distance:
                pairs.append((u, v))
    
    return max_distance, pairs


def aggregate_directed_out_diameter(components: List[nx.DiGraph], exponent: float = 2) -> float:
    """
    Aggregate out-diameter values across components using power-law weighting.
    
    Args:
        components: List of component subgraphs
        exponent: Power-law exponent for weighting (larger components have more influence)
        
    Returns:
        Weighted average of out-diameter values across components
    """
    total_weight = sum(comp.number_of_nodes() ** exponent for comp in components)
    aggregated_value = 0.0
    
    for comp in components:
        weight = comp.number_of_nodes() ** exponent
        out_diam = compute_directed_out_diameter(comp)
        aggregated_value += (weight / total_weight) * out_diam
    
    return aggregated_value


def aggregate_directed_in_diameter(components: List[nx.DiGraph], exponent: float = 2) -> float:
    """
    Aggregate in-diameter values across components using power-law weighting.
    
    Args:
        components: List of component subgraphs
        exponent: Power-law exponent for weighting (larger components have more influence)
        
    Returns:
        Weighted average of in-diameter values across components
    """
    total_weight = sum(comp.number_of_nodes() ** exponent for comp in components)
    aggregated_value = 0.0
    
    for comp in components:
        weight = comp.number_of_nodes() ** exponent
        in_diam = compute_directed_in_diameter(comp)
        aggregated_value += (weight / total_weight) * in_diam
    
    return aggregated_value


# --- Centrality Analysis Functions ---

def compute_in_degree_centrality_metrics(G: nx.DiGraph) -> Dict[str, Any]:
    """
    Compute in-degree centrality metrics for a graph.
    
    Args:
        G: The directed graph
        
    Returns:
        Dictionary containing:
        - node_centralities: Dict mapping node IDs to centrality values
        - average: Average centrality across all nodes
        - variance: Variance of centrality values
        - component_size: Number of nodes in the graph
    """
    centrality = nx.in_degree_centrality(G)
    values = list(centrality.values())
    n = len(values)
    
    if n > 0:
        avg = sum(values) / n
        var = sum((x - avg) ** 2 for x in values) / n
    else:
        avg = 0
        var = 0
    
    return {
        "node_centralities": centrality,
        "average": avg,
        "variance": var,
        "component_size": G.number_of_nodes()
    }


def compute_out_degree_centrality_metrics(G: nx.DiGraph) -> Dict[str, Any]:
    """
    Compute out-degree centrality metrics for a graph.
    
    Args:
        G: The directed graph
        
    Returns:
        Dictionary containing:
        - node_centralities: Dict mapping node IDs to centrality values
        - average: Average centrality across all nodes
        - variance: Variance of centrality values
        - component_size: Number of nodes in the graph
    """
    centrality = nx.out_degree_centrality(G)
    values = list(centrality.values())
    n = len(values)
    
    if n > 0:
        avg = sum(values) / n
        var = sum((x - avg) ** 2 for x in values) / n
    else:
        avg = 0
        var = 0
    
    return {
        "node_centralities": centrality,
        "average": avg,
        "variance": var,
        "component_size": G.number_of_nodes()
    }


def aggregate_in_degree_centrality_metrics(
    components: List[nx.DiGraph], 
    exponent: float = 2
) -> Tuple[float, float, List[Dict[str, Any]]]:
    """
    Aggregate in-degree centrality metrics across components.
    
    Args:
        components: List of component subgraphs
        exponent: Power-law exponent for weighting (larger components have more influence)
        
    Returns:
        Tuple containing:
        - Weighted average of in-degree centrality
        - Weighted variance of in-degree centrality
        - List of component-specific metrics
    """
    total_weight = sum(comp.number_of_nodes() ** exponent for comp in components)
    aggregated_avg = 0.0
    aggregated_var = 0.0
    comp_details = []
    
    for comp in components:
        metrics = compute_in_degree_centrality_metrics(comp)
        weight = comp.number_of_nodes() ** exponent
        aggregated_avg += (weight / total_weight) * metrics["average"]
        aggregated_var += (weight / total_weight) * metrics["variance"]
        comp_details.append(metrics)
    
    return aggregated_avg, aggregated_var, comp_details


def aggregate_out_degree_centrality_metrics(
    components: List[nx.DiGraph], 
    exponent: float = 2
) -> Tuple[float, float, List[Dict[str, Any]]]:
    """
    Aggregate out-degree centrality metrics across components.
    
    Args:
        components: List of component subgraphs
        exponent: Power-law exponent for weighting (larger components have more influence)
        
    Returns:
        Tuple containing:
        - Weighted average of out-degree centrality
        - Weighted variance of out-degree centrality
        - List of component-specific metrics
    """
    total_weight = sum(comp.number_of_nodes() ** exponent for comp in components)
    aggregated_avg = 0.0
    aggregated_var = 0.0
    comp_details = []
    
    for comp in components:
        metrics = compute_out_degree_centrality_metrics(comp)
        weight = comp.number_of_nodes() ** exponent
        aggregated_avg += (weight / total_weight) * metrics["average"]
        aggregated_var += (weight / total_weight) * metrics["variance"]
        comp_details.append(metrics)
    
    return aggregated_avg, aggregated_var, comp_details


# --- Modularity and Community Detection Functions ---

def compute_directed_modularity(G: nx.DiGraph) -> Tuple[float, List[Set[Any]]]:
    """
    Compute a quality measure for directed graph G using leiden and the coverage evaluation.
    
    Args:
        G: The directed graph
        
    Returns:
        Tuple containing:
        - coverage_value: Float score representing the fraction of edges internal to communities
        - communities: List of sets, where each set contains nodes in one community
    """
    if G.number_of_nodes() < 2:
        return 0, []
    
    H = nx.convert_node_labels_to_integers(G, label_attribute="orig_label")
    communities_result = algorithms.leiden(H)
    communities_orig = [set(H.nodes[n]["orig_label"] for n in community)
                        for community in communities_result.communities]
    
    cov = evaluation.conductance(H, communities_result)
    # If cov is a list or tuple, take the average
    if isinstance(cov, (list, tuple)):
        cov = np.mean(cov)
    
    return cov, communities_orig


def compute_weighted_directed_clustering(G: nx.DiGraph) -> float:
    """
    Compute the average size of the largest maximal clique each node belongs to.
    
    This converts the directed graph to undirected, then finds maximal cliques
    and calculates the average of the largest clique size per node.
    
    Args:
        G: The directed graph
        
    Returns:
        Average size of the largest maximal clique per node
    """
    # Convert directed graph to undirected version
    UG = G.to_undirected()
    
    cliques = list(nx.find_cliques(UG))
    # Create a dictionary to store the maximum clique size per node
    max_clique_size = {node: 0 for node in UG.nodes()}
    
    for clique in cliques:
        clique_size = len(clique)
        for node in clique:
            if clique_size > max_clique_size[node]:
                max_clique_size[node] = clique_size
    
    if len(max_clique_size) == 0:
        return 0.0
    
    return sum(max_clique_size.values()) / len(max_clique_size)


def aggregate_directed_modularity(
    components: List[nx.DiGraph], 
    exponent: float = 2
) -> Tuple[float, List[Tuple[float, List[Set[Any]]]]]:
    """
    Aggregate directed modularity values across components using power-law weighting.
    
    Args:
        components: List of component subgraphs
        exponent: Power-law exponent for weighting (larger components have more influence)
        
    Returns:
        Tuple containing:
        - Weighted average of modularity values
        - List of (modularity_value, communities) pairs for each component
    """
    total_weight = sum(comp.number_of_nodes() ** exponent for comp in components)
    aggregated_value = 0.0
    mod_values = []
    
    for comp in components:
        if comp.number_of_nodes() < 2:
            mod_val = 0
            communities = []
        else:
            mod_val, communities = compute_directed_modularity(comp)
        
        mod_values.append((mod_val, communities))
        weight = comp.number_of_nodes() ** exponent
        aggregated_value += (weight / total_weight) * mod_val
    
    return aggregated_value, mod_values


def aggregate_weighted_directed_clustering(
    components: List[nx.DiGraph], 
    exponent: float = 2
) -> Tuple[float, List[float]]:
    """
    Aggregate clustering coefficients across components using power-law weighting.
    
    Args:
        components: List of component subgraphs
        exponent: Power-law exponent for weighting (larger components have more influence)
        
    Returns:
        Tuple containing:
        - Weighted average of clustering coefficients
        - List of clustering coefficients for each component
    """
    total_weight = sum(comp.number_of_nodes() ** exponent for comp in components)
    aggregated_value = 0.0
    clust_values = []
    
    for comp in components:
        if comp.number_of_nodes() < 2:
            cc = 0
        else:
            cc = compute_weighted_directed_clustering(comp)
        
        clust_values.append(cc)
        weight = comp.number_of_nodes() ** exponent
        aggregated_value += (weight / total_weight) * cc
    
    return aggregated_value, clust_values


# --- Entropy Functions ---

def compute_size_entropy(components: List[nx.DiGraph]) -> Tuple[float, Dict[str, float]]:
    """
    Compute the Size Entropy for a list of components.
    
    For each component c(i), compute:
        p(i) = (number of nodes in c(i)) / (total number of nodes)
        entropy(i) = - p(i) * log(p(i))
    The aggregated size entropy is the sum of the entropy values across all components.
    
    Args:
        components: List of component subgraphs
        
    Returns:
        Tuple containing:
        - Aggregated entropy value (sum of all component entropies)
        - Dictionary mapping component IDs to their entropy values
    """
    total_nodes = sum(comp.number_of_nodes() for comp in components)
    entropy_dict = {}
    aggregated_entropy = 0.0
    
    for idx, comp in enumerate(components):
        size = comp.number_of_nodes()
        p = size / total_nodes if total_nodes > 0 else 0
        # Compute entropy with a minus sign. Only compute log if p > 0.
        entropy = -p * math.log(p) if p > 0 else 0
        entropy_dict[f"Component {idx+1} (size {size})"] = entropy
        aggregated_entropy += entropy
    
    return aggregated_entropy, entropy_dict


# --- Full Graph Analysis Functions ---

def analyze_chess_graph(G: nx.DiGraph, name: str = "Graph") -> Dict[str, Any]:
    """
    Perform a comprehensive analysis of a chess influence graph.
    
    Args:
        G: The directed graph to analyze
        name: Name identifier for the graph (e.g., "White", "Black", "Combined")
        
    Returns:
        Dictionary with all computed metrics
    """
    print(f"\n{name} Influence Graph Analysis:")
    
    # Decompose into components
    components = decompose_into_components(G, component_type='weak')
    print(f"  Number of disconnected components: {len(components)}")
    
    # Verify components
    if verify_no_intercomponent_edges(G, components):
        print("  Verified: No inter-component edges.")
    else:
        print("  Error: Inter-component edges detected.")
    
    # Analyze components
    component_metrics = []
    for idx, comp in enumerate(components):
        component_size = comp.number_of_nodes()
        
        # Fiedler value
        fiedler_val = compute_fiedler_value(comp)
        
        # Diameter metrics
        out_diam = compute_directed_out_diameter(comp)
        in_diam = compute_directed_in_diameter(comp)
        out_diam_details, out_paths = compute_directed_out_diameter_details(comp)
        in_diam_details, in_paths = compute_directed_in_diameter_details(comp)
        
        # Modularity
        mod_val, communities = compute_directed_modularity(comp)
        
        # Clustering
        clust_val = compute_weighted_directed_clustering(comp)
        
        # Store component metrics
        component_metrics.append({
            "index": idx,
            "size": component_size,
            "fiedler": fiedler_val,
            "out_diameter": out_diam,
            "in_diameter": in_diam,
            "out_diameter_paths": out_paths,
            "in_diameter_paths": in_paths,
            "modularity": mod_val,
            "communities": communities,
            "community_count": len(communities),
            "clustering": clust_val,
            "nodes": list(comp.nodes())
        })
        
        # Print component details
        print(f"\n  Component {idx+1} (size {component_size}):")
        print(f"    Fiedler Value = {fiedler_val}")
        print(f"    Directed Out-Diameter = {out_diam}, Node pairs = {out_paths[:3]}...")
        print(f"    Directed In-Diameter = {in_diam}, Node pairs = {in_paths[:3]}...")
        print(f"    Modularity = {mod_val}")
        print(f"    Number of communities = {len(communities)}")
        print(f"    Clustering Coefficient = {clust_val}")
    
    # Compute aggregated metrics
    agg_fiedler = aggregate_fiedler_value_power(components)
    agg_out_diam = aggregate_directed_out_diameter(components)
    agg_in_diam = aggregate_directed_in_diameter(components)
    
    # Compute centrality metrics
    agg_in_avg, agg_in_var, in_details = aggregate_in_degree_centrality_metrics(components)
    agg_out_avg, agg_out_var, out_details = aggregate_out_degree_centrality_metrics(components)
    
    # All node centralities
    in_centrality = {}
    out_centrality = {}
    for detail in in_details:
        in_centrality.update(detail["node_centralities"])
    for detail in out_details:
        out_centrality.update(detail["node_centralities"])
    
    # Compute modularity and clustering
    agg_mod, mod_info = aggregate_directed_modularity(components)
    agg_clust, clust_vals = aggregate_weighted_directed_clustering(components)
    
    # Get all communities
    all_communities = []
    for _, communities in mod_info:
        all_communities.extend(communities)
    
    # Compute size entropy
    entropy, entropy_details = compute_size_entropy(components)
    
    # Prepare result dictionary
    results = {
        "name": name,
        "component_count": len(components),
        "node_count": G.number_of_nodes(),
        "edge_count": G.number_of_edges(),
        "components": component_metrics,
        
        # Aggregated metrics
        "fiedler_value": agg_fiedler,
        "out_diameter": agg_out_diam,
        "in_diameter": agg_in_diam,
        
        # Centrality
        "in_degree_avg": agg_in_avg,
        "in_degree_var": agg_in_var,
        "out_degree_avg": agg_out_avg,
        "out_degree_var": agg_out_var,
        "in_centrality": in_centrality,
        "out_centrality": out_centrality,
        
        # Community metrics
        "modularity": agg_mod,
        "communities": all_communities,
        "community_count": len(all_communities),
        "clustering": agg_clust,
        
        # Entropy
        "size_entropy": entropy,
        "entropy_details": entropy_details
    }
    
    # Print aggregated results
    print("\n  Aggregated metrics:")
    print(f"    Fiedler Value: {agg_fiedler}")
    print(f"    Out-Diameter: {agg_out_diam}")
    print(f"    In-Diameter: {agg_in_diam}")
    print(f"    In-Degree Centrality: avg={agg_in_avg}, var={agg_in_var}")
    print(f"    Out-Degree Centrality: avg={agg_out_avg}, var={agg_out_var}")
    print(f"    Modularity: {agg_mod}")
    print(f"    Communities: {len(all_communities)}")
    print(f"    Clustering: {agg_clust}")
    print(f"    Size Entropy: {entropy}")
    
    return results


# --- Main Execution ---

def analyze_position(fen: str) -> Dict[str, Dict[str, Any]]:
    """
    Analyze a chess position and compute metrics for all graph types.
    
    Args:
        fen: The FEN string representing the chess position
        
    Returns:
        Dictionary with analysis results for combined, white, and black graphs
    """
    # Create a chess board from a FEN and compute the positional graph
    board = chess.Board(fen)
    pos_graph = PositionalGraph(board)
    
    # Get all graph types
    combined_graph = pos_graph.compute_combined_influence_graph()
    white_graph = pos_graph.compute_influence_subgraph_by_color(chess.WHITE)
    black_graph = pos_graph.compute_influence_subgraph_by_color(chess.BLACK)
    
    # Analyze each graph type
    combined_metrics = analyze_chess_graph(combined_graph, "Combined")
    white_metrics = analyze_chess_graph(white_graph, "White")
    black_metrics = analyze_chess_graph(black_graph, "Black")
    
    return {
        "combined": combined_metrics,
        "white": white_metrics,
        "black": black_metrics
    }


if __name__ == "__main__":
    # Example FEN string
    fen = "rnbq1rk1/1pp2ppp/3pp3/pP6/2P5/P3PP2/2QP1P1P/R1B1KB1R b KQ - 0 11"
    
    # Run analysis
    results = analyze_position(fen)
    
    # Total number of metrics computed
    metric_count = sum(len(metrics) for metrics in results.values())
    print(f"\nAnalysis complete! Computed {metric_count} metrics across 3 graph types.")