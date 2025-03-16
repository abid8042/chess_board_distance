#!/usr/bin/env python
"""
pgn_piece_tracker.py

This script reads a PGN file and processes the game move-by-move.
For each move it:
  - Updates the piece tracking information for all pieces (each with a unique ID).
  - Computes directional metrics (aggregate, component, and node-level) for all three influence graphs 
    (combined, white, and black) via directional_metrics.py.
  - Captures a snapshot of the piece tracking data.
  - Transforms the data into an object-based JSON schema that integrates seamlessly with our D3 visualization code.
  
The final JSON file includes:
  - "move_number", "move", "fen"
  - Combined graph data as "graph_nodes" and "graph_edges"
  - White and black graph data as "white_graph_nodes"/"white_graph_edges" and "black_graph_nodes"/"black_graph_edges"
  - Directional metrics for each graph (prefixed with combined_, white_, black_)
  - Piece tracking data as "active_pieces", "inactive_pieces", "captured_pieces", and "promoted_pieces"
  - Global indices for moves and pieces for quick lookup.
  
Update the hard-coded file paths as needed.
"""

import chess
import chess.pgn
import json

from directional_metrics import analyze_position  # Uses directional_metrics.py
from positional_graph import PositionalGraph         # Uses positional_graph.py

# Mapping from chess piece type to a human-readable name.
PIECE_NAMES = {
    chess.PAWN: "pawn",
    chess.KNIGHT: "knight",
    chess.BISHOP: "bishop",
    chess.ROOK: "rook",
    chess.QUEEN: "queen",
    chess.KING: "king"
}

class PieceTracker:
    """
    Maintains a running record of pieces as the game evolves.
    Each piece is tracked by a unique ID and includes information
    about its type, color, current square, and its status:
      - active: On board and its square appears in the influence graph.
      - inactive: On board but not present in the influence graph.
      - captured: Removed from play.
      - promoted: A pawn that promoted (the original pawn is replaced).
    """
    def __init__(self, board):
        self.pieces = {}  # Mapping from piece ID to tracking information.
        self.id_counter = 1
        self.initialize_from_board(board)

    def initialize_from_board(self, board):
        """Initialize tracker with the starting board position."""
        for square, piece in board.piece_map().items():
            pid = f"p{self.id_counter}"
            self.id_counter += 1
            self.pieces[pid] = {
                "id": pid,
                "type": PIECE_NAMES[piece.piece_type],
                "color": "white" if piece.color == chess.WHITE else "black",
                "current_square": chess.square_name(square),
                "status": "active",      # Active at creation.
                "move_created": 0,       # Created at move 0.
                "move_captured": None,   # Not captured yet.
                "promoted": False        # Not promoted initially.
            }

    def update_move(self, board, move, move_number):
        """
        Update tracker for a move.
          - For a normal move, update the moving piece's square.
          - For captures, mark the captured piece as 'captured'.
          - For promotions, mark the original pawn as promoted and create a new piece.
          - For castling, update both the king and the corresponding rook.
        This uses the board state before the move is pushed.
        """
        from_sq = chess.square_name(move.from_square)
        to_sq = chess.square_name(move.to_square)

        # Handle castling: update both king and rook.
        if board.is_castling(move):
            # Update king
            moving_piece_id = None
            for pid, info in self.pieces.items():
                if info["current_square"] == from_sq and info["status"] == "active":
                    moving_piece_id = pid
                    break
            if moving_piece_id is None:
                print(f"Warning: No active king found at {from_sq} for castling move {move}")
            else:
                self.pieces[moving_piece_id]["current_square"] = to_sq

            # Determine rook movement based on castling side.
            if board.is_kingside_castling(move):
                if self.pieces[moving_piece_id]["color"] == "white":
                    rook_from = "h1"
                    rook_to = "f1"
                else:
                    rook_from = "h8"
                    rook_to = "f8"
            elif board.is_queenside_castling(move):
                if self.pieces[moving_piece_id]["color"] == "white":
                    rook_from = "a1"
                    rook_to = "d1"
                else:
                    rook_from = "a8"
                    rook_to = "d8"
            else:
                rook_from, rook_to = None, None

            if rook_from and rook_to:
                rook_piece_id = None
                for pid, info in self.pieces.items():
                    if info["current_square"] == rook_from and info["status"] == "active":
                        rook_piece_id = pid
                        break
                if rook_piece_id is None:
                    print(f"Warning: No active rook found at {rook_from} for castling move {move}")
                else:
                    self.pieces[rook_piece_id]["current_square"] = rook_to
            return  # Finished processing castling move.

        # Normal move processing.
        moving_piece_id = None
        # Locate the moving piece by matching its current square.
        for pid, info in self.pieces.items():
            if info["current_square"] == from_sq and info["status"] == "active":
                moving_piece_id = pid
                break

        if moving_piece_id is None:
            print(f"Warning: No active piece found at {from_sq} for move {move}")
        else:
            # Handle promotions.
            if move.promotion is not None:
                self.pieces[moving_piece_id]["status"] = "promoted"
                self.pieces[moving_piece_id]["move_captured"] = move_number
                pid_new = f"p{self.id_counter}"
                self.id_counter += 1
                self.pieces[pid_new] = {
                    "id": pid_new,
                    "type": PIECE_NAMES[move.promotion],
                    "color": self.pieces[moving_piece_id]["color"],
                    "current_square": to_sq,
                    "status": "active",
                    "move_created": move_number,
                    "move_captured": None,
                    "promoted": True
                }
            else:
                self.pieces[moving_piece_id]["current_square"] = to_sq

        # Handle captures.
        if board.is_capture(move):
            if board.is_en_passant(move):
                if self.pieces[moving_piece_id]["color"] == "white":
                    captured_sq = chess.square_name(move.to_square - 8)
                else:
                    captured_sq = chess.square_name(move.to_square + 8)
            else:
                captured_sq = to_sq
            for pid, info in self.pieces.items():
                if info["current_square"] == captured_sq and info["status"] == "active":
                    info["status"] = "captured"
                    info["move_captured"] = move_number
                    break

    def get_snapshot(self, board):
        """
        Generate a snapshot of piece tracking data.
        Uses PositionalGraph to determine if a piece is 'active' (if its square is present in the influence graph)
        or 'inactive' (if not). Captured and promoted pieces are listed separately.
        """
        pos_graph = PositionalGraph(board)
        influence_nodes = set(pos_graph.graph.nodes())
        snapshot = {"active": [], "inactive": [], "captured": [], "promoted": []}
        for pid, info in self.pieces.items():
            if info["status"] == "captured":
                snapshot["captured"].append(info)
            elif info["status"] == "promoted":
                snapshot["promoted"].append(info)
            else:
                temp = info.copy()
                if info["current_square"] in influence_nodes:
                    temp["status"] = "active"
                    snapshot["active"].append(temp)
                else:
                    temp["status"] = "inactive"
                    snapshot["inactive"].append(temp)
        return snapshot

def convert_graph_info_to_array(graph_info):
    """
    Convert graph info from the array-based format into arrays of objects.
    Expected input format (arrays):
      "nodes": [ [node_id, node_data], ... ]
      "edges": [ [source, target, edge_data], ... ]
    Returns a dictionary:
      {
        "nodes": [ { "id": node_id, ... }, ... ],
        "edges": [ { "source": source, "target": target, ... }, ... ]
      }
    """
    result_nodes = []
    for node_tuple in graph_info.get("nodes", []):
        node_id, node_data = node_tuple
        # Ensure the node object includes its id.
        node_obj = node_data.copy()
        node_obj["id"] = str(node_id)
        result_nodes.append(node_obj)
    result_edges = []
    for edge_tuple in graph_info.get("edges", []):
        source, target, edge_data = edge_tuple
        edge_obj = edge_data.copy()
        edge_obj["source"] = str(source)
        edge_obj["target"] = str(target)
        result_edges.append(edge_obj)
    return {"nodes": result_nodes, "edges": result_edges}

def flatten_move_final(move_record):
    """
    Convert a nested move record into the final flattened format expected by the visualization code.
    Expected output structure:
    {
      "move_number": <int>,
      "move": <SAN move or "start">,
      "fen": <FEN string>,
      "graph_nodes": [ { "id": ..., ... }, ... ],        // Combined graph nodes
      "graph_edges": [ { "source": ..., "target": ..., ... }, ... ],  // Combined graph edges
      "white_graph_nodes": [ ... ],                        // White subgraph nodes
      "white_graph_edges": [ ... ],                        // White subgraph edges
      "black_graph_nodes": [ ... ],                        // Black subgraph nodes
      "black_graph_edges": [ ... ],                        // Black subgraph edges
      "combined_fiedler_value": <float>,
      "combined_out_diameter": <float>,
      "combined_in_diameter": <float>,
      "white_fiedler_value": <float>,
      "white_out_diameter": <float>,
      "white_in_diameter": <float>,
      "black_fiedler_value": <float>,
      "black_out_diameter": <float>,
      "black_in_diameter": <float>,
      "active_pieces": { <piece_id>: <piece_data>, ... },
      "inactive_pieces": { ... },
      "captured_pieces": { ... },
      "promoted_pieces": { ... }
    }
    """
    new_record = {}
    new_record["move_number"] = move_record["move_number"]
    new_record["move"] = move_record["move"]
    new_record["fen"] = move_record["fen"]

    dm = move_record["directional_metrics"]
    # Extract aggregate metrics and output as top-level keys with prefixes.
    for color in ["combined", "white", "black"]:
        aggregates = dm[color]["aggregate_level_metrics"]
        new_record[f"{color}_fiedler_value"] = aggregates.get("fiedler", None)
        new_record[f"{color}_out_diameter"] = aggregates.get("out_diameter", None)
        new_record[f"{color}_in_diameter"] = aggregates.get("in_diameter", None)

    # Convert graph info arrays into arrays of objects.
    for color in ["combined", "white", "black"]:
        graph_info = dm[color].get("graph_info", {})
        converted = convert_graph_info_to_array(graph_info)
        if color == "combined":
            new_record["graph_nodes"] = converted["nodes"]
            new_record["graph_edges"] = converted["edges"]
        elif color == "white":
            new_record["white_graph_nodes"] = converted["nodes"]
            new_record["white_graph_edges"] = converted["edges"]
        elif color == "black":
            new_record["black_graph_nodes"] = converted["nodes"]
            new_record["black_graph_edges"] = converted["edges"]

    # Convert piece tracking lists to objects keyed by piece ID.
    snapshot = move_record["piece_tracking"]
    for category in ["active", "inactive", "captured", "promoted"]:
        new_record[f"{category}_pieces"] = {}
        for piece in snapshot.get(category, []):
            new_record[f"{category}_pieces"][piece["id"]] = piece

    return new_record

def update_global_piece_index(global_index, move_number, snapshot):
    """
    Update the global pieces index with piece tracking data from the current move snapshot.
    For each piece in each category, record:
      - first_seen: the earliest move number it appeared.
      - last_seen: the current move number.
      - status: its most recent status.
    """
    for category in ["active", "inactive", "captured", "promoted"]:
        for piece in snapshot.get(category, []):
            pid = piece["id"]
            if pid not in global_index:
                global_index[pid] = {"first_seen": move_number, "last_seen": move_number, "status": piece["status"]}
            else:
                global_index[pid]["last_seen"] = move_number
                global_index[pid]["status"] = piece["status"]

def process_pgn(pgn_file_path, output_json_path):
    """
    Reads a PGN file and processes the game move-by-move.
    For each move:
      - Updates the piece tracker.
      - Computes directional metrics (for combined, white, and black influence graphs)
        using the board's FEN.
      - Captures a snapshot of the piece tracking data.
      - Stores the nested move record.
    Finally, the moves are converted into a final flattened format using the expected object-based schema,
    and global indices for moves and pieces are built.
    The final JSON has the following top-level keys:
       - "metadata"
       - "moves" (an object keyed by move numbers)
       - "indices"
    """
    moves_data = []
    pieces_index = {}  # Global index for pieces: {piece_id: {first_seen, last_seen, status}}

    with open(pgn_file_path, "r") as pgn_file:
        game = chess.pgn.read_game(pgn_file)
        if game is None:
            print("No game found in the PGN file.")
            return

        board = game.board()
        tracker = PieceTracker(board)
        move_number = 0

        # Process initial board state.
        initial_snapshot = tracker.get_snapshot(board)
        initial_metrics = analyze_position(board.fen())
        nested_record = {
            "move_number": move_number,
            "move": "start",
            "fen": board.fen(),
            "directional_metrics": initial_metrics,
            "piece_tracking": initial_snapshot
        }
        moves_data.append(nested_record)
        update_global_piece_index(pieces_index, move_number, initial_snapshot)

        for move in game.mainline_moves():
            move_number += 1
            move_san = board.san(move)
            tracker.update_move(board, move, move_number)
            board.push(move)
            snapshot = tracker.get_snapshot(board)
            metrics = analyze_position(board.fen())
            nested_record = {
                "move_number": move_number,
                "move": move_san,
                "fen": board.fen(),
                "directional_metrics": metrics,
                "piece_tracking": snapshot
            }
            moves_data.append(nested_record)
            update_global_piece_index(pieces_index, move_number, snapshot)

    # Build moves object keyed by move number (as strings)
    moves_object = {}
    for record in moves_data:
        key = str(record["move_number"])
        moves_object[key] = flatten_move_final(record)

    indices = {
        "moves_by_number": {str(record["move_number"]): str(record["move_number"]) for record in moves_data},
        "pieces_by_id": pieces_index
    }

    final_output = {
        "metadata": {
            "schema_version": "1.0",
            "description": "Flattened chess game analysis with object-based moves, directional metrics, influence graphs, and piece tracking. Formatted for D3 visualization with nodes and edges as objects and indexed for quick lookup."
        },
        "moves": moves_object,
        "indices": indices
    }

    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(final_output, f, indent=2)
    print(f"Analysis complete. Final output written to {output_json_path}")

if __name__ == "__main__":
    # Hard-coded file locations; update these paths as needed.
    pgn_file_path = "dubov_games.pgn"
    output_json_path = "flattened_dubov.json"
    
    process_pgn(pgn_file_path, output_json_path)
