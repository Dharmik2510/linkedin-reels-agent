# LinkedIn → Instagram Reels Agent

Scrapes your LinkedIn saved posts and transforms them into Instagram Reels scripts using Claude.

## Setup

```bash
pip install -r requirements.txt
playwright install chromium
cp .env.example .env  # fill in your credentials

# Build the frontend once
cd frontend && npm install && npm run build && cd ..

python main.py        # serves the built dashboard at http://localhost:8000
```

For frontend development with hot reload, run `cd frontend && npm run dev` in a second terminal and open http://localhost:5173 — Vite will proxy /run, /stop and /stream to the FastAPI server on :8000.

## Usage

1. Open http://localhost:8000 in your browser
2. Enter the number of saved posts to process
3. Click **Run** — watch activity stream in real time
4. Find your Reels scripts in the "Reels Scripts" tab

## Notes
- LinkedIn is scraped in headed mode (browser window opens) to avoid bot detection
- Scraping is for personal use only on your own account
- Scripts are generated with Claude Sonnet via the Anthropic API
