# TradeFlow System - AI-Powered E-Commerce Application

## Introduction
TradeFlow System is a Flask-based AI e-commerce demo that simulates a real shopping platform.  
It combines product browsing, customer reviews, sentiment analysis, intent-based chatbot support, and recommendation ranking in one web app.

## Purpose
- Show practical use of AI with Flask in an e-commerce workflow.
- Analyze user review text for positive, negative, or neutral sentiment.
- Recommend products using review sentiment signals.
- Provide support answers using a trained NLP intent model.

## Main Features
- Professional UI with navbar, product catalog, recommendation cards, chatbot, and footer.
- Product catalog seeded from SQLite with expanded starter items and categories.
- Review form with full-sentence sentiment analysis and neutral classification.
- AI recommendation endpoint with category filtering and ranking by sentiment score.
- Intent-based chatbot for shipping, returns, payment, and product support.

## Tech Stack
- Python, Flask
- SQLite (local database)
- Scikit-learn (`TfidfVectorizer`, `LogisticRegression`)
- HTML, CSS, JavaScript

## Project Structure
- `app.py`: Flask routes, AI logic, DB initialization, API endpoints.
- `templates/index.html`: frontend layout and client-side API handling.
- `static/style.css`: styling and color palette.
- `tradeflow.db`: SQLite database file (auto-created at runtime).

## How To Use This Website
1. Open Home section to view the app introduction.
2. Go to My Products to browse the product catalog and see sentiment counts.
3. Submit a review with Product ID and a full sentence; the app detects positive, negative, or neutral sentiment and saves it.
4. Open the Chatbot section or use the floating chat button for AI support.
5. Click Refresh Picks after adding reviews to see the recommendation ranking update based on sentiment.

## Setup and Run
1. Open terminal in project folder.
2. (Optional but recommended) activate virtual environment.
3. Install dependencies:
   - `pip install flask scikit-learn`
4. Run app:
   - `python app.py`
5. Open browser:
   - `http://127.0.0.1:5000`

## Database Attachment and Import Steps
The app uses SQLite. No separate DB server is needed.

### Step A: Automatic DB creation (default)
1. Run `python app.py`.
2. `tradeflow.db` is created automatically in project root.
3. `products` table is seeded with starter items if empty.

### Step B: Attach existing database file manually
If you already have an SQLite DB:
1. Place your DB file in project root.
2. Rename it to `tradeflow.db` OR update `DB_PATH` inside `app.py`.
3. Ensure it has these tables:
   - `products(id, name, category, price, description)`
   - `reviews(id, product_id, user_name, review_text, sentiment, created_at)`
4. Restart app with `python app.py`.

### Step C: Import product data
You can import products in two ways:
- Option 1: Insert directly using SQLite tools.
- Option 2: Add your products to `seed_products` list in `app.py`, delete old `tradeflow.db`, then rerun app.

## Recommendation Improvement Steps (Next Level)
1. Add user behavior events: clicks, views, cart adds, purchases.
2. Save event history per user in DB tables.
3. Build weighted score:
   - `score = review_sentiment + clicks + cart_weight + purchase_weight`
4. Add time-decay so recent activity has higher importance.
5. Use collaborative filtering later (user-user or item-item similarity).
6. Keep fallback to category-based ranking for new users.

## Chatbot Improvement Steps
1. Move intent samples to separate JSON file.
2. Expand each intent with more realistic question variations.
3. Add confidence threshold for uncertain predictions.
4. Add fallback response that suggests supported topics.
5. Optionally connect GenAI API for richer responses.

## Color Palette Used
- `#B82E30`
- `#AF6438`
- `#F2E2B8`
- `#879A98`
- `#323A42`

## Website Name
TradeFlow AI Commerce
