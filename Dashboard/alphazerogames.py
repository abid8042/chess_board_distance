import requests
from bs4 import BeautifulSoup
import time
import os

# Common headers to mimic a browser.
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/115.0.0.0 Safari/537.36"
    )
}

def fetch_url(url):
    """Fetch the content at the specified URL using our custom headers."""
    response = requests.get(url, headers=HEADERS)
    response.raise_for_status()
    return response.text

def parse_game_detail_links(listing_html):
    """
    From a listing page's HTML, extract links to game detail pages.
    We look for anchor tags that contain "chessgame?gid=" in their href.
    """
    soup = BeautifulSoup(listing_html, "html.parser")
    links = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "chessgame?gid=" in href:
            # Build an absolute URL if needed.
            if not href.startswith("http"):
                href = "https://www.chessgames.com" + href
            links.add(href)
    return list(links)

def extract_pgn_from_game_page(game_html):
    """
    From the HTML of an individual game page, locate the <div id="olga-data">
    element and extract its "pgn" attribute.
    """
    soup = BeautifulSoup(game_html, "html.parser")
    olga_div = soup.find("div", id="olga-data")
    if olga_div and olga_div.has_attr("pgn"):
        return olga_div["pgn"].strip()
    return None

def fetch_and_save_game_pgn(game_url, output_file):
    """
    Fetch an individual game detail page, extract the PGN data, and append it to the file.
    """
    try:
        print(f"  Fetching game page: {game_url}")
        game_html = fetch_url(game_url)
        pgn_data = extract_pgn_from_game_page(game_html)
        if pgn_data:
            with open(output_file, "a", encoding="utf-8") as f:
                f.write(pgn_data + "\n\n")
            print("  PGN data extracted and saved.")
        else:
            print("  No PGN data found on this page.")
    except Exception as e:
        print(f"  Error fetching or parsing {game_url}: {e}")

def main():
    # Listing page URL parameters.
    base_listing_url = "https://www.chessgames.com/perl/chess.pl"
    pid = 160016
    pid2 = 125070
    output_file = "head_to_head_games.pgn"

    # Remove output file if it exists.
    if os.path.exists(output_file):
        os.remove(output_file)

    all_game_links = set()
    print("Fetching game detail links from listing pages (1–9)...")
    for page in range(1, 10):
        listing_url = f"{base_listing_url}?page={page}&pid={pid}&pid2={pid2}"
        print(f"\nFetching listing page {page}...")
        try:
            listing_html = fetch_url(listing_url)
        except Exception as e:
            print(f"Error fetching page {page}: {e}")
            continue

        page_game_links = parse_game_detail_links(listing_html)
        print(f"  Found {len(page_game_links)} game detail link(s) on page {page}.")
        all_game_links.update(page_game_links)
        time.sleep(1)  # Delay between listing page requests

    total_games = len(all_game_links)
    print(f"\nTotal unique game detail links found: {total_games}")

    if total_games == 0:
        print("No game detail links found. The page structure may have changed.")
        return

    # Process each game detail page.
    for idx, game_link in enumerate(all_game_links, start=1):
        print(f"\nProcessing game {idx}/{total_games}:")
        fetch_and_save_game_pgn(game_link, output_file)
        time.sleep(1)  # Delay between game detail requests

    print(f"\nFinished! All PGN data has been written to '{output_file}'.")

if __name__ == "__main__":
    main()
