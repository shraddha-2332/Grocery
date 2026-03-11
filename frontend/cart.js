const API = window.API_BASE_URL || "http://localhost:5000";

function handleUnauthorized(res, data) {
    if (res.status === 401 || data.message === "Invalid token") {
        localStorage.removeItem("token");
        alert("Session expired. Please login again.");
        window.location = "login.html";
        return true;
    }
    return false;
}

function logout() {
    localStorage.removeItem("token");
    window.location = "login.html";
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

async function refreshCartCount(items = null) {
    const countEl = document.getElementById("cart-count");
    if (!countEl) return;

    if (items) {
        countEl.textContent = String(items.reduce((sum, item) => sum + item.quantity, 0));
        return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
        countEl.textContent = "0";
        return;
    }

    const res = await fetch(API + "/cart", { headers: { "Authorization": token } });
    const data = await res.json();
    if (handleUnauthorized(res, data)) return;
    countEl.textContent = String(data.reduce((sum, item) => sum + item.quantity, 0));
}

async function loadCart() {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location = "login.html";
        return;
    }

    const res = await fetch(API + "/cart", {
        headers: { "Authorization": token }
    });

    const items = await res.json();
    if (handleUnauthorized(res, items)) return;

    const container = document.getElementById("cart");
    const summary = document.getElementById("cart-summary");
    container.innerHTML = "";
    summary.textContent = "";

    if (!items.length) {
        container.innerHTML = '<div class="empty">Your cart is empty.</div>';
        refreshCartCount([]);
        return;
    }

    let grandTotal = 0;
    items.forEach(i => {
        const lineTotal = i.productId.price * i.quantity;
        grandTotal += lineTotal;
        container.innerHTML += `
            <article class="cart-item">
                <div>
                    <h3>${i.productId.name}</h3>
                    <p>Unit Price: INR ${i.productId.price}</p>
                </div>
                <div class="cart-line-actions">
                    <div class="qty-wrap">
                        <button class="ghost-btn" onclick="changeQty('${i.productId._id}', ${i.quantity - 1})">-</button>
                        <span class="qty-value">${i.quantity}</span>
                        <button class="ghost-btn" onclick="changeQty('${i.productId._id}', ${i.quantity + 1})">+</button>
                    </div>
                    <strong>INR ${lineTotal}</strong>
                    <button class="danger-btn" onclick="removeFromCart('${i.productId._id}')">Remove</button>
                </div>
            </article>
        `;
    });

    summary.textContent = `Total: INR ${grandTotal}`;
    refreshCartCount(items);
}

async function changeQty(productId, quantity) {
    if (quantity < 1) {
        await removeFromCart(productId);
        return;
    }

    const token = localStorage.getItem("token");
    const res = await fetch(API + `/cart/${productId}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "Authorization": token
        },
        body: JSON.stringify({ quantity })
    });

    const data = await res.json();
    if (handleUnauthorized(res, data)) return;
    if (!res.ok) alert(data.message || "Could not update quantity");
    loadCart();
}

async function checkout() {
    const token = localStorage.getItem("token");
    const paymentMethodEl = document.getElementById("payment-method");
    const paymentMethod = paymentMethodEl ? paymentMethodEl.value : "cod";

    const res = await fetch(API + "/checkout", {
        method: "POST",
        headers: {
            "Authorization": token,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ paymentMethod })
    });

    const data = await res.json();
    if (handleUnauthorized(res, data)) return;
    alert(data.message || "Order placed!");
    loadCart();
}

async function clearCart() {
    const token = localStorage.getItem("token");
    const res = await fetch(API + "/cart", {
        method: "DELETE",
        headers: { "Authorization": token }
    });

    const data = await res.json();
    if (handleUnauthorized(res, data)) return;
    alert(data.message || "Cart cleared");
    loadCart();
}

async function removeFromCart(productId) {
    const token = localStorage.getItem("token");
    const res = await fetch(API + `/cart/${productId}`, {
        method: "DELETE",
        headers: { "Authorization": token }
    });

    const data = await res.json();
    if (handleUnauthorized(res, data)) return;
    alert(data.message || "Item removed");
    loadCart();
}

loadCart();
refreshCartCount();
showAdminLinkIfNeeded();
