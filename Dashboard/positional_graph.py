#!/usr/bin/env python
"""
PositionalGraph Module

This module provides functionality to represent chess positions as graphs,
where nodes are squares and directed edges represent potential piece movements.
Both single-color and combined influence graphs can be generated.

Author: Your Name
Version: 1.0.0
Date: March 4, 2025
"""

import os
import chess
import json
import networkx as nx
from typing import Dict, List, Optional, Set, Tuple, Union

class PositionalGraph:
    """
    Creates graph representations of chess positions where nodes are squares
    and directed edges represent potential piece movements.
    
    Attributes:
        board (chess.Board): The chess board position to analyze
        graph (nx.DiGraph): The directed graph representation
        board_squares (List[str]): List of all square names (a1, a2, ... h8)
    """
    
    def __init__(self, board: chess.Board):
        """
        Initialize the graph with a python-chess Board instance.
        
        Args:
            board: A chess.Board object representing a chess position
        """
        self.board = board
        self.graph = nx.DiGraph()  # Directed graph for piece movements
        self.board_squares = [chess.square_name(sq) for sq in chess.SQUARES]
        self._build_graph()
    
    def _build_graph(self) -> None:
        """Build the core graph structure with nodes and influence edges."""
        self._add_board_nodes()
        self._add_influence_edges()
        self._remove_isolated_nodes()
    
    def _add_board_nodes(self) -> None:
        """
        Add a node for each board square with piece information if present.
        
        Each node has attributes:
        - type: Always "square"
        - position: Algebraic notation (e.g., "e4")
        - has_piece: Boolean indicating if a piece is on this square
        
        If a piece is present, additional attributes are added:
        - piece_symbol: The piece symbol (e.g., "K", "p")
        - piece_color: "white" or "black"
        - piece_type: Integer from 1-6 (pawn, knight, bishop, rook, queen, king)
        """
        for square_name in self.board_squares:
            square = chess.parse_square(square_name)
            piece = self.board.piece_at(square)
            
            # Add metadata about the piece on this square (if any)
            node_data = {
                "type": "square",
                "position": square_name,
                "has_piece": piece is not None
            }
            
            if piece:
                node_data["piece_symbol"] = piece.symbol()
                node_data["piece_color"] = "white" if piece.color == chess.WHITE else "black"
                node_data["piece_type"] = piece.piece_type
            
            self.graph.add_node(square_name, **node_data)
    
    def _add_influence_edges(self) -> None:
        """
        Add influence edges for all legal moves from the current position.
        
        For each legal move on the board, adds an edge from the source square to 
        the target square. Edges include piece information from the moving piece.
        This handles both colors regardless of whose turn it is in the position.
        """
        # Store original turn
        original_turn = self.board.turn
        
        # Add influences for both colors regardless of whose turn it is
        for color in [chess.WHITE, chess.BLACK]:
            # Temporarily set the turn to generate legal moves for this color
            self.board.turn = color
            legal_moves = list(self.board.generate_legal_moves())
            
            for move in legal_moves:
                source = chess.square_name(move.from_square)
                target = chess.square_name(move.to_square)
                
                # Get the piece making the move
                piece = self.board.piece_at(move.from_square)
                if piece:
                    # Add edge with piece information for better visualization
                    self.graph.add_edge(
                        source, 
                        target, 
                        type="influence", 
                        weight=1,
                        piece_symbol=piece.symbol(),
                        piece_color="white" if piece.color == chess.WHITE else "black",
                        piece_type=piece.piece_type
                    )
        
        # Restore original turn
        self.board.turn = original_turn
    
    def _remove_isolated_nodes(self) -> None:
        """Remove nodes that do not have any edges (squares not influencing or influenced by any piece)."""
        isolates = list(nx.isolates(self.graph))
        self.graph.remove_nodes_from(isolates)
    
    def compute_influence_subgraph_by_color(self, color: chess.Color) -> nx.DiGraph:
        """
        Compute an influence subgraph for a given color.
        
        This extracts a subgraph that only shows the influence of pieces of a specific color.
        
        Args:
            color: chess.WHITE or chess.BLACK
            
        Returns:
            A NetworkX DiGraph containing only the influence of the specified color's pieces
        """
        board_copy = self.board.copy(stack=False)
        board_copy.turn = color
        subgraph = nx.DiGraph()
        
        # Step 1: Find all legal moves for the specified color
        legal_moves = list(board_copy.generate_legal_moves())
        
        # Step 2: Keep track of all squares we need to include
        source_squares = set()
        target_squares = set()
        
        for move in legal_moves:
            source = chess.square_name(move.from_square)
            target = chess.square_name(move.to_square)
            source_squares.add(source)
            target_squares.add(target)
        
        # Step 3: Add source square nodes (pieces of the specified color)
        for square_name in source_squares:
            square = chess.parse_square(square_name)
            piece = self.board.piece_at(square)
            
            if piece and piece.color == color:
                # Add node data for this piece
                node_data = {
                    "type": "square",
                    "position": square_name,
                    "has_piece": True,
                    "piece_symbol": piece.symbol(),
                    "piece_color": "white" if piece.color == chess.WHITE else "black",
                    "piece_type": piece.piece_type
                }
                subgraph.add_node(square_name, **node_data)
        
        # Step 4: Add target square nodes
        for square_name in target_squares:
            if square_name not in subgraph:
                square = chess.parse_square(square_name)
                piece = self.board.piece_at(square)
                
                node_data = {
                    "type": "square",
                    "position": square_name,
                    "has_piece": piece is not None
                }
                
                if piece:
                    node_data["piece_symbol"] = piece.symbol()
                    node_data["piece_color"] = "white" if piece.color == chess.WHITE else "black"
                    node_data["piece_type"] = piece.piece_type
                
                subgraph.add_node(square_name, **node_data)
        
        # Step 5: Add influence edges for the given color
        for move in legal_moves:
            source = chess.square_name(move.from_square)
            target = chess.square_name(move.to_square)
            
            # Get the piece making the move
            piece = board_copy.piece_at(move.from_square)
            if piece and piece.color == color:
                # Add edge with piece information for better visualization
                subgraph.add_edge(
                    source, 
                    target, 
                    type="influence", 
                    weight=1,
                    piece_symbol=piece.symbol(),
                    piece_color="white" if piece.color == chess.WHITE else "black",
                    piece_type=piece.piece_type
                )
        
        return subgraph
    
    def compute_combined_influence_graph(self) -> nx.DiGraph:
        """
        Compute a comprehensive influence graph that includes influences from both colors.
        
        Returns:
            A NetworkX DiGraph containing influences from both white and black pieces
        """
        # Create a new combined graph
        combined_graph = nx.DiGraph()
        
        # Add all squares from the board to ensure complete coverage
        for square_name in self.board_squares:
            square = chess.parse_square(square_name)
            piece = self.board.piece_at(square)
            
            # Add metadata about the piece on this square (if any)
            node_data = {
                "type": "square",
                "position": square_name,
                "has_piece": piece is not None
            }
            
            if piece:
                node_data["piece_symbol"] = piece.symbol()
                node_data["piece_color"] = "white" if piece.color == chess.WHITE else "black"
                node_data["piece_type"] = piece.piece_type
            
            combined_graph.add_node(square_name, **node_data)
        
        # Process both colors
        for color in [chess.WHITE, chess.BLACK]:
            # Create a temporary board copy and set the turn
            board_copy = self.board.copy(stack=False)
            board_copy.turn = color
            
            # Get all legal moves for this color
            legal_moves = list(board_copy.generate_legal_moves())
            
            # Add edges for each legal move
            for move in legal_moves:
                source = chess.square_name(move.from_square)
                target = chess.square_name(move.to_square)
                
                # Get the piece making the move
                piece = board_copy.piece_at(move.from_square)
                if piece:
                    # Add edge with piece information for better visualization
                    combined_graph.add_edge(
                        source, 
                        target, 
                        type="influence", 
                        weight=1,
                        piece_symbol=piece.symbol(),
                        piece_color="white" if piece.color == chess.WHITE else "black",
                        piece_type=piece.piece_type
                    )
        
        # Remove isolated nodes (squares with no influence connections)
        isolates = list(nx.isolates(combined_graph))
        combined_graph.remove_nodes_from(isolates)
        
        return combined_graph
    
    def compute_square_influence_stats(self) -> Dict:
        """
        Compute statistics about square influences for both colors.
        
        Returns:
            A dictionary with information about:
            - Most influential squares (squares that influence many other squares)
            - Most contested squares (squares that are influenced by pieces of both colors)
            - Most vulnerable squares (squares influenced by many opponent pieces)
        """
        # Create graphs for both colors
        white_graph = self.compute_influence_subgraph_by_color(chess.WHITE)
        black_graph = self.compute_influence_subgraph_by_color(chess.BLACK)
        
        # Get sets of squares influenced by each color
        white_influenced_squares = set()
        black_influenced_squares = set()
        
        for source, target in white_graph.edges():
            white_influenced_squares.add(target)
                
        for source, target in black_graph.edges():
            black_influenced_squares.add(target)
        
        # Find contested squares (influenced by both colors)
        contested_squares = white_influenced_squares.intersection(black_influenced_squares)
        
        # Count outgoing edges (influence) for each square
        white_influence_count = {}
        black_influence_count = {}
        
        for node in white_graph.nodes():
            white_influence_count[node] = white_graph.out_degree(node)
            
        for node in black_graph.nodes():
            black_influence_count[node] = black_graph.out_degree(node)
        
        # Find most influential squares
        most_influential_white = sorted(white_influence_count.items(), key=lambda x: x[1], reverse=True)[:5]
        most_influential_black = sorted(black_influence_count.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # Count incoming edges (vulnerability) for each square
        white_vulnerability = {}
        black_vulnerability = {}
        
        for node in white_graph.nodes():
            black_vulnerability[node] = white_graph.in_degree(node)
            
        for node in black_graph.nodes():
            white_vulnerability[node] = black_graph.in_degree(node)
        
        # Find most vulnerable squares
        most_vulnerable_white = sorted(white_vulnerability.items(), key=lambda x: x[1], reverse=True)[:5]
        most_vulnerable_black = sorted(black_vulnerability.items(), key=lambda x: x[1], reverse=True)[:5]
        
        return {
            "contested_squares": list(contested_squares),
            "most_influential": {
                "white": most_influential_white,
                "black": most_influential_black
            },
            "most_vulnerable": {
                "white": most_vulnerable_white,
                "black": most_vulnerable_black
            }
        }
    
    def export_graph_to_json(self, graph: nx.DiGraph, filename: str) -> None:
        """
        Export a NetworkX graph to a JSON file for visualization.
        
        Args:
            graph: The NetworkX graph to export
            filename: The path to the output JSON file
        """
        nodes_data = []
        for node, attrs in graph.nodes(data=True):
            node_info = {"id": node}
            # Add all node attributes to the exported data
            node_info.update(attrs)
            nodes_data.append(node_info)
            
        links_data = []
        for u, v, d in graph.edges(data=True):
            link_info = {
                "source": u, 
                "target": v, 
                "weight": d.get("weight", 1)
            }
            # Add extra edge attributes if they exist
            if "piece_symbol" in d:
                link_info["piece_symbol"] = d["piece_symbol"]
            if "piece_color" in d:
                link_info["piece_color"] = d["piece_color"]
            if "piece_type" in d:
                link_info["piece_type"] = d["piece_type"]
                
            links_data.append(link_info)
        
        data = {
            "nodes": nodes_data,
            "links": links_data
        }
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        
        # Write to file
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        
        print(f"Exported graph to {filename}")


def export_position_graphs(fen: str, output_dir: str = "data") -> Dict:
    """
    Helper function to export all graph data for a given chess position.
    
    Args:
        fen: The FEN string representing the chess position
        output_dir: Directory to save the output files
        
    Returns:
        A dictionary with information about the exported graphs
    """
    board = chess.Board(fen)
    pos_graph = PositionalGraph(board)
    
    # Export the influence graphs
    white_subgraph = pos_graph.compute_influence_subgraph_by_color(chess.WHITE)
    black_subgraph = pos_graph.compute_influence_subgraph_by_color(chess.BLACK)
    combined_graph = pos_graph.compute_combined_influence_graph()
    
    # Create data directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Export the graphs to JSON
    white_file = os.path.join(output_dir, "influence_white.json")
    black_file = os.path.join(output_dir, "influence_black.json")
    combined_file = os.path.join(output_dir, "overall_influence.json")
    
    pos_graph.export_graph_to_json(white_subgraph, white_file)
    pos_graph.export_graph_to_json(black_subgraph, black_file)
    pos_graph.export_graph_to_json(combined_graph, combined_file)
    
    # Compute and export influence stats
    influence_stats = pos_graph.compute_square_influence_stats()
    stats_file = os.path.join(output_dir, "influence_stats.json")
    
    with open(stats_file, "w", encoding="utf-8") as f:
        json.dump(influence_stats, f, indent=2)
    
    print(f"Exported influence statistics to {stats_file}")
    
    return {
        "white_graph": {
            "nodes": len(white_subgraph.nodes()),
            "edges": len(white_subgraph.edges()),
            "file": white_file
        },
        "black_graph": {
            "nodes": len(black_subgraph.nodes()),
            "edges": len(black_subgraph.edges()),
            "file": black_file
        },
        "combined_graph": {
            "nodes": len(combined_graph.nodes()),
            "edges": len(combined_graph.edges()),
            "file": combined_file
        },
        "stats_file": stats_file
    }


# Example usage
if __name__ == "__main__":
    # Example FEN string
    fen = "rnbq1rk1/1pp2ppp/3pp3/pP6/2P5/P3PP2/2QP1P1P/R1B1KB1R b KQ - 0 11"
    
    # Export graphs
    result = export_position_graphs(fen)
    
    # Print summary
    print("\nExport Summary:")
    print(f"White Graph: {result['white_graph']['nodes']} nodes, {result['white_graph']['edges']} edges")
    print(f"Black Graph: {result['black_graph']['nodes']} nodes, {result['black_graph']['edges']} edges")
    print(f"Combined Graph: {result['combined_graph']['nodes']} nodes, {result['combined_graph']['edges']} edges")