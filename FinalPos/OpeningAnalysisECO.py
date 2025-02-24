import pandas as pd
import chess
import chess.pgn
from io import StringIO
from cluster_extended_metrics import (
    union_influence_graph,
    compute_extended_influence_metrics,
    PositionalGraph
)

# Read the parquet file (adjust the file path as needed)
df = pd.read_parquet("Openings.parquet")

results = []

# Process each row (each opening) in the parquet file
for idx, row in df.iterrows():
    eco_volume = row["eco-volume"]
    eco = row["eco"]
    name = row["name"]
    pgn_str = row["pgn"]

    # Convert the PGN string to a game using StringIO
    pgn_io = StringIO(pgn_str)
    try:
        game = chess.pgn.read_game(pgn_io)
    except Exception as e:
        print(f"Error reading PGN for {name}: {e}")
        continue

    # Play through the game to reach the final board state
    board = game.board()
    for move in game.mainline_moves():
        board.push(move)

    # Create the positional graph from the final board state
    pos_graph = PositionalGraph(board)

    # Compute overall metrics for Union, White-only, and Black-only graphs

    # Union Influence Graph Metrics
    union_graph = union_influence_graph(pos_graph)
    ext_union = compute_extended_influence_metrics(union_graph)
    overall_union = ext_union.get("overall_component_metrics", {})

    # White-only Influence Graph Metrics
    white_graph = pos_graph.compute_influence_subgraph_by_color(chess.WHITE)
    ext_white = compute_extended_influence_metrics(white_graph)
    overall_white = ext_white.get("overall_component_metrics", {})

    # Black-only Influence Graph Metrics
    black_graph = pos_graph.compute_influence_subgraph_by_color(chess.BLACK)
    ext_black = compute_extended_influence_metrics(black_graph)
    overall_black = ext_black.get("overall_component_metrics", {})

    # Prepare a dictionary with the original details and our 6 metrics per category.
    result = {
        "eco-volume": eco_volume,
        "eco": eco,
        "name": name,
        "pgn": pgn_str,
        # Union Metrics
        "union_diameter": overall_union.get("diameter", 0),
        "union_avg_harmonic_centrality": overall_union.get("avg_harmonic_centrality", 0),
        "union_avg_clustering": overall_union.get("avg_clustering", 0),
        "union_fiedler": overall_union.get("fiedler", 0),
        "union_entropy": ext_union.get("overall_entropy", 0),
        "union_harmonic_centrality_variance": overall_union.get("harmonic_centrality_variance", 0),
        # White Metrics
        "white_diameter": overall_white.get("diameter", 0),
        "white_avg_harmonic_centrality": overall_white.get("avg_harmonic_centrality", 0),
        "white_avg_clustering": overall_white.get("avg_clustering", 0),
        "white_fiedler": overall_white.get("fiedler", 0),
        "white_entropy": ext_white.get("overall_entropy", 0),
        "white_harmonic_centrality_variance": overall_white.get("harmonic_centrality_variance", 0),
        # Black Metrics
        "black_diameter": overall_black.get("diameter", 0),
        "black_avg_harmonic_centrality": overall_black.get("avg_harmonic_centrality", 0),
        "black_avg_clustering": overall_black.get("avg_clustering", 0),
        "black_fiedler": overall_black.get("fiedler", 0),
        "black_entropy": ext_black.get("overall_entropy", 0),
        "black_harmonic_centrality_variance": overall_black.get("harmonic_centrality_variance", 0),
    }
    results.append(result)
    
    # Print statement to indicate which opening has been processed
    print(f"Finished processing: {name}")

# Convert the list of dictionaries to a DataFrame and save as CSV
results_df = pd.DataFrame(results)
results_df.to_csv("final_opening_metrics.csv", index=False)
print("Metrics saved to final_opening_metrics.csv")
