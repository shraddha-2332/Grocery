const API = window.API_BASE_URL || "http://localhost:5000";
let allProducts = [];
let activeCategory = "all";

function handleUnauthorized(res, data) {
    if (res.status === 401 || data.message === "Invalid token") {
        localStorage.removeItem("token");
        alert("Session expired. Please login again.");
        window.location = "login.html";
        return true;
    }
    return false;
}

function renderAuthNav() {
    const token = localStorage.getItem("token");
    const guestNav = document.getElementById("guest-nav");
    const userNav = document.getElementById("user-nav");

    if (!guestNav || !userNav) return;

    if (token) {
        guestNav.style.display = "none";
        userNav.style.display = "flex";
    } else {
        guestNav.style.display = "flex";
        userNav.style.display = "none";
    }
}

async function showAdminLinkIfNeeded() {
    const token = localStorage.getItem("token");
    const adminLink = document.getElementById("admin-link");
    if (!token || !adminLink) return;

    const res = await fetch(API + "/me", {
        headers: { "Authorization": token }
    });
    const data = await res.json();
    if (handleUnauthorized(res, data)) return;
    if (data.isAdmin) adminLink.style.display = "inline-block";
}

async function refreshCartCount() {
    const token = localStorage.getItem("token");
    const countEl = document.getElementById("cart-count");
    if (!countEl) return;

    if (!token) {
        countEl.textContent = "0";
        return;
    }

    const res = await fetch(API + "/cart", { headers: { "Authorization": token } });
    const data = await res.json();
    if (handleUnauthorized(res, data)) return;

    const count = data.reduce((sum, item) => sum + item.quantity, 0);
    countEl.textContent = String(count);
}

function logout() {
    localStorage.removeItem("token");
    window.location = "login.html";
}

function resolveImageSrc(image) {
    if (!image) return "";
    if (image.startsWith("data:")) return image;
    if (image.startsWith("http://") || image.startsWith("https://")) return image;
    if (image.startsWith("/uploads/")) return API + image;
    return `images/${image}`;
}

function categorizeProduct(product) {
    if (product.category) return product.category;
    const lower = product.name.toLowerCase();
    if (lower.includes("rice") || lower.includes("wheat") || lower.includes("atta")) return "grains";
    if (lower.includes("sugar") || lower.includes("salt") || lower.includes("spice")) return "essentials";
    if (lower.includes("milk") || lower.includes("paneer") || lower.includes("curd")) return "dairy";
    if (lower.includes("apple") || lower.includes("banana") || lower.includes("tomato")) return "produce";
    return "popular";
}

function buildCategoryChips(products) {
    const chipContainer = document.getElementById("category-chips");
    const categories = ["all", ...new Set(products.map(categorizeProduct))];
    chipContainer.innerHTML = "";

    categories.forEach(category => {
        const button = document.createElement("button");
        button.className = `chip ${category === activeCategory ? "chip-active" : ""}`;
        button.textContent = category.charAt(0).toUpperCase() + category.slice(1);
        button.onclick = () => {
            activeCategory = category;
            buildCategoryChips(products);
            renderProducts();
        };
        chipContainer.appendChild(button);
    });
}

function getFilteredProducts() {
    const query = document.getElementById("search-input").value.trim().toLowerCase();
    const sortBy = document.getElementById("sort-select").value;

    let filtered = allProducts.filter(p => {
        const matchesText = p.name.toLowerCase().includes(query);
        const matchesCategory = activeCategory === "all" || categorizeProduct(p) === activeCategory;
        return matchesText && matchesCategory;
    });

    if (sortBy === "price_asc") filtered.sort((a, b) => a.price - b.price);
    if (sortBy === "price_desc") filtered.sort((a, b) => b.price - a.price);
    if (sortBy === "stock_desc") filtered.sort((a, b) => b.stock - a.stock);

    return filtered;
}

function renderProducts() {
    const products = getFilteredProducts();
    const container = document.getElementById("products");
    container.innerHTML = "";

    if (!products.length) {
        container.innerHTML = '<div class="empty">No products match your filters.</div>';
        return;
    }

    products.forEach(p => {
        const qtyOptions = [1, 2, 3, 4, 5]
            .filter(n => n <= Math.max(p.stock, 1))
            .map(n => `<option value="${n}">Qty ${n}</option>`)
            .join("");

        container.innerHTML += `
            <article class="product-card">
                <img src="${resolveImageSrc(p.image)}" alt="${p.name}">
                <h3>${p.name}</h3>
                <p class="meta">Stock: ${p.stock}</p>
                <p class="price">INR ${p.price}</p>
                <p class="stock-pill ${p.stock > 0 ? "in-stock" : "out-stock"}">
                    ${p.stock > 0 ? "In Stock" : "Out of Stock"}
                </p>
                ${p.stock > 0 ? "" : '<p class="stock-note">Currently out of stock</p>'}
                <div class="card-actions">
                    <select id="qty-${p._id}" class="qty-select" ${p.stock === 0 ? "disabled" : ""}>
                        ${qtyOptions || '<option value="1">Qty 1</option>'}
                    </select>
                    <button class="primary-btn" ${p.stock === 0 ? "disabled" : ""} onclick="addToCart('${p._id}')">Add to Cart</button>
                </div>
            </article>
        `;
    });
}

async function loadProducts() {
    const res = await fetch(API + "/products");
    allProducts = await res.json();
    buildCategoryChips(allProducts);
    renderProducts();
}

async function addToCart(productId) {
    const token = localStorage.getItem("token");

    if (!token) {
        alert("Login first");
        window.location = "login.html";
        return;
    }

    const qtySelect = document.getElementById(`qty-${productId}`);
    const quantity = qtySelect ? Number(qtySelect.value) : 1;

    const res = await fetch(API + "/cart", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": token
        },
        body: JSON.stringify({ productId, quantity })
    });

    const data = await res.json();
    if (handleUnauthorized(res, data)) return;
    alert(data.message || "Added to cart");

    if (res.ok) {
        await loadProducts();
        await refreshCartCount();
    }
}

document.getElementById("search-input").addEventListener("input", renderProducts);
document.getElementById("sort-select").addEventListener("change", renderProducts);

renderAuthNav();
loadProducts();
refreshCartCount();
showAdminLinkIfNeeded();
