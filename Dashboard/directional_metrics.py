#!/usr/bin/env python
"""
Directional Metrics Module

This module provides functions to analyze directed graphs created from chess positions.
It computes various network metrics including:
- Component decomposition (weak/strong)
- Fiedler values (algebraic connectivity)
- Directed diameters (with detailed paths)
- Centrality measures (in/out degree) -- now using raw degree counts
- Community detection (modularity)
- Clustering coefficients
- Size entropy

These metrics provide insights into the structure of chess influence networks.

Additionally, this version annotates each node with:
- in_degree_centrality and out_degree_centrality (which are now raw in/out degrees)
- in_degree_centrality_variance and out_degree_centrality_variance (global aggregated values)
- community_id (from modularity/community detection)
- component_id (the ID of the component the node belongs to)
- in_degree_component_avg and out_degree_component_avg (the average for the node’s component)
- in_degree_deviation and out_degree_deviation (squared difference from the component mean)

The final output is organized into four parts:
1. Aggregate-Level Metrics
2. Component-Level Metrics
3. Node-Level Metrics
4. Graph Information (Nodes & Edges)

Author: Your Name
Version: 1.0.1 (modified to use raw degrees)
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
    if component_type == 'strong':
        # Use strongly connected components for a directed graph.
        # (In the original code, you used the undirected approach for both strong/weak;
        #  we'll leave it as-is to match your original logic.)
        UG = G.to_undirected()
        components = [G.subgraph(c).copy() for c in nx.connected_components(UG)]
    else:
        # For weak connectivity, convert the directed graph to an undirected graph.
        UG = G.to_undirected()
        components = [G.subgraph(c).copy() for c in nx.connected_components(UG)]
    return components


def verify_no_intercomponent_edges(G: nx.DiGraph, components: List[nx.DiGraph]) -> bool:
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
    if G.number_of_nodes() <= 1:
        return 0
    max_distance = 0
    for u in G.nodes():
        lengths = dict(nx.single_source_shortest_path_length(G, u))
        if lengths:
            max_distance = max(max_distance, max(lengths.values()))
    return max_distance

def compute_directed_in_diameter(G: nx.DiGraph) -> int:
    if G.number_of_nodes() <= 1:
        return 0
    max_distance = 0
    for v in G.nodes():
        lengths = dict(nx.single_target_shortest_path_length(G, v))
        if lengths:
            max_distance = max(max_distance, max(lengths.values()))
    return max_distance

def compute_directed_out_diameter_details(G: nx.DiGraph) -> Tuple[int, List[Tuple[Any, Any]]]:
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
    total_weight = sum(comp.number_of_nodes() ** exponent for comp in components)
    aggregated_value = 0.0
    for comp in components:
        weight = comp.number_of_nodes() ** exponent
        out_diam = compute_directed_out_diameter(comp)
        aggregated_value += (weight / total_weight) * out_diam
    return aggregated_value

def aggregate_directed_in_diameter(components: List[nx.DiGraph], exponent: float = 2) -> float:
    total_weight = sum(comp.number_of_nodes() ** exponent for comp in components)
    aggregated_value = 0.0
    for comp in components:
        weight = comp.number_of_nodes() ** exponent
        in_diam = compute_directed_in_diameter(comp)
        aggregated_value += (weight / total_weight) * in_diam
    return aggregated_value


# --- Centrality Analysis Functions (Now Using Raw Degrees) ---

def compute_in_degree_centrality_metrics(G: nx.DiGraph) -> Dict[str, Any]:
    """
    Previously used 'nx.in_degree_centrality(G)', which normalizes by (n-1).
    Now we compute raw in-degree directly (no normalization).
    
    Only nodes with at least 1 incoming edge are considered "active."
    """
    centrality = {}
    for node in G.nodes():
        # Raw in-degree (integer count of incoming edges).
        centrality[node] = G.in_degree(node)
    
    # Filter to active nodes
    active_nodes = [node for node in G.nodes() if centrality[node] > 0]
    values = [centrality[node] for node in active_nodes]
    n = len(values)
    if n > 0:
        avg = sum(values) / n
        var = sum((x - avg) ** 2 for x in values) / n
    else:
        avg = 0
        var = 0
    return {
        "node_centralities": centrality,   # Now storing raw in-deg in 'node_centralities'
        "average": avg,
        "variance": var,
        "component_size": G.number_of_nodes()
    }

def compute_out_degree_centrality_metrics(G: nx.DiGraph) -> Dict[str, Any]:
    """
    Previously used 'nx.out_degree_centrality(G)', which normalizes by (n-1).
    Now we compute raw out-degree directly (no normalization).
    
    Only nodes with at least 1 outgoing edge are considered "active."
    """
    centrality = {}
    for node in G.nodes():
        # Raw out-degree (integer count of outgoing edges).
        centrality[node] = G.out_degree(node)
    
    active_nodes = [node for node in G.nodes() if centrality[node] > 0]
    values = [centrality[node] for node in active_nodes]
    n = len(values)
    if n > 0:
        avg = sum(values) / n
        var = sum((x - avg) ** 2 for x in values) / n
    else:
        avg = 0
        var = 0
    return {
        "node_centralities": centrality,   # Now storing raw out-deg in 'node_centralities'
        "average": avg,
        "variance": var,
        "component_size": G.number_of_nodes()
    }

def aggregate_in_degree_centrality_metrics(
    components: List[nx.DiGraph], exponent: float = 2
) -> Tuple[float, float, List[Dict[str, Any]]]:
    """
    Aggregate in-degree metrics across components, weighting by (component_size^exponent).
    (We keep the aggregator function the same, but now it processes raw degrees.)
    """
    total_weight = sum(comp.number_of_nodes() ** exponent for comp in components)
    aggregated_avg = 0.0
    aggregated_var = 0.0
    comp_details = []
    for comp in components:
        metrics = compute_in_degree_centrality_metrics(comp)
        weight = comp.number_of_nodes() ** exponent
        if total_weight > 0:
            aggregated_avg += (weight / total_weight) * metrics["average"]
            aggregated_var += (weight / total_weight) * metrics["variance"]
        comp_details.append(metrics)
    return aggregated_avg, aggregated_var, comp_details

def aggregate_out_degree_centrality_metrics(
    components: List[nx.DiGraph], exponent: float = 2
) -> Tuple[float, float, List[Dict[str, Any]]]:
    """
    Aggregate out-degree metrics across components, weighting by (component_size^exponent).
    (Same aggregator logic as before, but now it processes raw degrees.)
    """
    total_weight = sum(comp.number_of_nodes() ** exponent for comp in components)
    aggregated_avg = 0.0
    aggregated_var = 0.0
    comp_details = []
    for comp in components:
        metrics = compute_out_degree_centrality_metrics(comp)
        weight = comp.number_of_nodes() ** exponent
        if total_weight > 0:
            aggregated_avg += (weight / total_weight) * metrics["average"]
            aggregated_var += (weight / total_weight) * metrics["variance"]
        comp_details.append(metrics)
    return aggregated_avg, aggregated_var, comp_details


# --- Modularity and Community Detection Functions ---

def compute_directed_modularity(G: nx.DiGraph) -> Tuple[float, List[Set[Any]]]:
    if G.number_of_nodes() < 2:
        return 0, []
    H = nx.convert_node_labels_to_integers(G, label_attribute="orig_label")
    communities_result = algorithms.leiden(H)
    communities_orig = [set(H.nodes[n]["orig_label"] for n in community)
                        for community in communities_result.communities]
    cov = evaluation.conductance(H, communities_result)
    if isinstance(cov, (list, tuple)):
        cov = np.mean(cov)
    return cov, communities_orig

def compute_weighted_directed_clustering(G: nx.DiGraph) -> float:
    UG = G.to_undirected()
    cliques = list(nx.find_cliques(UG))
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
    components: List[nx.DiGraph], exponent: float = 2
) -> Tuple[float, List[Tuple[float, List[Set[Any]]]]]:
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
    components: List[nx.DiGraph], exponent: float = 2
) -> Tuple[float, List[float]]:
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
    total_nodes = sum(comp.number_of_nodes() for comp in components)
    entropy_dict = {}
    aggregated_entropy = 0.0
    for idx, comp in enumerate(components):
        size = comp.number_of_nodes()
        p = size / total_nodes if total_nodes > 0 else 0
        entropy = -p * math.log(p) if p > 0 else 0
        entropy_dict[f"Component {idx+1} (size {size})"] = entropy
        aggregated_entropy += entropy
    return aggregated_entropy, entropy_dict


# --- Full Graph Analysis Functions ---

def analyze_chess_graph(G: nx.DiGraph, name: str = "Graph") -> Dict[str, Any]:
    print(f"\n{name} Influence Graph Analysis:")
    # Decompose into components
    components = decompose_into_components(G, component_type='weak')
    print(f"  Number of disconnected components: {len(components)}")
    if verify_no_intercomponent_edges(G, components):
        print("  Verified: No inter-component edges.")
    else:
        print("  Error: Inter-component edges detected.")
    
    # Component-level metrics
    component_metrics = []
    # Tag each node with its component id
    for idx, comp in enumerate(components):
        for node in comp.nodes():
            G.nodes[node]["component_id"] = idx
        component_size = comp.number_of_nodes()
        fiedler_val = compute_fiedler_value(comp)
        out_diam = compute_directed_out_diameter(comp)
        in_diam = compute_directed_in_diameter(comp)
        _, out_paths = compute_directed_out_diameter_details(comp)
        _, in_paths = compute_directed_in_diameter_details(comp)
        mod_val, communities = compute_directed_modularity(comp)
        clust_val = compute_weighted_directed_clustering(comp)
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
        print(f"\n  Component {idx+1} (size {component_size}):")
        print(f"    Fiedler Value = {fiedler_val}")
        print(f"    Directed Out-Diameter = {out_diam}, Node pairs = {out_paths[:3]}...")
        print(f"    Directed In-Diameter = {in_diam}, Node pairs = {in_paths[:3]}...")
        print(f"    Modularity = {mod_val}")
        print(f"    Number of communities = {len(communities)}")
        print(f"    Clustering Coefficient = {clust_val}")
    
    # Aggregate-level metrics
    agg_fiedler = aggregate_fiedler_value_power(components)
    agg_out_diam = aggregate_directed_out_diameter(components)
    agg_in_diam = aggregate_directed_in_diameter(components)
    agg_in_avg, agg_in_var, in_details = aggregate_in_degree_centrality_metrics(components)
    agg_out_avg, agg_out_var, out_details = aggregate_out_degree_centrality_metrics(components)
    
    in_centrality = {}
    out_centrality = {}
    for detail in in_details:
        in_centrality.update(detail["node_centralities"])
    for detail in out_details:
        out_centrality.update(detail["node_centralities"])
    
    agg_mod, mod_info = aggregate_directed_modularity(components)
    agg_clust, _ = aggregate_weighted_directed_clustering(components)
    all_communities = []
    for _, communities in mod_info:
        all_communities.extend(communities)
    entropy, entropy_details = compute_size_entropy(components)
    
    # Annotate nodes with global node-level metrics
    community_map = {}
    for cid, community in enumerate(all_communities):
        for node in community:
            community_map[node] = cid
    for node in G.nodes():
        # Now these are raw degrees, but we keep the same field names.
        G.nodes[node]['in_degree_centrality'] = in_centrality.get(node, 0)
        G.nodes[node]['out_degree_centrality'] = out_centrality.get(node, 0)
        
        # We'll keep the same "variance" keys, though they are for raw degrees now.
        G.nodes[node]['in_degree_centrality_variance'] = agg_in_var
        G.nodes[node]['out_degree_centrality_variance'] = agg_out_var
        
        G.nodes[node]['community_id'] = community_map.get(node, -1)
    
    # Annotate each node with component-specific averages and deviations.
    for comp in components:
        local_in_metrics = compute_in_degree_centrality_metrics(comp)
        local_out_metrics = compute_out_degree_centrality_metrics(comp)
        local_avg_in = local_in_metrics["average"]
        local_avg_out = local_out_metrics["average"]
        for node in comp.nodes():
            node_in = in_centrality.get(node, 0)
            node_out = out_centrality.get(node, 0)
            G.nodes[node]["in_degree_component_avg"] = local_avg_in
            G.nodes[node]["in_degree_deviation"] = (node_in - local_avg_in) ** 2
            G.nodes[node]["out_degree_component_avg"] = local_avg_out
            G.nodes[node]["out_degree_deviation"] = (node_out - local_avg_out) ** 2
    
    # Gather complete graph information: nodes and edges
    graph_info = {
        "nodes": list(G.nodes(data=True)),
        "edges": list(G.edges(data=True))
    }
    
    # Structure final results (ordered as Aggregated, Component, Node-Level, Graph Info)
    results = {
        "aggregate_level_metrics": {
            "fiedler_value": agg_fiedler,
            "out_diameter": agg_out_diam,
            "in_diameter": agg_in_diam,
            "in_degree_avg": agg_in_avg,
            "in_degree_var": agg_in_var,
            "out_degree_avg": agg_out_avg,
            "out_degree_var": agg_out_var,
            "modularity": agg_mod,
            "community_count": len(all_communities),
            "clustering": agg_clust,
            "size_entropy": entropy
        },
        "component_level_metrics": component_metrics,
        "node_level_metrics": { node: G.nodes[node] for node in G.nodes() },
        "graph_info": graph_info
    }
    
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


# --- Full Position Analysis Functions ---

def analyze_position(fen: str) -> Dict[str, Dict[str, Any]]:
    board = chess.Board(fen)
    pos_graph = PositionalGraph(board)
    combined_graph = pos_graph.compute_combined_influence_graph()
    white_graph = pos_graph.compute_influence_subgraph_by_color(chess.WHITE)
    black_graph = pos_graph.compute_influence_subgraph_by_color(chess.BLACK)
    combined_metrics = analyze_chess_graph(combined_graph, "Combined")
    white_metrics = analyze_chess_graph(white_graph, "White")
    black_metrics = analyze_chess_graph(black_graph, "Black")
    return {
        "combined": combined_metrics,
        "white": white_metrics,
        "black": black_metrics
    }


if __name__ == "__main__":
    fen = "rnbq1rk1/1pp2ppp/3pp3/pP6/2P5/P3PP2/2QP1P1P/R1B1KB1R b KQ - 0 11"
    results = analyze_position(fen)
    
    # Print final output in the required order:
    print("\n--- Final Output ---")
    for graph_type, metrics in results.items():
        print(f"\n--- {graph_type.upper()} GRAPH METRICS ---")
        print("\nAggregate-Level Metrics:")
        for key, value in metrics["aggregate_level_metrics"].items():
            print(f"{key}: {value}")
        print("\nComponent-Level Metrics:")
        for comp in metrics["component_level_metrics"]:
            print(comp)
        print("\nNode-Level Metrics:")
        for node, data in metrics["node_level_metrics"].items():
            print(f"Node {node}: {data}")
        print("\nGraph Information:")
        print("Nodes:")
        for node_info in metrics["graph_info"]["nodes"]:
            print(node_info)
        print("Edges:")
        for edge_info in metrics["graph_info"]["edges"]:
            print(edge_info)
    
    total_metric_count = 0
    for graph_type, metrics in results.items():
        count = (len(metrics["aggregate_level_metrics"]) +
                 len(metrics["component_level_metrics"]) +
                 len(metrics["node_level_metrics"]) +
                 len(metrics["graph_info"]["nodes"]) +
                 len(metrics["graph_info"]["edges"]))
        total_metric_count += count
    print(f"\nAnalysis complete! Total metric entries printed: {total_metric_count}")
