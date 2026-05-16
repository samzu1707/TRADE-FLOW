from flask import Flask, jsonify, render_template, request, send_from_directory
import sqlite3
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

app = Flask(__name__)
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "tradeflow.db"
ASSETS_DIR = BASE_DIR / "assests"

POSITIVE_WORDS = {
    "great", "excellent", "good", "best", "amazing", "love", "fast",
    "clean", "smooth", "perfect", "helpful", "quality", "satisfied",
    "wonderful", "reliable", "comfortable", "stylish", "easy", "fresh",
    "delightful", "awesome", "fantastic", "superb"
}
NEGATIVE_WORDS = {
    "bad", "worst", "slow", "poor", "broken", "hate", "late", "cheap",
    "problem", "issue", "disappointed", "difficult", "refund", "terrible",
    "flawed", "uncomfortable", "awful", "noisy", "ugly", "expensive"
}
NEGATION_WORDS = {
    "not", "never", "no", "none", "hardly", "rarely", "seldom",
    "cannot", "can't", "dont", "didn't", "doesn't", "isn't", "wasn't",
    "weren't", "shouldn't", "wouldn't", "couldn't"
}

INTENT_DATA = {
    "greeting": [
        "hello", "hi there", "hey", "good morning", "good evening",
        "how are you", "salam", "what's up"
    ],
    "recommendation": [
        "recommend me products", "what should i buy", "top products",
        "best electronics", "show recommendations", "suggest items"
    ],
    "shipping": [
        "how much time for delivery", "shipping details", "delivery policy",
        "when will my order arrive", "is shipping free"
    ],
    "returns": [
        "return policy", "how to return", "refund process",
        "can i exchange item", "product replacement policy"
    ],
    "payment": [
        "payment options", "cod available", "accept credit card",
        "pay with bank transfer", "secure payment"
    ],
}

INTENT_RESPONSES = {
    "greeting": "Welcome to TradeFlow! Ask me for recommendations, shipping, returns, or payment help.",
    "recommendation": "Based on current trends, Electronics and Accessories are performing best. Scroll to see my live picks.",
    "shipping": "Standard delivery is 3-5 business days. Express delivery is 1-2 days for major cities.",
    "returns": "TradeFlow offers a 7-day return window for eligible products in original condition.",
    "payment": "We support cash on delivery, debit/credit cards, and secure online banking.",
}


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def sentiment_of(text):
    normalized = text.lower().replace("’", "'").replace("“", '"').replace("”", '"')
    tokens = [t.strip(".,!?;:\"()[]") for t in normalized.split() if t.strip(".,!?;:\"()[]")]

    pos_score = 0
    neg_score = 0
    negated = False

    for token in tokens:
        if token in NEGATION_WORDS:
            negated = True
            continue

        if token in POSITIVE_WORDS or token in NEGATIVE_WORDS:
            token_score = 1 if token in POSITIVE_WORDS else -1
            if negated:
                token_score *= -1
            if token_score > 0:
                pos_score += 1
            else:
                neg_score += 1
            negated = False
            continue

        if token.endswith("n't") and token[:-3] in NEGATION_WORDS:
            negated = True

    if pos_score == neg_score:
        return "neutral"
    return "positive" if pos_score > neg_score else "negative"


def train_intent_model():
    train_x = []
    train_y = []
    for intent, sentences in INTENT_DATA.items():
        for sentence in sentences:
            train_x.append(sentence)
            train_y.append(intent)

    vectorizer = TfidfVectorizer(ngram_range=(1, 2))
    x_matrix = vectorizer.fit_transform(train_x)

    clf = LogisticRegression(max_iter=300)
    clf.fit(x_matrix, train_y)
    return vectorizer, clf


VECTORIZER, INTENT_MODEL = train_intent_model()


def chatbot_reply(message):
    text = (message or "").strip()
    if not text:
        return "Please type a message so I can help you."

    intent = INTENT_MODEL.predict(VECTORIZER.transform([text.lower()]))[0]
    return INTENT_RESPONSES.get(intent, "Can you rephrase that? I can help with shopping recommendations and support questions.")


def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL,
            description TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            user_name TEXT NOT NULL,
            review_text TEXT NOT NULL,
            sentiment TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS cart (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
        """
    )

    existing_count = cur.execute("SELECT COUNT(*) AS count FROM products").fetchone()["count"]
    if existing_count == 0:
        seed_products = [
            ("Smart Fitness Watch", "Electronics", 1259.99, "Heart-rate, sleep, and activity tracking with app sync."),
            ("Noise Canceling Headphones", "Electronics", 1189.50, "Premium sound, long battery, and fast charging."),
            ("Ergonomic Office Chair", "Furniture", 12339.00, "Lumbar support chair for productive remote work."),
            ("Eco Water Bottle", "Accessories", 88.75, "Insulated stainless bottle for hot and cold drinks."),
            ("Compact Blender", "Home Appliances", 559.90, "Portable smoothie blender for quick daily use."),
            ("Laptop Sleeve 15in", "Accessories", 344.00, "Shockproof sleeve with waterproof material."),
            ("Smart LED Desk Lamp", "Smart Home", 2334.00, "Adjustable color and brightness with voice control."),
            ("Gaming Mouse", "Electronics", 3342.95, "High-precision RGB mouse for fast-paced gameplay."),
            ("Wireless Charger Stand", "Electronics", 2229.99, "Fast charging pad with upright phone support."),
            ("Organic Face Serum", "Beauty", 1121.50, "Hydrating serum for smoother, healthier-looking skin."),
            ("Yoga Mat Pro", "Sports", 934.99, "Extra thick non-slip mat for yoga, pilates, and stretching."),
            ("Kitchen Knife Set", "Home Appliances", 1769.95, "Stainless steel chef set with ergonomic handles."),
            ("Travel Backpack", "Accessories", 5654.90, "Lightweight backpack with multiple compartments."),
            ("Bluetooth Speaker", "Electronics", 4548.25, "Portable speaker with deep bass and clear vocals."),
        ]
        cur.executemany(
            "INSERT INTO products (name, category, price, description) VALUES (?, ?, ?, ?)",
            seed_products,
        )
    conn.commit()
    conn.close()


def product_scores():
    conn = get_db_connection()
    rows = conn.execute(
        """
        SELECT
            p.id,
            p.name,
            p.category,
            p.price,
            p.description,
            SUM(CASE WHEN r.sentiment = 'positive' THEN 1 ELSE 0 END) AS positive_reviews,
            SUM(CASE WHEN r.sentiment = 'negative' THEN 1 ELSE 0 END) AS negative_reviews,
            SUM(CASE WHEN r.sentiment = 'neutral' THEN 1 ELSE 0 END) AS neutral_reviews,
            COUNT(r.id) AS total_reviews
        FROM products p
        LEFT JOIN reviews r ON r.product_id = p.id
        GROUP BY p.id
        ORDER BY positive_reviews DESC, total_reviews DESC, p.price ASC
        """
    ).fetchall()
    conn.close()
    return rows


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/products")
def products_page():
    return render_template("products.html")


@app.route("/product/<int:product_id>")
def product_detail_page(product_id):
    return render_template("product-detail.html", product_id=product_id)


@app.route("/cart")
def cart_page():
    return render_template("cart.html")


@app.route("/wishlist")
def wishlist_page():
    return render_template("wishlist.html")


@app.route("/checkout")
def checkout_page():
    return render_template("checkout.html")


@app.route("/login")
def auth_page():
    return render_template("auth.html")


@app.route("/contact")
def contact_page():
    return render_template("contact.html")


@app.route("/assests/<path:filename>")
def serve_assets(filename):
    return send_from_directory(ASSETS_DIR, filename)


@app.route("/api/products", methods=["GET"])
def get_products():
    rows = product_scores()
    products = []
    for row in rows:
        products.append(
            {
                "id": row["id"],
                "name": row["name"],
                "category": row["category"],
                "price": row["price"],
                "description": row["description"],
                "positive_reviews": row["positive_reviews"] or 0,
                "negative_reviews": row["negative_reviews"] or 0,
                "neutral_reviews": row["neutral_reviews"] or 0,
                "total_reviews": row["total_reviews"] or 0,
            }
        )
    return jsonify(products)


@app.route("/api/recommendations", methods=["GET"])
def recommendations():
    category = request.args.get("category", "").strip().lower()
    rows = product_scores()

    recommendations_list = []
    for row in rows:
        if category and row["category"].lower() != category:
            continue
        score = (row["positive_reviews"] or 0) - (row["negative_reviews"] or 0)
        recommendations_list.append(
            {
                "id": row["id"],
                "name": row["name"],
                "category": row["category"],
                "price": row["price"],
                "description": row["description"],
                "score": score,
                "positive_reviews": row["positive_reviews"] or 0,
                "negative_reviews": row["negative_reviews"] or 0,
                "neutral_reviews": row["neutral_reviews"] or 0,
            }
        )

    recommendations_list.sort(key=lambda item: (item["score"], item["positive_reviews"]), reverse=True)
    return jsonify(recommendations_list[:4])


@app.route("/api/reviews", methods=["POST"])
def add_review():
    data = request.get_json(silent=True) or {}
    product_id = data.get("product_id")
    user_name = (data.get("user_name") or "Guest").strip()
    review_text = (data.get("review_text") or "").strip()

    if not product_id or not review_text:
        return jsonify({"error": "product_id and review_text are required"}), 400

    sentiment = sentiment_of(review_text)
    conn = get_db_connection()
    conn.execute(
        "INSERT INTO reviews (product_id, user_name, review_text, sentiment) VALUES (?, ?, ?, ?)",
        (product_id, user_name, review_text, sentiment),
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Review saved", "sentiment": sentiment})


@app.route("/api/chat", methods=["POST"])
def chat():
    payload = request.get_json(silent=True) or {}
    message = payload.get("message", "")
    return jsonify({"response": chatbot_reply(message)})


@app.route("/api/cart", methods=["GET"])
def get_cart():
    conn = get_db_connection()
    rows = conn.execute(
        """
        SELECT c.id, c.product_id, c.quantity, p.name, p.price, p.category
        FROM cart c
        JOIN products p ON c.product_id = p.id
        ORDER BY c.added_at DESC
        """
    ).fetchall()
    conn.close()
    
    cart_items = []
    total_price = 0
    for row in rows:
        item_total = row["price"] * row["quantity"]
        total_price += item_total
        cart_items.append({
            "cart_id": row["id"],
            "product_id": row["product_id"],
            "name": row["name"],
            "price": row["price"],
            "quantity": row["quantity"],
            "total": item_total,
            "category": row["category"]
        })
    return jsonify({"items": cart_items, "total": total_price})


@app.route("/api/cart", methods=["POST"])
def add_to_cart():
    data = request.get_json(silent=True) or {}
    product_id = data.get("product_id")
    quantity = data.get("quantity", 1)
    
    if not product_id:
        return jsonify({"error": "product_id is required"}), 400
    
    conn = get_db_connection()
    
    # Check if product exists
    product = conn.execute("SELECT id FROM products WHERE id = ?", (product_id,)).fetchone()
    if not product:
        conn.close()
        return jsonify({"error": "Product not found"}), 404
    
    # Check if product already in cart
    existing = conn.execute("SELECT id, quantity FROM cart WHERE product_id = ?", (product_id,)).fetchone()
    if existing:
        conn.execute("UPDATE cart SET quantity = quantity + ? WHERE id = ?", (quantity, existing["id"]))
    else:
        conn.execute("INSERT INTO cart (product_id, quantity) VALUES (?, ?)", (product_id, quantity))
    
    conn.commit()
    conn.close()
    return jsonify({"message": "Item added to cart"}), 201


@app.route("/api/cart/<int:cart_id>", methods=["DELETE"])
def remove_from_cart(cart_id):
    conn = get_db_connection()
    conn.execute("DELETE FROM cart WHERE id = ?", (cart_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Item removed from cart"})


@app.route("/api/checkout", methods=["POST"])
def checkout():
    conn = get_db_connection()
    
    # Get cart total
    cart_data = conn.execute("SELECT COUNT(*) as count FROM cart").fetchone()
    if cart_data["count"] == 0:
        conn.close()
        return jsonify({"error": "Cart is empty"}), 400
    
    # Clear cart after checkout
    conn.execute("DELETE FROM cart")
    conn.commit()
    conn.close()
    return jsonify({"message": "Order placed successfully! Thank you for shopping at TradeFlow."}), 200


init_db()

if __name__ == "__main__":
    app.run(debug=True)