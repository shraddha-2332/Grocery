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

async function fetchMe() {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const res = await fetch(API + "/me", {
        headers: { "Authorization": token }
    });
    const data = await res.json();
    if (handleUnauthorized(res, data)) return null;
    return data;
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

function formatDate(dateString) {
    return new Date(dateString).toLocaleString();
}

async function loadOrders() {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location = "login.html";
        return;
    }

    const me = await fetchMe();
    if (!me) return;

    const endpoint = me.isAdmin ? "/admin/orders" : "/orders";
    const res = await fetch(API + endpoint, {
        headers: { "Authorization": token }
    });
    const orders = await res.json();
    if (handleUnauthorized(res, orders)) return;

    const container = document.getElementById("orders");
    container.innerHTML = "";

    if (!orders.length) {
        container.innerHTML = '<div class="empty">No orders yet. Start shopping from the store.</div>';
        return;
    }

    orders.forEach(order => {
        const items = order.items.map(item => `
            <li>${item.productId?.name || "Product"} x ${item.quantity} - INR ${item.price * item.quantity}</li>
        `).join("");
        const customer = me.isAdmin && order.userId
            ? `<p class="meta">Customer: ${order.userId.name || "User"} (${order.userId.email || "no email"})</p>`
            : "";

        container.innerHTML += `
            <article class="order-card">
                <div class="order-top">
                    <h3>Order ${order.orderNumber || order._id}</h3>
                    <span class="stock-pill in-stock">${order.status}</span>
                </div>
                <p class="meta">Placed on ${formatDate(order.createdAt)}</p>
                ${customer}
                <p class="meta">Payment: ${String(order.paymentMethod || "cod").toUpperCase()} | ${order.paymentStatus || "pending"}</p>
                <ul class="order-items">${items}</ul>
                <p class="price">Total: INR ${order.total}</p>
            </article>
        `;
    });
}

loadOrders();
refreshCartCount();
showAdminLinkIfNeeded();
