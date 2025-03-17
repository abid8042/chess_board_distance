#!/usr/bin/env python
"""
beeswarm_metrics_analysis_side_by_side.py

This script processes a PGN file move-by-move to obtain aggregated graph metrics
for combined, white, and black subgraphs. It then performs HDBSCAN clustering
(no dimensionality reduction), computes dispersion, re-maps clusters by persistence,
and produces six HTML outputs:

  A) "combined_clusters_full_dim.html"
     Parallel coordinates for the combined metrics only.

  B) "white_black_clusters_full_dim.html"
     Parallel coordinates for white+black union, in two rows.

  C) "hyperparameter_tuning_combined.html"
     HDBSCAN hyperparameter tuning heatmaps (1 row, 3 columns).
     Each heatmap has its own color scale and axis labels.

  D) "hyperparameter_tuning_white_black.html"
     Same style hyperparameter tuning for white+black union.

  E) "combined_clusters_1d_beeswarm.html"
     1D MDS beeswarm plot for combined data (includes persistence in legend).

  F) "white_black_clusters_1d_beeswarm.html"
     1D MDS beeswarm plot for white+black union (includes persistence in legend).

All HTML files use Plotly.
"""

import chess
import chess.pgn
import numpy as np
import pandas as pd

import plotly.express as px
import plotly.graph_objects as go
import plotly.io as pio

from sklearn.preprocessing import StandardScaler
from sklearn.manifold import MDS
from sklearn.metrics import pairwise_distances
import hdbscan

# ----------------------------------------
# List of aggregated metric keys
# ----------------------------------------
METRICS = [
    "fiedler_value",
    "out_diameter",
    "in_diameter",
    "in_degree_avg",
    "in_degree_var",
    "out_degree_avg",
    "out_degree_var",
    "modularity",
    "community_count",
    "clustering",
    "size_entropy"
]

# ----------------------------------------
# Step 1: Read PGN and Extract Metrics
# ----------------------------------------
def process_game(pgn_file_path):
    from directional_metrics import analyze_position

    game_data = []
    with open(pgn_file_path, "r") as f:
        game = chess.pgn.read_game(f)
        if game is None:
            print("No game found in the PGN file.")
            return []

        board = game.board()
        move_number = 0
        metrics = analyze_position(board.fen())
        record = {
            "move_number": move_number,
            "fen": board.fen(),
            "combined": metrics["combined"]["aggregate_level_metrics"],
            "white": metrics["white"]["aggregate_level_metrics"],
            "black": metrics["black"]["aggregate_level_metrics"]
        }
        game_data.append(record)

        for move in game.mainline_moves():
            move_number += 1
            board.push(move)
            metrics = analyze_position(board.fen())
            record = {
                "move_number": move_number,
                "fen": board.fen(),
                "combined": metrics["combined"]["aggregate_level_metrics"],
                "white": metrics["white"]["aggregate_level_metrics"],
                "black": metrics["black"]["aggregate_level_metrics"]
            }
            game_data.append(record)
    return game_data

def extract_features(game_data, key):
    features = []
    move_numbers = []
    for record in game_data:
        metrics = record[key]
        row = [metrics.get(m, 0) for m in METRICS]
        features.append(row)
        move_numbers.append(record["move_number"])
    return np.array(features), move_numbers

# ----------------------------------------
# Step 2: Clustering & Dispersion
# ----------------------------------------
def compute_dispersion(features, labels):
    dispersions = np.full(len(features), np.nan)
    unique_labels = np.unique(labels[labels != -1])  # exclude noise
    for lab in unique_labels:
        idx = np.where(labels == lab)[0]
        cluster_points = features[idx]
        centroid = cluster_points.mean(axis=0)
        dists = np.linalg.norm(cluster_points - centroid, axis=1)
        dispersions[idx] = dists
    return dispersions

def sort_clusters_by_persistence(clusterer, labels):
    unique_labels = np.unique(labels[labels != -1])
    persistence = clusterer.cluster_persistence_
    label_pers = {lab: p for lab, p in zip(sorted(unique_labels), persistence)}
    sorted_by_pers = sorted(label_pers.keys(), key=lambda x: label_pers[x], reverse=True)
    mapping = {old_lab: new_lab for new_lab, old_lab in enumerate(sorted_by_pers)}
    new_labels = np.array([mapping[l] if l in mapping else -1 for l in labels])
    return new_labels, label_pers, mapping

def perform_clustering(features):
    scaler = StandardScaler()
    scaled = scaler.fit_transform(features)
    clusterer = hdbscan.HDBSCAN(min_cluster_size=2, min_samples=2)
    labels = clusterer.fit_predict(scaled)
    new_labels, old_label_pers, mapping = sort_clusters_by_persistence(clusterer, labels)
    dispersions = compute_dispersion(features, new_labels)

    new_label_pers = {}
    for old_lab, pers_val in old_label_pers.items():
        new_lab = mapping[old_lab]
        new_label_pers[new_lab] = pers_val

    return new_labels, clusterer, dispersions, new_label_pers

# ----------------------------------------
# Step 3: Parallel Coordinates
# ----------------------------------------
def create_parallel_coordinates_df(features, move_numbers, labels, dispersions, extra_cols=None):
    df = pd.DataFrame(features, columns=METRICS)
    df["move_number"] = move_numbers
    df["cluster"] = labels
    df["dispersion"] = dispersions
    if extra_cols:
        for k, v in extra_cols.items():
            df[k] = v
    return df

def plot_parallel_coordinates(df, title, output_html):
    fig = px.parallel_coordinates(
        df,
        dimensions=METRICS + ["dispersion"],
        color="cluster",
        color_continuous_scale=px.colors.diverging.Tealrose,
        title=title
    )
    fig.write_html(output_html)
    print(f"Parallel coordinates plot saved to {output_html}")

def create_parcoords_trace_from_df(df, trace_name, domain_y):
    dims = []
    for col in METRICS + ["dispersion"]:
        dims.append(dict(label=col, values=df[col]))
    trace = go.Parcoords(
        line=dict(
            color=df["cluster"],
            colorscale="Tealrose",
            showscale=True,
            colorbar=dict(title="Cluster")
        ),
        dimensions=dims,
        domain=dict(y=domain_y),
        name=trace_name
    )
    return trace

def plot_white_black_parcoords_subplots(df_white, df_black, output_html):
    trace_white = create_parcoords_trace_from_df(df_white, "White", [0.55, 1])
    trace_black = create_parcoords_trace_from_df(df_black, "Black", [0, 0.45])
    fig = go.Figure(data=[trace_white, trace_black])
    fig.update_layout(
        title="White and Black Combined Clusters (Full Dimensional; Dispersion Shown)",
        height=800
    )
    fig.write_html(output_html)
    print(f"White/Black parallel coordinates subplot saved to {output_html}")

# ----------------------------------------
# Step 4: Hyperparameter Tuning in 1 Row × 3 Columns
# ----------------------------------------
def hyperparameter_tuning_plot_simplified(features, output_html, mcs_range, ms_range):
    """
    Performs a grid search over min_cluster_size (mcs_range) and min_samples (ms_range)
    for HDBSCAN. Collects:
      - number of clusters (excluding noise)
      - number of noise points
      - average persistence

    Produces a 1-row, 3-column figure:
      Col 1: # of Clusters (Blues)
      Col 2: # of Noise Points (Greens)
      Col 3: Avg Persistence (Reds)

    Each subplot has:
      - Its own colorbar on the right
      - Local min-max range
      - X-axis labeled "min_cluster_size"
      - Y-axis labeled "min_samples"
    """
    scaler = StandardScaler()
    features_scaled = scaler.fit_transform(features)

    # Collect metrics for each (mcs, ms) pair
    results = []
    for mcs in mcs_range:
        for ms in ms_range:
            clust = hdbscan.HDBSCAN(min_cluster_size=mcs, min_samples=ms)
            labels = clust.fit_predict(features_scaled)
            unique_labs = np.unique(labels[labels != -1])
            num_clusters = len(unique_labs)
            num_noise = np.sum(labels == -1)
            if num_clusters > 0 and len(clust.cluster_persistence_) > 0:
                avg_pers = np.mean(clust.cluster_persistence_)
            else:
                avg_pers = 0
            results.append({
                "min_cluster_size": mcs,
                "min_samples": ms,
                "num_clusters": num_clusters,
                "num_noise": num_noise,
                "avg_persistence": avg_pers
            })

    df_res = pd.DataFrame(results)

    # Create pivot tables
    pivot_clusters = df_res.pivot(index="min_samples", columns="min_cluster_size", values="num_clusters")
    pivot_noise = df_res.pivot(index="min_samples", columns="min_cluster_size", values="num_noise")
    pivot_pers = df_res.pivot(index="min_samples", columns="min_cluster_size", values="avg_persistence")

    # Compute local min/max for each metric
    zmin_clusters, zmax_clusters = pivot_clusters.min().min(), pivot_clusters.max().max()
    zmin_noise, zmax_noise = pivot_noise.min().min(), pivot_noise.max().max()
    zmin_pers, zmax_pers = pivot_pers.min().min(), pivot_pers.max().max()

    # Create a single row, 3-column layout
    from plotly.subplots import make_subplots
    fig = make_subplots(
        rows=1, cols=3,
        subplot_titles=["Number of Clusters", "Number of Noise Points", "Average Persistence"],
        horizontal_spacing=0.07,  # spacing between subplots
        vertical_spacing=0.0      # only 1 row, so no vertical spacing
    )

    # 1) Number of Clusters (left subplot)
    heatmap_clusters = go.Heatmap(
        z=pivot_clusters.values,
        x=list(pivot_clusters.columns),
        y=list(pivot_clusters.index),
        colorscale="Blues",
        zmin=zmin_clusters,
        zmax=zmax_clusters,
        colorbar=dict(
            title="Clusters",
            x=0.30,   # shift colorbar near left subplot
            y=0.5,
            len=0.8
        ),
        showscale=True
    )
    fig.add_trace(heatmap_clusters, row=1, col=1)

    # 2) Number of Noise Points (middle subplot)
    heatmap_noise = go.Heatmap(
        z=pivot_noise.values,
        x=list(pivot_noise.columns),
        y=list(pivot_noise.index),
        colorscale="Greens",
        zmin=zmin_noise,
        zmax=zmax_noise,
        colorbar=dict(
            title="Noise",
            x=0.66,   # shift colorbar near middle subplot
            y=0.5,
            len=0.8
        ),
        showscale=True
    )
    fig.add_trace(heatmap_noise, row=1, col=2)

    # 3) Average Persistence (right subplot)
    heatmap_pers = go.Heatmap(
        z=pivot_pers.values,
        x=list(pivot_pers.columns),
        y=list(pivot_pers.index),
        colorscale="Reds",
        zmin=zmin_pers,
        zmax=zmax_pers,
        colorbar=dict(
            title="Persistence",
            x=1.02,  # shift colorbar near right subplot
            y=0.5,
            len=0.8
        ),
        showscale=True
    )
    fig.add_trace(heatmap_pers, row=1, col=3)

    # Axis labels for each subplot
    # x-axis = min_cluster_size, y-axis = min_samples
    fig.update_xaxes(title_text="min_cluster_size", row=1, col=1)
    fig.update_xaxes(title_text="min_cluster_size", row=1, col=2)
    fig.update_xaxes(title_text="min_cluster_size", row=1, col=3)

    fig.update_yaxes(title_text="min_samples", row=1, col=1)
    # If you want the same label repeated on each subplot, uncomment below:
    # fig.update_yaxes(title_text="min_samples", row=1, col=2)
    # fig.update_yaxes(title_text="min_samples", row=1, col=3)
    # Typically, we show the y-axis label only on the left subplot in a row.

    fig.update_layout(
        title="Hyperparameter Tuning for HDBSCAN",
        margin=dict(b=60),
        height=500,
        width=1300
    )

    fig.write_html(output_html)
    print(f"Simplified hyperparameter tuning plot saved to {output_html}")

# ----------------------------------------
# Step 5: 1D MDS Beeswarm
# ----------------------------------------
def plot_clusters_in_1d_mds_beeswarm(features,
                                     labels,
                                     move_numbers,
                                     subgraph=None,
                                     output_html="clusters_1d_beeswarm.html",
                                     title="1D MDS Beeswarm Plot",
                                     label_pers=None):
    dist_matrix = pairwise_distances(features, metric="euclidean")
    mds = MDS(n_components=1, dissimilarity='precomputed', random_state=42)
    embedding_1d = mds.fit_transform(dist_matrix).ravel()

    unique_labels = np.unique(labels)
    cluster_map = {}
    g_index = 1
    for lab in unique_labels:
        if lab == -1:
            cluster_map[lab] = "Noise"
        else:
            cluster_map[lab] = f"G{g_index}"
            g_index += 1

    fig = go.Figure()
    for i, lab in enumerate(unique_labels):
        mask = (labels == lab)
        cluster_vals = embedding_1d[mask]
        x_vals = np.random.uniform(-0.2, 0.2, size=len(cluster_vals)) + (i+1)

        if subgraph is not None:
            hover_texts = [f"Move {mn} - {sg}" for mn, sg in zip(np.array(move_numbers)[mask],
                                                                 np.array(subgraph)[mask])]
        else:
            hover_texts = [f"Move {mn}" for mn in np.array(move_numbers)[mask]]

        name_str = cluster_map[lab]
        if (label_pers is not None) and (lab in label_pers) and (lab != -1):
            name_str += f" [p={label_pers[lab]:.3f}]"

        fig.add_trace(
            go.Scatter(
                x=x_vals,
                y=cluster_vals,
                mode='markers',
                name=name_str,
                text=hover_texts,
                hovertemplate="%{text}<extra></extra>"
            )
        )

    x_tickvals = [i+1 for i in range(len(unique_labels))]
    x_ticktext = [cluster_map[lab] for lab in unique_labels]

    fig.update_layout(
        title=title,
        xaxis=dict(
            tickmode='array',
            tickvals=x_tickvals,
            ticktext=x_ticktext
        ),
        yaxis=dict(title="MDS Dimension (1D)"),
        width=900,
        height=700
    )

    fig.write_html(output_html)
    print(f"1D MDS beeswarm cluster plot saved to {output_html}")

# ----------------------------------------
# Main
# ----------------------------------------
def main(pgn_file_path):
    game_data = process_game(pgn_file_path)
    if not game_data:
        return

    # Combined
    combined_features, move_numbers = extract_features(game_data, "combined")
    combined_labels, combined_clusterer, combined_dispersions, combined_label_pers = perform_clustering(combined_features)
    combined_df = create_parallel_coordinates_df(
        combined_features, move_numbers, combined_labels, combined_dispersions
    )
    plot_parallel_coordinates(
        combined_df,
        "Combined Metrics Clusters (Full Dimensional; Dispersion Shown)",
        "combined_clusters_full_dim.html"
    )

    # White + Black union
    white_features, move_numbers_white = extract_features(game_data, "white")
    black_features, move_numbers_black = extract_features(game_data, "black")

    df_white = pd.DataFrame(white_features, columns=METRICS)
    df_white["move_number"] = move_numbers_white
    df_white["subgraph"] = "white"

    df_black = pd.DataFrame(black_features, columns=METRICS)
    df_black["move_number"] = move_numbers_black
    df_black["subgraph"] = "black"

    wb_union_df = pd.concat([df_white, df_black], ignore_index=True)
    wb_union_features = wb_union_df[METRICS].values
    wb_labels, wb_clusterer, wb_dispersions, wb_label_pers = perform_clustering(wb_union_features)

    wb_union_df["cluster"] = wb_labels
    wb_union_df["dispersion"] = wb_dispersions

    df_white_union = wb_union_df[wb_union_df["subgraph"] == "white"]
    df_black_union = wb_union_df[wb_union_df["subgraph"] == "black"]

    plot_white_black_parcoords_subplots(
        df_white_union, df_black_union, "white_black_clusters_full_dim.html"
    )

    # Hyperparameter tuning in 1 row, 3 columns
    mcs_range = range(2, 11)
    ms_range = range(2, 11)

    hyperparameter_tuning_plot_simplified(
        combined_features,
        "hyperparameter_tuning_combined.html",
        mcs_range,
        ms_range
    )
    hyperparameter_tuning_plot_simplified(
        wb_union_features,
        "hyperparameter_tuning_white_black.html",
        mcs_range,
        ms_range
    )

    # Beeswarm combined
    plot_clusters_in_1d_mds_beeswarm(
        features=combined_features,
        labels=combined_labels,
        move_numbers=move_numbers,
        subgraph=None,
        output_html="combined_clusters_1d_beeswarm.html",
        title="Combined Metrics: 1D MDS Beeswarm Plot",
        label_pers=combined_label_pers
    )

    # Beeswarm white+black
    subgraph_list = wb_union_df["subgraph"].tolist()
    move_nums_list = wb_union_df["move_number"].tolist()
    plot_clusters_in_1d_mds_beeswarm(
        features=wb_union_features,
        labels=wb_labels,
        move_numbers=move_nums_list,
        subgraph=subgraph_list,
        output_html="white_black_clusters_1d_beeswarm.html",
        title="White+Black Union: 1D MDS Beeswarm Plot",
        label_pers=wb_label_pers
    )

PGN_FILE = "alphazero_stockfish_2018.pgn"

if __name__ == "__main__":
    main(PGN_FILE)
