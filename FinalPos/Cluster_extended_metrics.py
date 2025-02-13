import os
import sys
import math
import networkx as nx
import numpy as np
import chess
import chess.pgn
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from community import community_louvain
from positional_graph import PositionalGraph, get_zone  # Import PositionalGraph and get_zone

def compute_fiedler_value(graph):
    if graph.number_of_nodes() == 0:
        return 0.0
    L = nx.laplacian_matrix(graph).todense()
    eigenvalues = np.linalg.eigvalsh(L)
    for val in sorted(eigenvalues):
        if val > 1e-6:
            return val
    return 0.0

def compute_mean_centrality(graph):
    if graph.number_of_nodes() == 0:
        return 0.0
    centrality = nx.harmonic_centrality(graph)
    return np.mean(list(centrality.values())) if centrality else 0.0

def compute_diameter(graph):
    try:
        return nx.diameter(graph)
    except nx.NetworkXError:
        return 0

def compute_clustering_coefficient(graph):
    return nx.average_clustering(graph, weight='weight')

def compute_entropy(probabilities):
    entropy = 0.0
    for p in probabilities:
        if p > 0:
            entropy -= p * math.log2(p)
    return entropy

def cluster_component(component):
    partition = community_louvain.best_partition(component)
    clusters = []
    for cid in set(partition.values()):
        nodes = [n for n, c in partition.items() if c == cid]
        clusters.append(component.subgraph(nodes))
    return clusters

def compute_component_metrics(component):
    return {
        'fiedler': compute_fiedler_value(component),
        'centrality': compute_mean_centrality(component),
        'diameter': compute_diameter(component),
        'clustering': compute_clustering_coefficient(component),
        'size': component.number_of_nodes()
    }

def compute_adjusted_component_metrics(component, component_metrics, clusters):
    component_size = component.number_of_nodes()
    if component_size == 0:
        return {
            'adjusted_fiedler': 0,
            'adjusted_centrality': 0,
            'adjusted_diameter': 0,
            'adjusted_clustering': 0,
            'centrality_variance': 0,
            'cross_entropy_cluster': 0,
            'size': 0
        }
    
    cluster_metrics = [compute_component_metrics(c) for c in clusters]
    cluster_ratios = [c['size'] / component_size for c in cluster_metrics]
    
    # Adjusted Fiedler
    adjusted_fiedler = component_metrics['fiedler'] * sum(r * c['fiedler'] for r, c in zip(cluster_ratios, cluster_metrics))
    
    # Adjusted Centrality
    adjusted_centrality = component_metrics['centrality'] * (1 + sum(
        r * (c['centrality'] - component_metrics['centrality'])**2 
        for r, c in zip(cluster_ratios, cluster_metrics)
    ))
    
    # Adjusted Diameter
    adjusted_diameter = max(component_metrics['diameter'], max(
        c['diameter'] for c in cluster_metrics
    ) if cluster_metrics else component_metrics['diameter'])
    
    # Adjusted Clustering
    adjusted_clustering = component_metrics['clustering'] * community_louvain.modularity(
        partition=community_louvain.best_partition(component),
        graph=component
    )
    
    # Centrality Variance
    total_centralities = list(nx.harmonic_centrality(component).values())
    if not total_centralities:
        centrality_variance = 0.0
    else:
        total_variance = np.var(total_centralities, ddof=1)
        between_var = sum(r * (c['centrality'] - component_metrics['centrality'])**2 
                          for r, c in zip(cluster_ratios, cluster_metrics))
        centrality_variance = between_var / total_variance if total_variance > 0 else 0.0
    
    # Cross Entropy (Clusters)
    cluster_entropy = compute_entropy(cluster_ratios)
    
    return {
        'adjusted_fiedler': adjusted_fiedler,
        'adjusted_centrality': adjusted_centrality,
        'adjusted_diameter': adjusted_diameter,
        'adjusted_clustering': adjusted_clustering,
        'centrality_variance': centrality_variance,
        'cross_entropy_cluster': cluster_entropy,
        'size': component_size
    }

def compute_graph_metrics(graph):
    components = list(nx.connected_components(graph))
    component_subgraphs = [graph.subgraph(c) for c in components]
    total_nodes = graph.number_of_nodes()
    
    if total_nodes == 0:
        return {
            'overall_component_metrics': {
                'adjusted_fiedler': 0,
                'adjusted_centrality': 0,
                'adjusted_diameter': 0,
                'adjusted_clustering': 0,
                'size': 0
            },
            'zone_metrics': {},
            'aggregated_zone_metrics': {},
            'overall_entropy': 0,
            'cross_entropy': 0
        }
    
    # Compute overall component metrics
    overall_component_metrics = {
        'adjusted_fiedler': 0.0,
        'adjusted_centrality': 0.0,
        'adjusted_diameter': 0,
        'adjusted_clustering': 0.0,
        'size': 0
    }
    component_sizes = []
    component_entropies = []
    
    for component in component_subgraphs:
        component_size = component.number_of_nodes()
        comp_metrics = compute_component_metrics(component)
        clusters = cluster_component(component)
        adjusted_metrics = compute_adjusted_component_metrics(component, comp_metrics, clusters)
        overall_component_metrics['adjusted_fiedler'] += adjusted_metrics['adjusted_fiedler'] * (component_size / total_nodes)
        overall_component_metrics['adjusted_centrality'] += adjusted_metrics['adjusted_centrality'] * (component_size / total_nodes)
        overall_component_metrics['adjusted_diameter'] = max(overall_component_metrics['adjusted_diameter'], adjusted_metrics['adjusted_diameter'])
        overall_component_metrics['adjusted_clustering'] += adjusted_metrics['adjusted_clustering'] * (component_size / total_nodes)
        overall_component_metrics['size'] += component_size
        component_sizes.append(component_size)
        component_entropies.append(adjusted_metrics['cross_entropy_cluster'])
    
    # Compute overall entropy
    p_components = np.array(component_sizes) / total_nodes
    overall_entropy = -np.sum(p * np.log2(p) for p in p_components if p > 0)
    
    # Compute zone metrics
    zones = ['queenside', 'kingside', 'center']
    zone_metrics = {}
    for zone in zones:
        zone_subgraph = graph.subgraph([n for n in graph.nodes() if get_zone(n) == zone])
        components = list(nx.connected_components(zone_subgraph))
        zone_component_subgraphs = [zone_subgraph.subgraph(c) for c in components]
        zone_component_metrics = []
        zone_component_sizes = []
        
        for zc in zone_component_subgraphs:
            zc_size = zc.number_of_nodes()
            zc_metrics = compute_component_metrics(zc)
            zc_clusters = cluster_component(zc)
            zc_adjusted = compute_adjusted_component_metrics(zc, zc_metrics, zc_clusters)
            zone_component_metrics.append(zc_adjusted)
            zone_component_sizes.append(zc_size)
        
        total_zone_nodes = sum(zone_component_sizes)
        if total_zone_nodes == 0:
            zone_metrics[zone] = {
                'adjusted_fiedler': 0,
                'adjusted_centrality': 0,
                'adjusted_diameter': 0,
                'adjusted_clustering': 0,
                'size': 0,
                'entropy': 0
            }
        else:
            zone_diameter = max(m['adjusted_diameter'] for m in zone_component_metrics)
            zone_fiedler = sum(m['adjusted_fiedler'] * (s / total_zone_nodes) for m, s in zip(zone_component_metrics, zone_component_sizes))
            zone_centrality = sum(m['adjusted_centrality'] * (s / total_zone_nodes) for m, s in zip(zone_component_metrics, zone_component_sizes))
            zone_clustering = sum(m['adjusted_clustering'] * (s / total_zone_nodes) for m, s in zip(zone_component_metrics, zone_component_sizes))
            zone_entropy = compute_entropy([s / total_zone_nodes for s in zone_component_sizes if s > 0])
            zone_metrics[zone] = {
                'adjusted_fiedler': zone_fiedler,
                'adjusted_centrality': zone_centrality,
                'adjusted_diameter': zone_diameter,
                'adjusted_clustering': zone_clustering,
                'size': total_zone_nodes,
                'entropy': zone_entropy
            }
    
    # Aggregate zone metrics
    aggregated_zone_metrics = {
        'adjusted_fiedler': 0.0,
        'adjusted_centrality': 0.0,
        'adjusted_diameter': 0,
        'adjusted_clustering': 0.0
    }
    total_zone_nodes_all = sum(zone_metrics[zone]['size'] for zone in zones)
    for zone in zones:
        size_ratio = zone_metrics[zone]['size'] / total_zone_nodes_all if total_zone_nodes_all > 0 else 0
        aggregated_zone_metrics['adjusted_fiedler'] += zone_metrics[zone]['adjusted_fiedler'] * size_ratio
        aggregated_zone_metrics['adjusted_centrality'] += zone_metrics[zone]['adjusted_centrality'] * size_ratio
        aggregated_zone_metrics['adjusted_diameter'] = max(aggregated_zone_metrics['adjusted_diameter'], zone_metrics[zone]['adjusted_diameter'])
        aggregated_zone_metrics['adjusted_clustering'] += zone_metrics[zone]['adjusted_clustering'] * size_ratio
    
    # Compute cross-entropy
    cross_entropy = overall_entropy
    for zone in zones:
        zone_size_ratio = zone_metrics[zone]['size'] / total_nodes if total_nodes > 0 else 0
        cross_entropy += zone_size_ratio * zone_metrics[zone]['entropy']
    
    return {
        'overall_component_metrics': overall_component_metrics,
        'zone_metrics': zone_metrics,
        'aggregated_zone_metrics': aggregated_zone_metrics,
        'overall_entropy': overall_entropy,
        'cross_entropy': cross_entropy
    }

def generate_comprehensive_outputs(game_fens, output_dir, game_info):
    metrics = {
        'Overall': {'Union': [], 'White': [], 'Black': []},
        'Aggregated': {'Union': [], 'White': [], 'Black': []},
        'Queenside': {'Union': [], 'White': [], 'Black': []},
        'Kingside': {'Union': [], 'White': [], 'Black': []},
        'Center': {'Union': [], 'White': [], 'Black': []}
    }
    moves = []
    
    for fen in game_fens:
        board = chess.Board(fen)
        pg = PositionalGraph(board)  # Use PositionalGraph from positional_graph module
        white_inf = pg.compute_influence_subgraph_by_color(chess.WHITE)
        black_inf = pg.compute_influence_subgraph_by_color(chess.BLACK)
        union_inf = nx.compose(white_inf, black_inf)
        
        # Compute metrics for each graph
        union_metrics = compute_graph_metrics(union_inf)
        white_metrics = compute_graph_metrics(white_inf)
        black_metrics = compute_graph_metrics(black_inf)
        
        # Collect metrics
        moves.append(len(moves) + 1)
        for category in metrics:
            for color in ['Union', 'White', 'Black']:
                graph_metrics = union_metrics if color == 'Union' else white_metrics if color == 'White' else black_metrics
                if category == 'Overall':
                    metrics[category][color].append([
                        graph_metrics['overall_component_metrics']['adjusted_fiedler'],
                        graph_metrics['overall_component_metrics']['adjusted_centrality'],
                        graph_metrics['overall_component_metrics']['adjusted_diameter'],
                        graph_metrics['overall_component_metrics']['adjusted_clustering'],
                        graph_metrics['overall_component_metrics']['centrality_variance'],
                        graph_metrics['overall_component_metrics']['cross_entropy_cluster']
                    ])
                elif category == 'Aggregated':
                    metrics[category][color].append([
                        graph_metrics['aggregated_zone_metrics']['adjusted_fiedler'],
                        graph_metrics['aggregated_zone_metrics']['adjusted_centrality'],
                        graph_metrics['aggregated_zone_metrics']['adjusted_diameter'],
                        graph_metrics['aggregated_zone_metrics']['adjusted_clustering'],
                        0,  # No variance for aggregated
                        0   # No cluster entropy for aggregated
                    ])
                else:
                    zone = category.lower().capitalize()
                    zone_data = graph_metrics['zone_metrics'].get(zone, {})
                    metrics[category][color].append([
                        zone_data.get('adjusted_fiedler', 0),
                        zone_data.get('adjusted_centrality', 0),
                        zone_data.get('adjusted_diameter', 0),
                        zone_data.get('adjusted_clustering', 0),
                        0,  # No variance for zones
                        0   # No cluster entropy for zones
                    ])
    
    # Create comprehensive graph
    fig = make_subplots(rows=2, cols=3, subplot_titles=[
        'Fiedler Value', 'Centrality', 'Diameter',
        'Clustering', 'Variance', 'Cross Entropy'
    ])
    
    # Define color scheme and styles
    colors = {
        'Overall – Union': '#1f77b4',
        'Overall – White': '#ff7f0e',
        'Overall – Black': '#2ca02c',
        'Aggregated – Union': '#d62728',
        'Aggregated – White': '#9467bd',
        'Aggregated – Black': '#8c564b',
        'Queenside – Union': '#e377c2',
        'Queenside – White': '#7f7f7f',
        'Queenside – Black': '#bcbd22',
        'Kingside – Union': '#17becf',
        'Kingside – White': '#aec7e8',
        'Kingside – Black': '#ffbb78',
        'Center – Union': '#98df8a',
        'Center – White': '#ff9896',
        'Center – Black': '#c5b0d5'
    }
    dash_styles = {
        'Overall': 'solid',
        'Aggregated': 'dash',
        'Queenside': 'dot',
        'Kingside': 'dot',
        'Center': 'dot'
    }
    
    # Add traces to subplots
    metric_names = ['adjusted_fiedler', 'adjusted_centrality', 'adjusted_diameter',
                   'adjusted_clustering', 'centrality_variance', 'cross_entropy_cluster']
    for i, (row, col) in enumerate([(1,1), (1,2), (1,3), (2,1), (2,2), (2,3)]):
        metric = metric_names[i]
        for category in metrics:
            for color in ['Union', 'White', 'Black']:
                trace_name = f"{category} – {color}"
                y_data = [m[i] for m in metrics[category][color]]
                fig.add_trace(go.Scatter(
                    x=moves,
                    y=y_data,
                    name=trace_name,
                    line=dict(color=colors[trace_name], dash=dash_styles[category]),
                    legendgroup=trace_name,
                    showlegend=False if trace_name in fig.data else True
                ), row=row, col=col)
    
    # Update layout
    fig.update_layout(
        title=f"Game Metrics: {game_info.get('White', 'N/A')} vs {game_info.get('Black', 'N/A')}",
        height=900,
        width=1500,
        legend=dict(orientation="v", x=1.05, y=0.5),
        font=dict(size=12),
        plot_bgcolor='white'
    )
    
    # Save and show figure
    fig.write_html(os.path.join(output_dir, 'comprehensive_graph.html'))
    fig.show()

# Example usage
if __name__ == "__main__":
    pgn_path = 'input.pgn'
    output_base = 'output/'
    
    with open(pgn_path) as pgn_file:
        game = chess.pgn.read_game(pgn_file)
        if game:
            game_fens = []
            board = game.board()
            game_fens.append(board.fen())
            for move in game.mainline_moves():
                board.push(move)
                game_fens.append(board.fen())
            
            game_folder = os.path.join(output_base, 'Game_1')
            os.makedirs(game_folder, exist_ok=True)
            generate_comprehensive_outputs(game_fens, game_folder, game.headers)
