#!/usr/bin/env python
"""
Extended Influence Metrics Module for Chess Analysis

This module extends the existing PositionalGraph framework (from positional_graph.py)
to compute extended influence metrics for disconnected influence graphs. It computes 
component‐wise and zone‐aggregated metrics (including entropy and variance measures) 
for white, black, and their union. It then produces two outputs for each game:
  1. A single comprehensive interactive graph (with six subplots—one per metric) that 
     displays 15 categories of traces. These categories are:
         • Overall – Union, Overall – White, Overall – Black
         • Aggregated – Union, Aggregated – White, Aggregated – Black
         • For each zone (Queenside, Kingside, Center) for each color (Union, White, Black)
     The traces are added with legendgroup names so that toggling a legend item in the Plotly 
     legend will show/hide that category across all subplots simultaneously.
  2. A single comprehensive interactive summary table that shows, for every move, all metric 
     values for every category.
     
For each game in a given PGN, a separate subfolder (e.g., "Game_1", "Game_2", …) is created 
in a user‑specified output directory, and all output HTML files are saved there.

Game header details (White, Black, Date, Opening, Result) are included in the graph titles.

Dependencies:
  - positional_graph.py (contains the PositionalGraph class and helper functions such as get_zone)
  - python-chess, networkx, numpy, math, plotly, os, sys
"""

import os
import sys
import math
import networkx as nx
import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import chess
import chess.pgn

# Import the PositionalGraph class and get_zone from positional_graph.py
from positional_graph import PositionalGraph, get_zone

# === HELPER FUNCTIONS FOR DISCONNECTED GRAPH METRICS ===

def get_connected_components(graph):
    """Return a list of subgraphs corresponding to each connected component."""
    return [graph.subgraph(c).copy() for c in nx.connected_components(graph)]

def compute_components_entropy(graph):
    """Compute the entropy of component sizes for the given graph."""
    components = get_connected_components(graph)
    sizes = [comp.number_of_nodes() for comp in components]
    N = sum(sizes)
    if N == 0:
        return None
    return -sum((s / N) * math.log(s / N) for s in sizes if s > 0)

def compute_harmonic_centrality_variance(graph):
    """Compute the variance of harmonic centrality scores over all nodes."""
    centrality = nx.harmonic_centrality(graph)
    values = np.array(list(centrality.values()))
    if len(values) == 0:
        return None
    return float(np.var(values))

def compute_effective_diameter(component):
    """Compute the effective diameter (max shortest path length) of a connected component."""
    lengths = dict(nx.all_pairs_shortest_path_length(component))
    max_length = 0
    for u in lengths:
        for v in lengths[u]:
            max_length = max(max_length, lengths[u][v])
    return max_length

def compute_component_metrics(component):
    """
    Compute key metrics for a connected component:
      - Effective diameter
      - Average harmonic centrality
      - Average clustering coefficient (weighted)
      - Fiedler value (smallest nonzero eigenvalue of the Laplacian)
      - Number of nodes
    """
    diameter = compute_effective_diameter(component)
    harmonic = nx.harmonic_centrality(component)
    avg_harmonic = np.mean(list(harmonic.values())) if harmonic else None
    avg_clustering = nx.average_clustering(component, weight="weight")
    L = nx.laplacian_matrix(component, weight="weight").todense()
    eigenvalues = np.linalg.eigvalsh(L)
    fiedler = None
    for val in sorted(eigenvalues.tolist()):
        if val > 1e-6:
            fiedler = val
            break
    return {
        "diameter": diameter,
        "avg_harmonic_centrality": avg_harmonic,
        "avg_clustering": avg_clustering,
        "fiedler": fiedler,
        "num_nodes": component.number_of_nodes()
    }

# === ZONE AGGREGATION FUNCTIONS ===

def compute_zone_subgraph(zone, influence_graph):
    """
    Extract the subgraph of influence_graph containing only nodes that belong to the given zone.
    Uses get_zone() on board squares (node names) and pawn nodes (attribute 'square').
    """
    zone_nodes = []
    for node, data in influence_graph.nodes(data=True):
        if data.get("type") == "square":
            if get_zone(node) == zone:
                zone_nodes.append(node)
        elif data.get("type") == "pawn":
            sq = data.get("square")
            if sq and get_zone(sq) == zone:
                zone_nodes.append(node)
    return influence_graph.subgraph(zone_nodes).copy()

def compute_zone_metrics(zone, influence_graph):
    """
    For a given zone, compute aggregated metrics:
      1. Extract the zone subgraph.
      2. Decompose it into connected components.
      3. Compute component metrics for each.
      4. Aggregate the metrics (weighted by component size).
      5. Compute entropy and harmonic centrality variance for the zone.
    """
    zone_subgraph = compute_zone_subgraph(zone, influence_graph)
    components = get_connected_components(zone_subgraph)
    if not components:
        return {"diameter": None, "avg_harmonic_centrality": None, "avg_clustering": None,
                "fiedler": None, "total_nodes": 0, "entropy": None, "harmonic_centrality_variance": None}
    total_nodes = sum(comp.number_of_nodes() for comp in components)
    metrics_list = [compute_component_metrics(comp) for comp in components]
    agg = {"total_nodes": total_nodes}
    for key in ["diameter", "avg_harmonic_centrality", "avg_clustering", "fiedler"]:
        weighted_sum = sum(m[key] * m["num_nodes"] for m in metrics_list if m[key] is not None)
        agg[key] = weighted_sum / total_nodes if total_nodes > 0 else None
    agg["entropy"] = compute_components_entropy(zone_subgraph)
    agg["harmonic_centrality_variance"] = compute_harmonic_centrality_variance(zone_subgraph)
    return agg

def aggregate_zone_metrics(zones_metrics):
    """
    Aggregate metrics from all zones (queenside, kingside, center) into global values using weighted averages.
    """
    total_nodes_all = sum(m["total_nodes"] for m in zones_metrics.values() if m["total_nodes"] is not None)
    global_metrics = {}
    for key in ["diameter", "avg_harmonic_centrality", "avg_clustering", "fiedler", "entropy", "harmonic_centrality_variance"]:
        weighted_sum = sum(m[key] * m["total_nodes"] for m in zones_metrics.values() if m["total_nodes"] and m[key] is not None)
        global_metrics[key] = weighted_sum / total_nodes_all if total_nodes_all > 0 else None
    return global_metrics

# === Helper to Compute Union Influence Graph ===

def union_influence_graph(pos_graph):
    """
    Compute the union influence graph from a PositionalGraph instance by merging the white and black
    influence subgraphs.
    """
    white_inf = pos_graph.compute_influence_subgraph_by_color(chess.WHITE)
    black_inf = pos_graph.compute_influence_subgraph_by_color(chess.BLACK)
    union_inf = nx.Graph()
    union_inf.add_nodes_from(white_inf.nodes(data=True))
    union_inf.add_edges_from(white_inf.edges(data=True))
    union_inf.add_nodes_from(black_inf.nodes(data=True))
    union_inf.add_edges_from(black_inf.edges(data=True))
    return union_inf

# === Extended Influence Metrics Wrapper ===

def compute_extended_influence_metrics(influence_graph):
    """
    Compute extended influence metrics for the entire influence graph.
    Returns a dictionary with:
      - overall_component_metrics: global weighted metrics over all connected components.
      - overall_entropy: entropy of component sizes for the entire graph.
      - overall_centrality_variance: variance of harmonic centrality for the entire graph.
      - zone_metrics: a dict with metrics for queenside, kingside, and center.
      - aggregated_zone_metrics: global aggregated metrics from the zone metrics.
    """
    components = get_connected_components(influence_graph)
    total_nodes = sum(comp.number_of_nodes() for comp in components)
    comp_metrics = [compute_component_metrics(comp) for comp in components]
    overall = {}
    for key in ["diameter", "avg_harmonic_centrality", "avg_clustering", "fiedler"]:
        weighted_sum = sum(m[key] * m["num_nodes"] for m in comp_metrics if m[key] is not None)
        overall[key] = weighted_sum / total_nodes if total_nodes > 0 else None
    overall_entropy = compute_components_entropy(influence_graph)
    overall_centrality_variance = compute_harmonic_centrality_variance(influence_graph)
    
    zones = ["queenside", "kingside", "center"]
    zone_metrics = {}
    for zone in zones:
        zone_metrics[zone] = compute_zone_metrics(zone, influence_graph)
    
    aggregated_zone_metrics = aggregate_zone_metrics(zone_metrics)
    
    return {
        "overall_component_metrics": overall,
        "overall_entropy": overall_entropy,
        "overall_centrality_variance": overall_centrality_variance,
        "zone_metrics": zone_metrics,
        "aggregated_zone_metrics": aggregated_zone_metrics
    }

# === Comprehensive Graph and Summary Table Generation ===

def generate_comprehensive_outputs(game_fens, output_dir, game_info):
    """
    Given a list of FEN strings (one per move), compute extended influence metrics at every move for:
      - The union influence graph (white and black merged)
      - White-only influence graph
      - Black-only influence graph
      
    Then produce two outputs:
      1. A single comprehensive interactive graph that contains six subplots (one per metric).
         In each subplot, exactly 15 unique traces are added representing the following 15 categories:
           • Overall – Union, Overall – White, Overall – Black
           • Aggregated – Union, Aggregated – White, Aggregated – Black
           • Queenside – Union, Queenside – White, Queenside – Black
           • Kingside – Union, Kingside – White, Kingside – Black
           • Center – Union, Center – White, Center – Black
         Each trace is assigned a legendgroup (with the same name across subplots) so that toggling a legend
         item in the shared legend shows/hides that category in every subplot simultaneously.
      2. A single comprehensive interactive summary table that shows, for every move, all metric values for
         every category.
         
    All output HTML files are saved in output_dir.
    
    Returns a dictionary of computed metrics.
    """
    moves = []
    # Define metric keys and labels.
    metric_keys = ["diameter", "avg_harmonic_centrality", "avg_clustering", "fiedler", "entropy", "harmonic_centrality_variance"]
    metric_labels = {
        "diameter": "Diameter",
        "avg_harmonic_centrality": "Average Harmonic Centrality",
        "avg_clustering": "Average Clustering Coefficient",
        "fiedler": "Fiedler Value",
        "entropy": "Component Entropy",
        "harmonic_centrality_variance": "Harmonic Centrality Variance"
    }
    
    # Initialize containers for overall metrics.
    overall_union = {k: [] for k in metric_keys}
    overall_white = {k: [] for k in metric_keys}
    overall_black = {k: [] for k in metric_keys}
    # Aggregated zone metrics.
    agg_union = {k: [] for k in metric_keys}
    agg_white = {k: [] for k in metric_keys}
    agg_black = {k: [] for k in metric_keys}
    # Zone-specific metrics.
    zones = ["queenside", "kingside", "center"]
    zone_union = {zone: {k: [] for k in metric_keys} for zone in zones}
    zone_white = {zone: {k: [] for k in metric_keys} for zone in zones}
    zone_black = {zone: {k: [] for k in metric_keys} for zone in zones}
    
    # Process each move.
    for move_index, fen in enumerate(game_fens, start=1):
        moves.append(move_index)
        board = chess.Board(fen)
        pos_graph = PositionalGraph(board)
        
        # Compute union influence metrics.
        union_inf = union_influence_graph(pos_graph)
        ext_union = compute_extended_influence_metrics(union_inf)
        comp_u = ext_union["overall_component_metrics"]
        overall_union["diameter"].append(comp_u.get("diameter"))
        overall_union["avg_harmonic_centrality"].append(comp_u.get("avg_harmonic_centrality"))
        overall_union["avg_clustering"].append(comp_u.get("avg_clustering"))
        overall_union["fiedler"].append(comp_u.get("fiedler"))
        overall_union["entropy"].append(ext_union.get("overall_entropy"))
        overall_union["harmonic_centrality_variance"].append(ext_union.get("overall_centrality_variance"))
        agg_u = ext_union["aggregated_zone_metrics"]
        for k in metric_keys:
            agg_union[k].append(agg_u.get(k))
        for zone in zones:
            for k in metric_keys:
                zone_union[zone][k].append(ext_union["zone_metrics"].get(zone, {}).get(k))
        
        # Compute white-only influence metrics.
        white_inf = pos_graph.compute_influence_subgraph_by_color(chess.WHITE)
        ext_white = compute_extended_influence_metrics(white_inf)
        comp_w = ext_white["overall_component_metrics"]
        overall_white["diameter"].append(comp_w.get("diameter"))
        overall_white["avg_harmonic_centrality"].append(comp_w.get("avg_harmonic_centrality"))
        overall_white["avg_clustering"].append(comp_w.get("avg_clustering"))
        overall_white["fiedler"].append(comp_w.get("fiedler"))
        overall_white["entropy"].append(ext_white.get("overall_entropy"))
        overall_white["harmonic_centrality_variance"].append(ext_white.get("overall_centrality_variance"))
        agg_w = ext_white["aggregated_zone_metrics"]
        for k in metric_keys:
            agg_white[k].append(agg_w.get(k))
        for zone in zones:
            for k in metric_keys:
                zone_white[zone][k].append(ext_white["zone_metrics"].get(zone, {}).get(k))
        
        # Compute black-only influence metrics.
        black_inf = pos_graph.compute_influence_subgraph_by_color(chess.BLACK)
        ext_black = compute_extended_influence_metrics(black_inf)
        comp_b = ext_black["overall_component_metrics"]
        overall_black["diameter"].append(comp_b.get("diameter"))
        overall_black["avg_harmonic_centrality"].append(comp_b.get("avg_harmonic_centrality"))
        overall_black["avg_clustering"].append(comp_b.get("avg_clustering"))
        overall_black["fiedler"].append(comp_b.get("fiedler"))
        overall_black["entropy"].append(ext_black.get("overall_entropy"))
        overall_black["harmonic_centrality_variance"].append(ext_black.get("overall_centrality_variance"))
        agg_b = ext_black["aggregated_zone_metrics"]
        for k in metric_keys:
            agg_black[k].append(agg_b.get(k))
        for zone in zones:
            for k in metric_keys:
                zone_black[zone][k].append(ext_black["zone_metrics"].get(zone, {}).get(k))
    
    # === Create Comprehensive Graph with 6 Subplots and 15 Unique Legend Groups ===
    fig = make_subplots(rows=2, cols=3, subplot_titles=[metric_labels[k] for k in metric_keys])
    
    # Define the 15 legend groups.
    # Overall categories.
    overall_categories = [
        ("Overall – Union", overall_union),
        ("Overall – White", overall_white),
        ("Overall – Black", overall_black)
    ]
    # Aggregated categories.
    aggregated_categories = [
        ("Aggregated – Union", agg_union),
        ("Aggregated – White", agg_white),
        ("Aggregated – Black", agg_black)
    ]
    # Zone-specific categories.
    zone_categories = []
    for zone in zones:
        zone_label = zone.capitalize()
        zone_categories.append((f"{zone_label} – Union", zone_union[zone]))
        zone_categories.append((f"{zone_label} – White", zone_white[zone]))
        zone_categories.append((f"{zone_label} – Black", zone_black[zone]))
    
    # Combine all 15 categories.
    all_categories = overall_categories + aggregated_categories + zone_categories  # 3 + 3 + 9 = 15

    # Define distinct and aesthetically pleasing colors for each category using a custom palette.
    # Overall and Aggregated categories will use "solid" and "dash" lines respectively,
    # while Zone-specific categories will use "dot" lines.
    legend_styles = {
        "Overall – Union": {"color": "#1f77b4", "dash": "solid"},
        "Overall – White": {"color": "#ff7f0e", "dash": "solid"},
        "Overall – Black": {"color": "#2ca02c", "dash": "solid"},
        "Aggregated – Union": {"color": "#d62728", "dash": "dash"},
        "Aggregated – White": {"color": "#9467bd", "dash": "dash"},
        "Aggregated – Black": {"color": "#8c564b", "dash": "dash"},
        "Queenside – Union": {"color": "#e377c2", "dash": "dot"},
        "Queenside – White": {"color": "#7f7f7f", "dash": "dot"},
        "Queenside – Black": {"color": "#bcbd22", "dash": "dot"},
        "Kingside – Union": {"color": "#17becf", "dash": "dot"},
        "Kingside – White": {"color": "#aec7e8", "dash": "dot"},
        "Kingside – Black": {"color": "#ffbb78", "dash": "dot"},
        "Center – Union": {"color": "#98df8a", "dash": "dot"},
        "Center – White": {"color": "#ff9896", "dash": "dot"},
        "Center – Black": {"color": "#c5b0d5", "dash": "dot"},
    }
    
    # We want the legend to show only one item per category. To do that, we add the trace only once per legend group.
    legend_shown = {}
    
    for i, (row, col) in enumerate([(1,1), (1,2), (1,3), (2,1), (2,2), (2,3)]):
        metric_key = metric_keys[i]
        for (cat_name, cat_data) in all_categories:
            y_data = cat_data.get(metric_key)
            # Add the trace with showlegend True only once per legend group.
            show_legend = False
            if cat_name not in legend_shown:
                show_legend = True
                legend_shown[cat_name] = True
            # Use the legend_styles dict for color and dash style.
            style = legend_styles.get(cat_name, {"color": "black", "dash": "solid"})
            fig.add_trace(go.Scatter(
                x=moves,
                y=y_data,
                mode="lines+markers",
                name=cat_name,
                line=dict(color=style["color"], dash=style["dash"], width=2),
                legendgroup=cat_name,
                showlegend=show_legend
            ), row=row, col=col)
        fig.update_xaxes(title_text="Move Number", row=row, col=col)
        fig.update_yaxes(title_text=metric_labels[metric_key], row=row, col=col)
    
    # Update layout for aesthetics.
    fig.update_layout(
        title=(f"<b>Extended Influence Metrics Over Game Moves</b><br>"
               f"White: {game_info.get('White', 'N/A')} | Black: {game_info.get('Black', 'N/A')} | "
               f"Date: {game_info.get('Date', 'N/A')} | Opening: {game_info.get('Opening', 'N/A')} | "
               f"Result: {game_info.get('Result', 'N/A')}"),
        height=950,
        width=1700,
        legend=dict(orientation="v", x=1.02, y=1, font=dict(size=12)),
        font=dict(family="Helvetica, Arial", size=14, color="black"),
        plot_bgcolor="whitesmoke",
        paper_bgcolor="white",
        margin=dict(l=50, r=200, t=100, b=50)
    )
    
    comp_graph_path = os.path.join(output_dir, "comprehensive_metrics_graph.html")
    fig.write_html(comp_graph_path)
    fig.show()
    
    # === Create a Comprehensive Summary Table ===
    # The table will have one row per move and columns for each metric category.
    table_columns = ["Move"]
    table_data = [moves]
    # For each metric, add columns for Overall and Aggregated for each color, and for each zone.
    for key, label in zip(metric_keys, [metric_labels[k] for k in metric_keys]):
        # Overall.
        table_columns.extend([f"Overall {label} (Union)", f"Overall {label} (White)", f"Overall {label} (Black)"])
        table_data.extend([overall_union[key], overall_white[key], overall_black[key]])
        # Aggregated.
        table_columns.extend([f"Aggregated {label} (Union)", f"Aggregated {label} (White)", f"Aggregated {label} (Black)"])
        table_data.extend([agg_union[key], agg_white[key], agg_black[key]])
        # Zone-specific.
        for zone in zones:
            zone_label = zone.capitalize()
            table_columns.extend([
                f"{zone_label} {label} (Union)",
                f"{zone_label} {label} (White)",
                f"{zone_label} {label} (Black)"
            ])
            table_data.extend([
                zone_union[zone][key],
                zone_white[zone][key],
                zone_black[zone][key]
            ])
    
    table_fig = go.Figure(data=[go.Table(
        header=dict(values=table_columns, fill_color='paleturquoise', align='left', font=dict(size=12)),
        cells=dict(values=table_data, fill_color='lavender', align='left', font=dict(size=12))
    )])
    comp_table_path = os.path.join(output_dir, "comprehensive_summary_table.html")
    table_fig.write_html(comp_table_path)
    table_fig.update_layout(title="<b>Comprehensive Summary Table (All Moves)</b>", height=900, width=1800)
    table_fig.show()
    
    return {
        "moves": moves,
        "overall_union": overall_union,
        "overall_white": overall_white,
        "overall_black": overall_black,
        "agg_union": agg_union,
        "agg_white": agg_white,
        "agg_black": agg_black,
        "zone_union": zone_union,
        "zone_white": zone_white,
        "zone_black": zone_black
    }

# === MAIN BLOCK ===

if __name__ == "__main__":
    # Prompt user for PGN file.
    pgn_path = input("Please enter the path to your game PGN file: ").strip()
    try:
        pgn_file = open(pgn_path)
    except Exception as e:
        print(f"Error opening file: {e}")
        sys.exit(1)
    
    # Read all games from the PGN file.
    games = []
    while True:
        game = chess.pgn.read_game(pgn_file)
        if game is None:
            break
        games.append(game)
    
    if not games:
        print("No games found in the PGN file.")
        sys.exit(1)
    
    print(f"Loaded {len(games)} games from the PGN file.")
    
    # Prompt user for output directory.
    output_base = input("Please enter the output directory to store game results: ").strip()
    if not os.path.isdir(output_base):
        try:
            os.makedirs(output_base, exist_ok=True)
        except Exception as e:
            print(f"Error creating output directory: {e}")
            sys.exit(1)
    
    # Process each game: create subfolder and run analysis.
    for i, game in enumerate(games, start=1):
        game_fens = []
        board = game.board()
        game_fens.append(board.fen())  # starting position
        for move in game.mainline_moves():
            board.push(move)
            game_fens.append(board.fen())
        
        # Create a subfolder for the game.
        game_folder = os.path.join(output_base, f"Game_{i}")
        os.makedirs(game_folder, exist_ok=True)
        
        # Extract game header details.
        game_info = {
            "White": game.headers.get("White", "N/A"),
            "Black": game.headers.get("Black", "N/A"),
            "Date": game.headers.get("Date", "N/A"),
            "Opening": game.headers.get("Opening", "N/A"),
            "Result": game.headers.get("Result", "N/A")
        }
        
        print(f"Processing Game {i}: {len(game_fens)} positions; results will be saved in: {game_folder}")
        generate_comprehensive_outputs(game_fens, game_folder, game_info)
