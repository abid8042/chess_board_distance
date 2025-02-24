import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.manifold import TSNE
from sklearn.decomposition import PCA
import hdbscan
import plotly.express as px

# --- Step 1: Load Data and Create Unique Identifier ---
df = pd.read_csv("final_opening_metrics.csv")
df["unique_id"] = df["eco"].astype(str) + "_" + df["name"]

# --- Step 2: Extract Overall Union Metrics and Standardize ---
features = [
    "union_avg_harmonic_centrality",
    "union_avg_clustering",
    "union_fiedler",
    "union_entropy",
    "union_harmonic_centrality_variance"
]
X = df[features].values
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# --- Step 3: Run HDBSCAN Clustering ---
# Use min_cluster_size and min_samples both set to 2
clusterer = hdbscan.HDBSCAN(min_cluster_size=2, min_samples=2)
df["hdbscan_cluster"] = clusterer.fit_predict(X_scaled)
df["membership_prob"] = clusterer.probabilities_

print("HDBSCAN Clustering Summary:")
print(f"  Number of clusters (excluding noise): {len(set(df['hdbscan_cluster'])) - (1 if -1 in df['hdbscan_cluster'].values else 0)}")
print(f"  Number of noise points: {list(df['hdbscan_cluster']).count(-1)}")
print(f"  Average membership probability: {df['membership_prob'].mean():.3f}")

# Select the desired columns and rename them as needed:
final_columns = {
    "eco": "eco",
    "name": "name",
    "pgn": "pgn",
    "hdbscan_cluster": "cluster_ID",
    "membership_prob": "probabilities"
}

# Create a new DataFrame with the selected columns and rename them
final_df = df[list(final_columns.keys())].rename(columns=final_columns)

# Save the new DataFrame as a CSV file
final_df.to_csv("final_clustered_results.csv", index=False)
print("Final clustered results saved as 'final_clustered_results.csv'.")

# ---------------------------
# Output 1: 3D t-SNE Plot
# ---------------------------
# Run t-SNE with n_components=3 and 1000 iterations.
tsne = TSNE(n_components=3, n_iter=1000, perplexity=30, random_state=42)
X_tsne = tsne.fit_transform(X_scaled)
df["tsne1"] = X_tsne[:, 0]
df["tsne2"] = X_tsne[:, 1]
df["tsne3"] = X_tsne[:, 2]

# Create interactive 3D scatter plot with Plotly Express.
fig_tsne = px.scatter_3d(
    df,
    x="tsne1",
    y="tsne2",
    z="tsne3",
    color="hdbscan_cluster",
    size="membership_prob",  # Larger markers indicate higher membership probability.
    hover_data=["unique_id", "membership_prob"],
    title="3D t-SNE Embedding (1000 iterations) of Overall Union Metrics",
    labels={"hdbscan_cluster": "Cluster"}
)
fig_tsne.update_traces(marker=dict(opacity=0.8))
fig_tsne.write_html("3d_tsne.html")
print("3D t-SNE plot saved as '3d_tsne.html'.")

# ---------------------------
# Output 2: HDBSCAN Interactive Plot
# ---------------------------
# Here we use a 3D PCA embedding to visualize the HDBSCAN clustering.
pca_for_hdbscan = PCA(n_components=3)
X_pca_hdbscan = pca_for_hdbscan.fit_transform(X_scaled)
df["pca_hdb1"] = X_pca_hdbscan[:, 0]
df["pca_hdb2"] = X_pca_hdbscan[:, 1]
df["pca_hdb3"] = X_pca_hdbscan[:, 2]

fig_hdb = px.scatter_3d(
    df,
    x="pca_hdb1",
    y="pca_hdb2",
    z="pca_hdb3",
    color="hdbscan_cluster",
    size="membership_prob",
    hover_data=["unique_id", "membership_prob"],
    title="HDBSCAN Clustering Visualized in PCA 3D Space",
    labels={"hdbscan_cluster": "Cluster"}
)
fig_hdb.update_traces(marker=dict(opacity=0.8))
fig_hdb.write_html("hdbscan_interactive.html")
print("HDBSCAN interactive plot saved as 'hdbscan_interactive.html'.")

# ---------------------------
# Output 3: 3D PCA Plot
# ---------------------------
# Compute PCA (3 components) for the overall union metrics.
pca = PCA(n_components=3)
X_pca = pca.fit_transform(X_scaled)
df["pca1"] = X_pca[:, 0]
df["pca2"] = X_pca[:, 1]
df["pca3"] = X_pca[:, 2]

fig_pca = px.scatter_3d(
    df,
    x="pca1",
    y="pca2",
    z="pca3",
    color="hdbscan_cluster",  # Optionally, you can color by ECO or any other attribute.
    hover_data=["unique_id", "membership_prob"],
    title="3D PCA Plot of Overall Union Metrics",
    labels={"hdbscan_cluster": "Cluster"}
)
fig_pca.update_traces(marker=dict(opacity=0.8))
fig_pca.write_html("3d_pca.html")
print("3D PCA plot saved as '3d_pca.html'.")
