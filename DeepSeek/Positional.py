#!/usr/bin/env python
"""
Enhanced Positional Graph Implementation for Deep Chess Analysis

This module constructs a positional graph that integrates chess theory:
 - Pawn Structure: Each pawn is labeled with roles such as isolated, backward, passed, and chain member.
 - Zone Assignment: Each board square is assigned a zone (center, kingside, queenside) based on chess theory.
 - Other aspects (space control, influence, king safety) remain as before, with material values incorporated.

The module uses python‑chess for board representation, NetworkX for graph construction,
and matplotlib for visualization.
"""

import chess
import networkx as nx
import numpy as np
import matplotlib.pyplot as plt

# ------------------------------------------------------------------------------
# Global Material Values Dictionary
# ------------------------------------------------------------------------------
MATERIAL_VALUES = {
    'P': 1, 'p': 1,
    'N': 3, 'n': 3,
    'B': 3, 'b': 3,
    'R': 5, 'r': 5,
    'Q': 9, 'q': 9,
    'K': 0, 'k': 0  # The king's material value is set to 0.
}

# ------------------------------------------------------------------------------
# Helper Functions for Geometry and Control
# ------------------------------------------------------------------------------

def square_to_coord(square_name):
    """
    Convert a square name (e.g., 'e4') into a (file, rank) tuple (0-indexed).
    """
    file = ord(square_name[0]) - ord('a')
    rank = int(square_name[1]) - 1
    return (file, rank)

def manhattan_distance(coord1, coord2):
    """
    Compute the Manhattan distance between two (file, rank) tuples.
    """
    return abs(coord1[0] - coord2[0]) + abs(coord1[1] - coord2[1])

def control_value(square1, square2):
    """
    A basic control value between two squares.
    (This function can be refined further.)
    """
    return 1

def square_weight(square):
    """
    Assign a weight to a board square based on its strategic importance.
    For example, the four central squares (d4, d5, e4, e5) receive a higher weight.
    """
    central_squares = {"d4", "d5", "e4", "e5"}
    if square in central_squares:
        return 2.0
    file, rank = square_to_coord(square)
    if file == 0 or file == 7 or rank == 0 or rank == 7:
        return 0.5
    return 1.0

def control_factor(board, square, color=chess.WHITE):
    """
    Compute a control factor for a square.
    Instead of simply counting attackers, we sum the material values of all
    attacking pieces from the given side.
    """
    attackers = board.attackers(color, chess.parse_square(square))
    factor = 0
    for sq in attackers:
        piece = board.piece_at(sq)
        if piece is not None:
            factor += MATERIAL_VALUES.get(piece.symbol(), 1)
    return factor

# ------------------------------------------------------------------------------
# Pawn Role Determination Using Chess Theory
# ------------------------------------------------------------------------------

def get_pawn_roles(board, square):
    """
    Determine the roles of a pawn on a given square based on chess theory.
    
    Roles considered:
      - isolated: No friendly pawn exists on any adjacent file.
      - passed: No enemy pawn exists on the same or adjacent files ahead (for white)
                or behind (for black) of the pawn.
      - chain_member: A friendly pawn supports it diagonally from behind.
      - backward: (Heuristic) No friendly pawn exists on an adjacent file on a rank
                  equal to or ahead (for white; reversed for black) of the pawn.
                  
    Returns:
        A list of role strings (one or more of "isolated", "passed", "chain_member", "backward").
    """
    roles = []
    sq_index = chess.parse_square(square)
    piece = board.piece_at(sq_index)
    if piece is None or piece.symbol().lower() != 'p':
        return roles
    color = piece.color
    file_index = chess.square_file(sq_index)
    rank_index = chess.square_rank(sq_index)
    
    # Determine adjacent file indices.
    adjacent_files = []
    if file_index > 0:
        adjacent_files.append(file_index - 1)
    if file_index < 7:
        adjacent_files.append(file_index + 1)
    
    # --- Isolated Pawn ---
    # A pawn is isolated if there is no friendly pawn on any adjacent file.
    isolated = True
    for other_sq in chess.SQUARES:
        if other_sq == sq_index:
            continue
        other_piece = board.piece_at(other_sq)
        if other_piece is not None and other_piece.symbol().lower() == 'p' and other_piece.color == color:
            other_file = chess.square_file(other_sq)
            if other_file in adjacent_files:
                isolated = False
                break
    if isolated:
        roles.append("isolated")
    
    # --- Passed Pawn ---
    # For white: no enemy pawn exists on the same or adjacent files in a higher rank.
    # For black: no enemy pawn exists on the same or adjacent files in a lower rank.
    passed = True
    if color == chess.WHITE:
        for other_sq in chess.SQUARES:
            other_piece = board.piece_at(other_sq)
            if other_piece is not None and other_piece.symbol().lower() == 'p' and other_piece.color != color:
                other_file = chess.square_file(other_sq)
                other_rank = chess.square_rank(other_sq)
                if other_file in ([file_index] + adjacent_files) and other_rank > rank_index:
                    passed = False
                    break
    else:  # Black pawn
        for other_sq in chess.SQUARES:
            other_piece = board.piece_at(other_sq)
            if other_piece is not None and other_piece.symbol().lower() == 'p' and other_piece.color != color:
                other_file = chess.square_file(other_sq)
                other_rank = chess.square_rank(other_sq)
                if other_file in ([file_index] + adjacent_files) and other_rank < rank_index:
                    passed = False
                    break
    if passed:
        roles.append("passed")
    
    # --- Chain Member ---
    # A pawn is considered a chain member if it is supported by a friendly pawn
    # diagonally behind it.
    chain_member = False
    if color == chess.WHITE:
        if rank_index > 0:
            if file_index > 0:
                sq_support = chess.square(file_index - 1, rank_index - 1)
                other_piece = board.piece_at(sq_support)
                if other_piece is not None and other_piece.symbol().lower() == 'p' and other_piece.color == color:
                    chain_member = True
            if file_index < 7:
                sq_support = chess.square(file_index + 1, rank_index - 1)
                other_piece = board.piece_at(sq_support)
                if other_piece is not None and other_piece.symbol().lower() == 'p' and other_piece.color == color:
                    chain_member = True
    else:
        if rank_index < 7:
            if file_index > 0:
                sq_support = chess.square(file_index - 1, rank_index + 1)
                other_piece = board.piece_at(sq_support)
                if other_piece is not None and other_piece.symbol().lower() == 'p' and other_piece.color == color:
                    chain_member = True
            if file_index < 7:
                sq_support = chess.square(file_index + 1, rank_index + 1)
                other_piece = board.piece_at(sq_support)
                if other_piece is not None and other_piece.symbol().lower() == 'p' and other_piece.color == color:
                    chain_member = True
    if chain_member:
        roles.append("chain_member")
    
    # --- Backward Pawn ---
    # A pawn is backward if there is no friendly pawn on adjacent files on the same
    # or a more advanced rank (for white; reversed for black). This is a heuristic.
    backward = False
    if color == chess.WHITE:
        support_found = False
        for other_sq in chess.SQUARES:
            if other_sq == sq_index:
                continue
            other_piece = board.piece_at(other_sq)
            if other_piece is not None and other_piece.symbol().lower() == 'p' and other_piece.color == color:
                other_file = chess.square_file(other_sq)
                other_rank = chess.square_rank(other_sq)
                if other_file in adjacent_files and other_rank >= rank_index:
                    support_found = True
                    break
        if not support_found:
            backward = True
    else:
        support_found = False
        for other_sq in chess.SQUARES:
            if other_sq == sq_index:
                continue
            other_piece = board.piece_at(other_sq)
            if other_piece is not None and other_piece.symbol().lower() == 'p' and other_piece.color == color:
                other_file = chess.square_file(other_sq)
                other_rank = chess.square_rank(other_sq)
                if other_file in adjacent_files and other_rank <= rank_index:
                    support_found = True
                    break
        if not support_found:
            backward = True
    if backward:
        roles.append("backward")
    
    return roles

# ------------------------------------------------------------------------------
# Zone Assignment Using Chess Theory
# ------------------------------------------------------------------------------

def get_zone(square):
    """
    Determine the zone of a board square based on standard chess theory.
    
    The logic is as follows:
      - "center": Squares in the very center (d4, d5, e4, e5).
      - "kingside": For squares not in the center and on files e-h (file index >= 4).
      - "queenside": For squares not in the center and on files a-d (file index <= 3).
    
    Args:
        square (str): The square name (e.g., "e4").
    
    Returns:
        str: A zone label: "center", "kingside", or "queenside".
    """
    file_index, rank_index = square_to_coord(square)
    # Define center as d4, d5, e4, e5 (files 3 and 4, ranks 3 and 4 using 0-indexing)
    if file_index in [3, 4] and rank_index in [3, 4]:
        return "center"
    elif file_index >= 4:
        return "kingside"
    else:
        return "queenside"

# ------------------------------------------------------------------------------
# Main Class: PositionalGraph
# ------------------------------------------------------------------------------

class PositionalGraph:
    def __init__(self, board, zones=None):
        """
        Initialize the positional graph using a python‑chess Board instance.
        Optionally, a dictionary of zones mapping zone names to sets of square names can be provided.
        If not provided, the default is to use the get_zone function to assign each square.
        """
        self.board = board
        self.graph = nx.Graph()
        self.board_squares = [chess.square_name(sq) for sq in chess.SQUARES]
        # If no zones dictionary is provided, generate default zones based on chess theory.
        if zones is None:
            self.zones = {"center": set(), "kingside": set(), "queenside": set()}
            for square in self.board_squares:
                zone_label = get_zone(square)
                self.zones[zone_label].add(square)
        else:
            self.zones = zones
        self._build_graph()

    def _build_graph(self):
        """
        Construct the complete positional graph with nodes and all edge types.
        """
        self._add_board_nodes()
        self._add_pawn_nodes()
        self._add_zone_nodes()
        self._add_adjacency_edges()
        self._add_pawn_support_edges()
        self._add_influence_edges()
        self._add_zone_edges()

    def _add_board_nodes(self):
        """
        Add nodes for each board square.
        """
        for square in self.board_squares:
            self.graph.add_node(square, type="square")

    def _add_pawn_nodes(self):
        """
        Add pawn nodes with annotations about their structural roles.
        Uses get_pawn_roles to determine roles based on chess theory.
        """
        for square in self.board_squares:
            sq = chess.parse_square(square)
            piece = self.board.piece_at(sq)
            if piece is not None and piece.symbol().lower() == 'p':
                roles = get_pawn_roles(self.board, square)
                pawn_node = f"pawn_{square}"
                self.graph.add_node(pawn_node, type="pawn", roles=roles, square=square)

    def _add_zone_nodes(self):
        """
        Add nodes for each zone as defined in self.zones.
        """
        for zone_name in self.zones.keys():
            self.graph.add_node(zone_name, type="zone")

    def _add_adjacency_edges(self):
        """
        Add edges between board squares that are adjacent (Manhattan distance = 1).
        """
        for i, s1 in enumerate(self.board_squares):
            for s2 in self.board_squares[i+1:]:
                coord1 = square_to_coord(s1)
                coord2 = square_to_coord(s2)
                if manhattan_distance(coord1, coord2) == 1:
                    weight = control_value(s1, s2) * (1 + manhattan_distance(coord1, coord2))
                    self.graph.add_edge(s1, s2, type="adjacency", weight=weight)

    def _add_pawn_support_edges(self):
        """
        Add edges representing support between pawns.
        For each pawn, add an edge from the pawn node to the square it supports.
        """
        for square in self.board_squares:
            sq = chess.parse_square(square)
            piece = self.board.piece_at(sq)
            if piece is not None and piece.symbol().lower() == 'p':
                file, rank = square_to_coord(square)
                if piece.color == chess.WHITE:
                    support_coords = [(file - 1, rank + 1), (file + 1, rank + 1)]
                else:
                    support_coords = [(file - 1, rank - 1), (file + 1, rank - 1)]
                for f, r in support_coords:
                    if 0 <= f < 8 and 0 <= r < 8:
                        support_square = chr(ord('a') + f) + str(r + 1)
                        pawn_node = f"pawn_{square}"
                        weight = control_value(square, support_square) * (1 + manhattan_distance((file, rank), (f, r)))
                        self.graph.add_edge(pawn_node, support_square, type="pawn_support", weight=weight)

    def _add_influence_edges(self):
        """
        For each piece on the board, add influence edges from the piece's square
        to each square it attacks. The weight is multiplied by the piece's material value.
        """
        for square in self.board_squares:
            sq = chess.parse_square(square)
            piece = self.board.piece_at(sq)
            if piece is not None:
                material_weight = MATERIAL_VALUES.get(piece.symbol(), 1)
                attacked_squares = [chess.square_name(s) for s in self.board.attacks(sq)]
                for target in attacked_squares:
                    coord1 = square_to_coord(square)
                    coord2 = square_to_coord(target)
                    weight = material_weight * (1 + manhattan_distance(coord1, coord2))
                    self.graph.add_edge(square, target, type="influence", weight=weight)

    def _add_zone_edges(self):
        """
        Connect each board square to its corresponding zone node, as defined by self.zones.
        """
        for square in self.board_squares:
            for zone_name, zone_squares in self.zones.items():
                if square in zone_squares:
                    weight = control_value(square, zone_name)
                    self.graph.add_edge(square, zone_name, type="zone", weight=weight)

    # ------------------------------------------------------------------------------
    # Metric Computation Functions
    # ------------------------------------------------------------------------------

    def compute_pawn_island_count(self):
        """
        Compute the number of pawn islands (disconnected pawn groups).
        """
        pawn_nodes = [n for n, attr in self.graph.nodes(data=True) if attr.get("type") == "pawn"]
        pawn_subgraph = self.graph.subgraph(pawn_nodes)
        islands = list(nx.connected_components(pawn_subgraph))
        return len(islands)

    def compute_passed_pawn_score(self):
        """
        Compute a dummy passed pawn score.
        For each pawn deemed "passed", add a score based on its distance from promotion.
        (A complete version would check for opposing pawn blockages.)
        """
        score = 0.0
        for node, attr in self.graph.nodes(data=True):
            if attr.get("type") == "pawn":
                square = attr.get("square")
                file, rank = square_to_coord(square)
                # Placeholder: Assume a pawn on the 5th rank or beyond is passed.
                if rank >= 4:
                    pawn = self.board.piece_at(chess.parse_square(square))
                    if pawn and pawn.color == chess.WHITE:
                        distance_to_promotion = 7 - rank
                    else:
                        distance_to_promotion = rank
                    score += (8 - distance_to_promotion)
        return score

    def compute_space_score(self, color=chess.WHITE):
        """
        Compute the overall space control score for key squares.
        Sums over the "center" zone using the square weight and control factor.
        """
        central_squares = self.zones.get("center", set())
        score = 0.0
        for square in central_squares:
            w = square_weight(square)
            ctrl = control_factor(self.board, square, color=color)
            score += w * ctrl
        return score

    def compute_shield_index(self, king_square, color=chess.WHITE):
        """
        Compute the shield index for the king.
        Counts the number of friendly pawn nodes in the immediate forward zone.
        """
        king_square_name = chess.square_name(king_square)
        king_file, king_rank = square_to_coord(king_square_name)
        shield_count = 0
        rank_offset = 1 if color == chess.WHITE else -1
        for df in [-1, 0, 1]:
            f = king_file + df
            r = king_rank + rank_offset
            if 0 <= f < 8 and 0 <= r < 8:
                square_str = chr(ord('a') + f) + str(r + 1)
                pawn_node = f"pawn_{square_str}"
                if self.graph.has_node(pawn_node):
                    shield_count += 1
        return shield_count

    def compute_attackers_proximity(self, king_square, color=chess.WHITE):
        """
        Compute the attackers' proximity metric for the king.
        Sums the inverse Manhattan distances from enemy pieces to the king.
        """
        king_coord = square_to_coord(chess.square_name(king_square))
        proximity = 0.0
        enemy_color = not color
        for square in self.board_squares:
            sq = chess.parse_square(square)
            piece = self.board.piece_at(sq)
            if piece is not None and piece.color == enemy_color:
                dist = manhattan_distance(king_coord, square_to_coord(square))
                proximity += 1.0 / (dist + 0.1)
        return proximity

    # ------------------------------------------------------------------------------
    # Graph Visualization
    # ------------------------------------------------------------------------------

    def visualize(self, layout="spring"):
        """
        Visualize the graph using matplotlib.
        Nodes are colored by type and edges by edge type.
        """
        if layout == "spring":
            pos = nx.spring_layout(self.graph, weight="weight")
        elif layout == "circular":
            pos = nx.circular_layout(self.graph)
        else:
            pos = nx.spring_layout(self.graph, weight="weight")

        # Color nodes by type.
        node_colors = []
        for node, attr in self.graph.nodes(data=True):
            if attr.get("type") == "square":
                node_colors.append("lightblue")
            elif attr.get("type") == "pawn":
                node_colors.append("orange")
            elif attr.get("type") == "zone":
                node_colors.append("lightgreen")
            else:
                node_colors.append("gray")

        plt.figure(figsize=(10, 8))
        nx.draw_networkx_nodes(self.graph, pos, node_color=node_colors, node_size=300)
        nx.draw_networkx_labels(self.graph, pos, font_size=8)

        # Draw edges with colors based on edge type.
        edge_types = {
            "adjacency": "black",
            "pawn_support": "red",
            "influence": "purple",
            "zone": "green",
        }
        for etype, color in edge_types.items():
            edgelist = [(u, v) for u, v, d in self.graph.edges(data=True) if d.get("type") == etype]
            nx.draw_networkx_edges(self.graph, pos, edgelist=edgelist, edge_color=color, width=1)

        plt.title("Enhanced Positional Graph with Pawn Roles and Zone Nodes")
        plt.axis("off")
        plt.show()

# ------------------------------------------------------------------------------
# Example Usage
# ------------------------------------------------------------------------------

if __name__ == "__main__":
    # Use the standard starting position FEN.
    fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    board = chess.Board(fen)
    
    # Instantiate the PositionalGraph.
    pos_graph = PositionalGraph(board)
    
    # Compute and print various metrics.
    print("Pawn Island Count:", pos_graph.compute_pawn_island_count())
    print("Passed Pawn Score:", pos_graph.compute_passed_pawn_score())
    print("Space Score:", pos_graph.compute_space_score(color=chess.WHITE))
    
    # For king safety metrics, use the white king's starting square ("e1").
    white_king_sq = chess.parse_square("e1")
    print("Shield Index (White King):", pos_graph.compute_shield_index(white_king_sq, color=chess.WHITE))
    print("Attackers Proximity (White King):", pos_graph.compute_attackers_proximity(white_king_sq, color=chess.WHITE))
    
    # Visualize the enhanced positional graph.
    pos_graph.visualize()
