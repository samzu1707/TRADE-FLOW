/* TradeFlow — Shared Frontend (APIs unchanged) */
const TradeFlow = (() => {
    const WISHLIST_KEY = "tradeflow_wishlist";
    const THEME_KEY = "tradeflow_theme";
    const COUPON_KEY = "tradeflow_coupon";
    const PER_PAGE = 8;

    const CATEGORY_ICONS = {
        Electronics: "📱", Furniture: "🪑", Accessories: "👜",
        "Home Appliances": "🏠", "Smart Home": "💡", Beauty: "✨",
        Sports: "⚽", default: "🛍️"
    };

    const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b"];
    const SIZES = ["XS", "S", "M", "L", "XL"];

    let productsCache = [];
    let couponDiscount = 0;

    function productImage(item) {
        const cat = item.category || "default";
        const hue = (item.id * 47) % 360;
        return `data:image/svg+xml,${encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
            <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:hsl(${hue},70%,85%)"/>
            <stop offset="100%" style="stop-color:hsl(${(hue+60)%360},60%,75%)"/>
            </linearGradient></defs>
            <rect width="400" height="400" fill="url(#g)"/>
            <text x="200" y="210" text-anchor="middle" font-size="64">${CATEGORY_ICONS[cat] || CATEGORY_ICONS.default}</text>
            </svg>`
        )}`;
    }

    function starRating(item) {
        const pos = item.positive_reviews || 0;
        const total = (item.total_reviews || pos + (item.negative_reviews || 0) + (item.neutral_reviews || 0)) || 1;
        const score = Math.min(5, Math.max(3, 3 + (pos / Math.max(total, 1)) * 2));
        const full = Math.floor(score);
        const half = score % 1 >= 0.5 ? "½" : "";
        return "★".repeat(full) + half + "☆".repeat(5 - full - (half ? 1 : 0)) + ` (${total})`;
    }

    function formatPrice(n) {
        return `PKR ${Number(n).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }

    function discountPercent(price, id) {
        return 10 + (id % 25);
    }

    function salePrice(price, id) {
        const pct = discountPercent(price, id);
        return { original: price, sale: price * (1 - pct / 100), pct };
    }

    /* Wishlist (localStorage) */
    function getWishlist() {
        try { return JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]"); }
        catch { return []; }
    }

    function saveWishlist(list) {
        localStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
        updateWishlistBadge();
    }

    function toggleWishlist(id) {
        const list = getWishlist();
        const idx = list.indexOf(id);
        if (idx >= 0) {
            list.splice(idx, 1);
            showToast("Removed from wishlist", "success");
        } else {
            list.push(id);
            showToast("Added to wishlist", "success");
        }
        saveWishlist(list);
        document.querySelectorAll(`.wishlist-btn[data-id="${id}"]`).forEach(btn => {
            btn.classList.toggle("active", list.includes(id));
            btn.textContent = list.includes(id) ? "♥" : "♡";
        });
    }

    function isWishlisted(id) {
        return getWishlist().includes(id);
    }

    /* Theme */
    function initTheme() {
        const saved = localStorage.getItem(THEME_KEY) || "light";
        document.documentElement.setAttribute("data-theme", saved);
        document.getElementById("theme-toggle")?.addEventListener("click", () => {
            const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
            document.documentElement.setAttribute("data-theme", next);
            localStorage.setItem(THEME_KEY, next);
        });
    }

    /* Toast */
    function showToast(msg, type = "success") {
        const container = document.getElementById("toast-container");
        if (!container) return;
        const el = document.createElement("div");
        el.className = `toast ${type}`;
        el.textContent = msg;
        container.appendChild(el);
        setTimeout(() => el.remove(), 3200);
    }

    /* API — unchanged endpoints */
    async function fetchProducts() {
        const res = await fetch("/api/products");
        productsCache = await res.json();
        return productsCache;
    }

    async function addToCart(productId, quantity = 1) {
        const res = await fetch("/api/cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product_id: productId, quantity })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message || "Added to cart", "success");
            updateCartBadge();
            return true;
        }
        showToast(data.error || "Failed to add", "error");
        return false;
    }

    async function fetchCart() {
        const res = await fetch("/api/cart");
        return res.json();
    }

    async function removeFromCart(cartId) {
        const res = await fetch(`/api/cart/${cartId}`, { method: "DELETE" });
        if (res.ok) {
            showToast("Item removed", "success");
            updateCartBadge();
            return true;
        }
        return false;
    }

    async function checkout() {
        const res = await fetch("/api/checkout", { method: "POST" });
        return { ok: res.ok, data: await res.json() };
    }

    async function sendChat(message) {
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message })
        });
        const data = await res.json();
        return data.response;
    }

    async function submitReview(e) {
        if (e) e.preventDefault();
        const name = document.getElementById("review-name")?.value.trim() || "Guest";
        const productId = Number(document.getElementById("review-product-id")?.value);
        const reviewText = document.getElementById("review-text")?.value.trim();
        const resultBox = document.getElementById("review-result");

        if (!productId || !reviewText) {
            if (resultBox) resultBox.textContent = "Please add Product ID and review text.";
            return;
        }

        const res = await fetch("/api/reviews", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_name: name, product_id: productId, review_text: reviewText })
        });
        const data = await res.json();
        if (!res.ok) {
            if (resultBox) resultBox.textContent = data.error || "Unable to save review.";
            showToast(data.error || "Review failed", "error");
            return;
        }
        const msg = `Review saved. Sentiment: ${data.sentiment.toUpperCase()}.`;
        if (resultBox) resultBox.textContent = msg;
        showToast(msg, "success");
        document.getElementById("review-text").value = "";
        productsCache = await fetchProducts();
        loadRecommendations();
    }

    async function loadRecommendations() {
        const el = document.getElementById("recommend-list");
        if (!el) return;
        const category = document.getElementById("category-input")?.value.trim() || "";
        const query = category ? `?category=${encodeURIComponent(category)}` : "";
        const res = await fetch(`/api/recommendations${query}`);
        const data = await res.json();
        el.innerHTML = data.length
            ? renderProductCards(data, { compact: true })
            : "<p class='loading-text'>No recommendations for this category.</p>";
    }

    /* Badges */
    async function updateCartBadge() {
        const data = await fetchCart();
        const count = data.items.reduce((s, i) => s + i.quantity, 0);
        const badge = document.getElementById("cart-count");
        if (badge) {
            badge.textContent = count;
            badge.style.display = count ? "flex" : "none";
        }
    }

    function updateWishlistBadge() {
        const count = getWishlist().length;
        const badge = document.getElementById("wishlist-count");
        if (badge) {
            badge.textContent = count;
            badge.style.display = count ? "flex" : "none";
        }
    }

    /* Product card HTML */
    function renderProductCards(items, opts = {}) {
        return items.map(item => {
            const { original, sale, pct } = salePrice(item.price, item.id);
            const price = opts.sale ? sale : item.price;
            const showDiscount = opts.sale || pct > 15;
            const wished = isWishlisted(item.id);
            return `
            <article class="product-card" data-id="${item.id}">
                <div class="product-image-wrap">
                    ${showDiscount ? `<span class="product-badge">-${pct}%</span>` : ""}
                    <button class="wishlist-btn ${wished ? "active" : ""}" data-id="${item.id}" aria-label="Wishlist">${wished ? "♥" : "♡"}</button>
                    <a href="/product/${item.id}"><img class="product-image" src="${productImage(item)}" alt="${item.name}"></a>
                </div>
                <div class="product-body">
                    <h3><a href="/product/${item.id}">${item.name}</a></h3>
                    <div class="product-rating">${starRating(item)}</div>
                    <div class="product-price">
                        <span class="price-current">${formatPrice(price)}</span>
                        ${showDiscount ? `<span class="price-old">${formatPrice(original)}</span>` : ""}
                    </div>
                    ${opts.compact ? `<p class="muted" style="font-size:0.8rem;margin:0 0 0.5rem">${item.category}</p>` : ""}
                    <div class="product-actions">
                        <button class="btn btn-primary btn-add" data-id="${item.id}">Add to Cart</button>
                        <a href="/product/${item.id}" class="btn btn-ghost">View</a>
                    </div>
                </div>
            </article>`;
        }).join("");
    }

    function renderProductGrid(container, items, opts = {}) {
        if (!container) return;
        container.innerHTML = renderProductCards(items, opts);
        bindProductCardEvents(container);
    }

    function bindProductCardEvents(container) {
        container.querySelectorAll(".btn-add").forEach(btn => {
            btn.addEventListener("click", () => addToCart(Number(btn.dataset.id)));
        });
        container.querySelectorAll(".wishlist-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleWishlist(Number(btn.dataset.id));
            });
        });
    }

    function renderCategories(container, products) {
        if (!container) return;
        const cats = [...new Set(products.map(p => p.category))];
        container.innerHTML = cats.map(cat => `
            <a href="/products?filter=${encodeURIComponent(cat)}" class="category-card">
                <div class="category-icon">${CATEGORY_ICONS[cat] || CATEGORY_ICONS.default}</div>
                <span>${cat}</span>
            </a>
        `).join("");
    }

    /* Countdown */
    function initCountdown() {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        function tick() {
            const diff = Math.max(0, end - Date.now());
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            const pad = n => String(n).padStart(2, "0");
            const eh = document.getElementById("cd-hours");
            const em = document.getElementById("cd-mins");
            const es = document.getElementById("cd-secs");
            if (eh) eh.textContent = pad(h);
            if (em) em.textContent = pad(m);
            if (es) es.textContent = pad(s);
        }
        tick();
        setInterval(tick, 1000);
    }

    /* Testimonials */
    function initTestimonials() {
        const track = document.getElementById("testimonial-track");
        const dots = document.getElementById("slider-dots");
        if (!track) return;
        const items = [
            { text: "TradeFlow recommendations are spot on. Love the AI picks!", author: "Ayesha K." },
            { text: "Fast delivery and the sentiment reviews helped me choose wisely.", author: "Hassan M." },
            { text: "The chatbot answered all my shipping questions instantly.", author: "Sara R." }
        ];
        track.innerHTML = items.map(t => `
            <div class="testimonial-card">
                <p>"${t.text}"</p>
                <strong>— ${t.author}</strong>
            </div>
        `).join("");
        dots.innerHTML = items.map((_, i) => `<button class="slider-dot ${i === 0 ? "active" : ""}" data-i="${i}"></button>`).join("");
        let current = 0;
        function goTo(i) {
            current = i;
            track.style.transform = `translateX(-${i * 100}%)`;
            dots.querySelectorAll(".slider-dot").forEach((d, j) => d.classList.toggle("active", j === i));
        }
        dots.querySelectorAll(".slider-dot").forEach(d => d.addEventListener("click", () => goTo(Number(d.dataset.i))));
        setInterval(() => goTo((current + 1) % items.length), 5000);
    }

    /* Shop page */
    let shopState = { page: 1, filter: "", sort: "default", search: "", min: 0, max: Infinity };

    async function initShopPage() {
        const params = new URLSearchParams(location.search);
        shopState.filter = params.get("filter") || "";
        const products = await fetchProducts();
        const cats = [...new Set(products.map(p => p.category))];
        const sel = document.getElementById("filter-category");
        if (sel) {
            sel.innerHTML = '<option value="">All Categories</option>' +
                cats.map(c => `<option value="${c}" ${c === shopState.filter ? "selected" : ""}>${c}</option>`).join("");
        }
        document.getElementById("apply-filters")?.addEventListener("click", applyShopFilters);
        document.getElementById("clear-filters")?.addEventListener("click", () => {
            shopState = { page: 1, filter: "", sort: "default", search: "", min: 0, max: Infinity };
            document.getElementById("filter-category").value = "";
            document.getElementById("sort-by").value = "default";
            document.getElementById("price-min").value = "";
            document.getElementById("price-max").value = "";
            document.getElementById("shop-search").value = "";
            renderShopProducts(products);
        });
        document.getElementById("sort-by")?.addEventListener("change", () => { shopState.sort = document.getElementById("sort-by").value; renderShopProducts(productsCache); });
        document.getElementById("shop-search")?.addEventListener("input", (e) => {
            shopState.search = e.target.value.toLowerCase();
            shopState.page = 1;
            renderShopProducts(productsCache);
        });
        const globalSearch = document.getElementById("global-search");
        const mobileSearch = document.getElementById("mobile-search");
        [globalSearch, mobileSearch].forEach(inp => {
            inp?.addEventListener("keydown", (e) => {
                if (e.key === "Enter" && inp.value.trim()) {
                    location.href = `/products?search=${encodeURIComponent(inp.value.trim())}`;
                }
            });
        });
        const searchParam = params.get("search");
        if (searchParam) {
            shopState.search = searchParam.toLowerCase();
            document.getElementById("shop-search").value = searchParam;
        }
        renderShopProducts(products);
    }

    function applyShopFilters() {
        shopState.filter = document.getElementById("filter-category")?.value || "";
        shopState.sort = document.getElementById("sort-by")?.value || "default";
        shopState.min = Number(document.getElementById("price-min")?.value) || 0;
        shopState.max = Number(document.getElementById("price-max")?.value) || Infinity;
        shopState.page = 1;
        renderShopProducts(productsCache);
    }

    function filterProducts(products) {
        return products.filter(p => {
            if (shopState.filter && p.category !== shopState.filter) return false;
            if (p.price < shopState.min || p.price > shopState.max) return false;
            if (shopState.search && !p.name.toLowerCase().includes(shopState.search) && !p.category.toLowerCase().includes(shopState.search)) return false;
            return true;
        });
    }

    function sortProducts(list) {
        const arr = [...list];
        switch (shopState.sort) {
            case "price-asc": return arr.sort((a, b) => a.price - b.price);
            case "price-desc": return arr.sort((a, b) => b.price - a.price);
            case "rating": return arr.sort((a, b) => (b.positive_reviews || 0) - (a.positive_reviews || 0));
            case "name": return arr.sort((a, b) => a.name.localeCompare(b.name));
            default: return arr;
        }
    }

    function renderShopProducts(products) {
        const filtered = sortProducts(filterProducts(products));
        const total = filtered.length;
        const pages = Math.max(1, Math.ceil(total / PER_PAGE));
        shopState.page = Math.min(shopState.page, pages);
        const start = (shopState.page - 1) * PER_PAGE;
        const pageItems = filtered.slice(start, start + PER_PAGE);

        document.getElementById("results-count").textContent = `Showing ${pageItems.length} of ${total} products`;
        const grid = document.getElementById("product-grid");
        grid.innerHTML = pageItems.length ? renderProductCards(pageItems) : "<p class='loading-text'>No products match your filters.</p>";
        bindProductCardEvents(grid);

        const pag = document.getElementById("pagination");
        if (!pag) return;
        let html = "";
        if (shopState.page > 1) html += `<button class="page-btn" data-p="${shopState.page - 1}">←</button>`;
        for (let i = 1; i <= pages; i++) {
            html += `<button class="page-btn ${i === shopState.page ? "active" : ""}" data-p="${i}">${i}</button>`;
        }
        if (shopState.page < pages) html += `<button class="page-btn" data-p="${shopState.page + 1}">→</button>`;
        pag.innerHTML = html;
        pag.querySelectorAll(".page-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                shopState.page = Number(btn.dataset.p);
                renderShopProducts(productsCache);
                window.scrollTo({ top: 0, behavior: "smooth" });
            });
        });
    }

    /* Product detail */
    async function initProductDetail(productId) {
        const products = await fetchProducts();
        const item = products.find(p => p.id === productId);
        const container = document.getElementById("detail-content");
        if (!item) {
            container.innerHTML = "<p class='loading-text'>Product not found.</p>";
            return;
        }
        document.getElementById("breadcrumb-name").textContent = item.name;
        document.title = `${item.name} — TradeFlow`;
        const { original, sale, pct } = salePrice(item.price, item.id);
        const imgs = [productImage(item), productImage({ ...item, id: item.id + 100 }), productImage({ ...item, id: item.id + 200 })];

        container.innerHTML = `
        <div class="gallery">
            <div class="gallery-main"><img id="main-image" src="${imgs[0]}" alt="${item.name}"></div>
            <div class="gallery-thumbs">
                ${imgs.map((src, i) => `<div class="gallery-thumb ${i === 0 ? "active" : ""}" data-src="${src}"><img src="${src}" alt=""></div>`).join("")}
            </div>
        </div>
        <div class="detail-info">
            <h1>${item.name}</h1>
            <div class="detail-rating">${starRating(item)}</div>
            <div class="detail-price">
                <span class="price-current">${formatPrice(sale)}</span>
                <span class="price-old">${formatPrice(original)}</span>
                <span class="discount-tag">-${pct}%</span>
            </div>
            <p class="muted">${item.description}</p>
            <p class="meta">ID ${item.id} · ${item.category} · +${item.positive_reviews || 0} / -${item.negative_reviews || 0} sentiment</p>
            <div class="color-options">
                <label>Color</label>
                <div class="color-circles">
                    ${COLORS.map((c, i) => `<div class="color-circle ${i === 0 ? "active" : ""}" style="background:${c}" data-color="${c}"></div>`).join("")}
                </div>
            </div>
            <div class="size-options">
                <label>Size</label>
                <select id="size-select">${SIZES.map(s => `<option>${s}</option>`).join("")}</select>
            </div>
            <label>Quantity</label>
            <div class="qty-selector">
                <button type="button" id="qty-minus">−</button>
                <input type="number" id="qty-input" value="1" min="1" max="99">
                <button type="button" id="qty-plus">+</button>
            </div>
            <div class="detail-actions">
                <button class="btn btn-primary" id="btn-add-cart">Add to Cart</button>
                <button class="btn btn-ghost" id="btn-buy-now">Buy Now</button>
                <button class="wishlist-btn ${isWishlisted(item.id) ? "active" : ""}" data-id="${item.id}" style="position:static;width:48px;height:48px">${isWishlisted(item.id) ? "♥" : "♡"}</button>
            </div>
            <div class="detail-tabs">
                <div class="tab-buttons">
                    <button class="tab-btn active" data-tab="desc">Description</button>
                    <button class="tab-btn" data-tab="ship">Shipping</button>
                    <button class="tab-btn" data-tab="review">Reviews</button>
                </div>
                <div class="tab-panel active" id="tab-desc">${item.description}<br><br>Category: ${item.category}. Premium quality with TradeFlow guarantee.</div>
                <div class="tab-panel" id="tab-ship">Standard delivery 3-5 business days. Express 1-2 days for major cities. Free returns within 7 days.</div>
                <div class="tab-panel" id="tab-review">
                    <p>Submit a review — AI analyzes sentiment automatically.</p>
                    <form class="detail-review-form" id="detail-review-form">
                        <input type="hidden" id="review-product-id" value="${item.id}">
                        <input id="review-name" type="text" placeholder="Your name">
                        <textarea id="review-text" placeholder="Write your review..."></textarea>
                        <button type="submit" class="btn btn-primary">Analyze + Save</button>
                        <p id="review-result" class="status-text"></p>
                    </form>
                </div>
            </div>
        </div>`;

        container.querySelectorAll(".gallery-thumb").forEach(th => {
            th.addEventListener("click", () => {
                document.getElementById("main-image").src = th.dataset.src;
                container.querySelectorAll(".gallery-thumb").forEach(t => t.classList.remove("active"));
                th.classList.add("active");
            });
        });
        container.querySelectorAll(".color-circle").forEach(c => {
            c.addEventListener("click", () => {
                container.querySelectorAll(".color-circle").forEach(x => x.classList.remove("active"));
                c.classList.add("active");
            });
        });
        container.querySelectorAll(".tab-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                container.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
                container.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
                btn.classList.add("active");
                document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
            });
        });
        const qtyInput = document.getElementById("qty-input");
        document.getElementById("qty-minus").addEventListener("click", () => { if (qtyInput.value > 1) qtyInput.value--; });
        document.getElementById("qty-plus").addEventListener("click", () => { if (qtyInput.value < 99) qtyInput.value++; });
        document.getElementById("btn-add-cart").addEventListener("click", () => addToCart(item.id, Number(qtyInput.value)));
        document.getElementById("btn-buy-now").addEventListener("click", async () => {
            await addToCart(item.id, Number(qtyInput.value));
            location.href = "/checkout";
        });
        container.querySelector(".wishlist-btn")?.addEventListener("click", () => toggleWishlist(item.id));
        document.getElementById("detail-review-form")?.addEventListener("submit", submitReview);

        const related = products.filter(p => p.category === item.category && p.id !== item.id).slice(0, 4);
        if (related.length) {
            document.getElementById("related-section").style.display = "block";
            renderProductGrid(document.getElementById("related-products"), related);
        }
    }

    /* Cart page */
    async function initCartPage() {
        const data = await fetchCart();
        const tbody = document.getElementById("cart-tbody");
        const empty = document.getElementById("cart-empty");
        const table = document.getElementById("cart-table");

        if (!data.items.length) {
            tbody.innerHTML = "";
            empty.style.display = "block";
            table.style.display = "none";
            updateSummary(0);
            return;
        }
        empty.style.display = "none";
        table.style.display = "table";
        const products = await fetchProducts();

        tbody.innerHTML = data.items.map(item => {
            const prod = products.find(p => p.id === item.product_id) || item;
            return `<tr>
                <td><div class="cart-product">
                    <img src="${productImage(prod)}" alt="">
                    <div><strong>${item.name}</strong><br><small class="muted">${item.category || ""}</small></div>
                </div></td>
                <td>${formatPrice(item.price)}</td>
                <td><div class="cart-qty">
                    <button onclick="TradeFlow.updateCartQty(${item.cart_id}, ${item.quantity - 1}, ${item.product_id})">−</button>
                    <span>${item.quantity}</span>
                    <button onclick="TradeFlow.updateCartQty(${item.cart_id}, ${item.quantity + 1}, ${item.product_id})">+</button>
                </div></td>
                <td><strong>${formatPrice(item.total)}</strong></td>
                <td><button class="btn-remove" onclick="TradeFlow.removeCartItem(${item.cart_id})">Remove</button></td>
            </tr>`;
        }).join("");

        updateSummary(data.total);
        document.getElementById("apply-coupon")?.addEventListener("click", () => {
            const code = document.getElementById("coupon-input").value.trim().toUpperCase();
            const msg = document.getElementById("coupon-message");
            if (code === "TRADEFLOW10") {
                couponDiscount = data.total * 0.1;
                localStorage.setItem(COUPON_KEY, code);
                msg.textContent = "10% discount applied!";
                msg.style.color = "var(--success)";
                updateSummary(data.total);
                showToast("Coupon applied!", "success");
            } else {
                msg.textContent = "Invalid coupon. Try TRADEFLOW10";
                msg.style.color = "var(--danger)";
            }
        });
        const savedCoupon = localStorage.getItem(COUPON_KEY);
        if (savedCoupon === "TRADEFLOW10") {
            couponDiscount = data.total * 0.1;
            document.getElementById("discount-row").style.display = "flex";
        }
    }

    function updateSummary(subtotal) {
        const discount = couponDiscount || 0;
        const afterDiscount = subtotal - discount;
        const tax = afterDiscount * 0.17;
        const total = afterDiscount + tax;
        document.getElementById("summary-subtotal").textContent = formatPrice(subtotal);
        document.getElementById("summary-discount").textContent = `-${formatPrice(discount)}`;
        document.getElementById("summary-tax").textContent = formatPrice(tax);
        document.getElementById("summary-total").textContent = formatPrice(total);
        if (discount > 0) document.getElementById("discount-row").style.display = "flex";
    }

    async function removeCartItem(cartId) {
        if (await removeFromCart(cartId)) initCartPage();
    }

    async function updateCartQty(cartId, newQty, productId) {
        if (newQty < 1) {
            await removeCartItem(cartId);
            return;
        }
        await removeFromCart(cartId);
        await addToCart(productId, newQty);
        initCartPage();
    }

    /* Checkout */
    async function initCheckoutPage() {
        const data = await fetchCart();
        const itemsEl = document.getElementById("checkout-items");
        if (!data.items.length) {
            itemsEl.innerHTML = "<p class='muted'>Cart is empty. <a href='/products'>Shop now</a></p>";
            return;
        }
        itemsEl.innerHTML = data.items.map(i => `
            <div class="checkout-item"><span>${i.name} × ${i.quantity}</span><span>${formatPrice(i.total)}</span></div>
        `).join("");
        const subtotal = data.total - (couponDiscount || 0);
        const tax = subtotal * 0.17;
        document.getElementById("co-subtotal").textContent = formatPrice(data.total);
        document.getElementById("co-tax").textContent = formatPrice(tax);
        document.getElementById("co-total").textContent = formatPrice(subtotal + tax);

        document.getElementById("checkout-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const status = document.getElementById("checkout-status");
            const result = await checkout();
            if (result.ok) {
                status.textContent = "✓ " + result.data.message;
                status.style.color = "var(--success)";
                localStorage.removeItem(COUPON_KEY);
                couponDiscount = 0;
                showToast(result.data.message, "success");
                setTimeout(() => location.href = "/", 2500);
            } else {
                status.textContent = result.data.error || "Checkout failed";
                status.style.color = "var(--danger)";
            }
        });

        document.getElementById("same-as-billing")?.addEventListener("change", (e) => {
            document.querySelectorAll(".ship-field").forEach(f => f.disabled = e.target.checked);
        });
    }

    /* Wishlist page */
    async function initWishlistPage() {
        const ids = getWishlist();
        const grid = document.getElementById("wishlist-grid");
        const empty = document.getElementById("wishlist-empty");
        if (!ids.length) {
            grid.innerHTML = "";
            empty.style.display = "block";
            return;
        }
        empty.style.display = "none";
        const products = await fetchProducts();
        const items = products.filter(p => ids.includes(p.id));
        renderProductGrid(grid, items);
    }

    /* Auth */
    function initAuthPage() {
        document.querySelectorAll(".auth-tab").forEach(tab => {
            tab.addEventListener("click", () => {
                document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
                document.querySelectorAll(".auth-form").forEach(f => f.classList.remove("active"));
                tab.classList.add("active");
                document.getElementById(`${tab.dataset.tab}-form`).classList.add("active");
            });
        });
        document.getElementById("login-form")?.addEventListener("submit", (e) => {
            e.preventDefault();
            showToast("Login successful! (Demo)", "success");
        });
        document.getElementById("signup-form")?.addEventListener("submit", (e) => {
            e.preventDefault();
            showToast("Account created! (Demo)", "success");
        });
    }

    /* Contact */
    function initContactPage() {
        document.getElementById("contact-form")?.addEventListener("submit", (e) => {
            e.preventDefault();
            document.getElementById("contact-status").textContent = "Message sent! We'll reply within 24 hours.";
            showToast("Message sent successfully!", "success");
            e.target.reset();
        });
    }

    /* Nav & Chat */
    function initNav() {
        const hamburger = document.getElementById("hamburger");
        const drawer = document.getElementById("nav-drawer");
        const overlay = document.getElementById("nav-overlay");
        const closeBtn = document.getElementById("nav-drawer-close");

        function setNavOpen(open) {
            drawer?.classList.toggle("open", open);
            overlay?.classList.toggle("visible", open);
            hamburger?.classList.toggle("active", open);
            hamburger?.setAttribute("aria-expanded", open);
            hamburger?.setAttribute("aria-label", open ? "Close menu" : "Open menu");
            drawer?.setAttribute("aria-hidden", !open);
            overlay?.setAttribute("aria-hidden", !open);
            document.body.classList.toggle("nav-open", open);
        }

        function openNav() { setNavOpen(true); }
        function closeNav() { setNavOpen(false); }

        hamburger?.addEventListener("click", () => {
            setNavOpen(!drawer?.classList.contains("open"));
        });
        closeBtn?.addEventListener("click", closeNav);
        overlay?.addEventListener("click", closeNav);

        document.querySelectorAll(".nav-drawer-links .nav-link, .nav-drawer-footer a").forEach(link => {
            link.addEventListener("click", () => {
                if (window.innerWidth <= 1100) closeNav();
            });
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && drawer?.classList.contains("open")) closeNav();
        });

        window.addEventListener("resize", () => {
            if (window.innerWidth > 1100 && drawer?.classList.contains("open")) closeNav();
        });

        /* Active link highlight */
        const path = location.pathname.replace(/\/$/, "") || "/";
        const onHome = path === "/" || path === "";
        document.querySelectorAll(".nav-link[data-nav]").forEach(link => {
            const navPath = (link.dataset.nav || "").replace(/\/$/, "") || "/";
            let active = false;
            if (link.classList.contains("nav-link-ai")) {
                active = onHome && location.hash === "#ai-recommendations";
            } else if (navPath === "/") {
                active = onHome && location.hash !== "#ai-recommendations";
            } else if (navPath === "/products") {
                active = path === "/products" || path.startsWith("/product");
            } else {
                active = path === navPath;
            }
            if (active) link.classList.add("active");
        });

        document.getElementById("footer-newsletter")?.addEventListener("submit", (e) => {
            e.preventDefault();
            showToast("Subscribed!", "success");
            e.target.reset();
        });
    }

    function initChat() {
        const panel = document.getElementById("chat-panel");
        const chatBox = document.getElementById("chat-box");
        const floatBtn = document.getElementById("chat-float-btn");
        const closeBtn = document.getElementById("chat-close");
        const sendBtn = document.getElementById("send-btn");
        const input = document.getElementById("user-input");

        if (!chatBox) return;
        chatBox.innerHTML = "<p><span class='label bot'>AI</span> Welcome to TradeFlow! Ask about shipping, returns, payment, or recommendations.</p>";

        floatBtn?.addEventListener("click", () => panel?.classList.add("open"));
        closeBtn?.addEventListener("click", () => panel?.classList.remove("open"));

        async function send() {
            const msg = input?.value.trim();
            if (!msg) return;
            chatBox.innerHTML += `<p><span class="label">You</span> ${msg}</p>`;
            input.value = "";
            const reply = await sendChat(msg);
            chatBox.innerHTML += `<p><span class="label bot">AI</span> ${reply}</p>`;
            chatBox.scrollTop = chatBox.scrollHeight;
        }
        sendBtn?.addEventListener("click", send);
        input?.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
    }

    /* Init */
    document.addEventListener("DOMContentLoaded", () => {
        initTheme();
        initNav();
        initChat();
        updateCartBadge();
        updateWishlistBadge();
    });

    return {
        fetchProducts, addToCart, loadRecommendations, submitReview,
        renderProductGrid, renderCategories, initCountdown, initTestimonials,
        initShopPage, initProductDetail, initCartPage, initCheckoutPage,
        initWishlistPage, initAuthPage, initContactPage,
        showToast, removeCartItem, updateCartQty, toggleWishlist
    };
})();



