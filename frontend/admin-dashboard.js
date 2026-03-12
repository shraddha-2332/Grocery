const API = window.API_BASE_URL || "http://localhost:5000";
let adminProfile = null;
let allOrders = [];
let productsCatalog = [];

async function readJson(res) {
    try {
        return await res.json();
    } catch {
        return {};
    }
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

function setTab(tab) {
    document.querySelectorAll(".admin-tab").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    document.querySelectorAll(".admin-panel").forEach(panel => {
        panel.classList.toggle("active", panel.id === `tab-${tab}`);
    });
}

async function fetchMe() {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const res = await fetch(API + "/me", {
        headers: { "Authorization": token }
    });
    const data = await res.json();
    if (res.status === 401 || data.message === "Invalid token") {
        localStorage.removeItem("token");
        window.location = "login.html";
        return null;
    }
    if (!data.isAdmin) {
        alert("Admin access required");
        window.location = "index.html";
        return null;
    }
    return data;
}

async function uploadImage() {
    const token = localStorage.getItem("token");
    const fileInput = document.getElementById("image-file");
    const statusEl = document.getElementById("upload-status");

    if (!fileInput.files.length) {
        statusEl.textContent = "Select an image first.";
        return null;
    }

    const formData = new FormData();
    formData.append("image", fileInput.files[0]);

    statusEl.textContent = "Uploading image...";

    let res;
    try {
        res = await fetch(API + "/upload-image", {
            method: "POST",
            headers: { "Authorization": token },
            body: formData
        });
    } catch (err) {
        statusEl.textContent = "Upload failed: network error";
        console.error(err);
        return null;
    }

    const data = await readJson(res);
    if (!res.ok) {
        statusEl.textContent = data.message || data.error || `Upload failed (${res.status})`;
        return null;
    }

    document.getElementById("image").value = data.imagePath;
    statusEl.textContent = `Uploaded: ${data.imagePath}`;
    return data.imagePath;
}

async function createProduct() {
    const token = localStorage.getItem("token");
    const name = document.getElementById("name").value.trim();
    const price = Number(document.getElementById("price").value);
    const stock = Number(document.getElementById("stock").value);
    const category = document.getElementById("category").value.trim() || "general";
    let image = document.getElementById("image").value.trim();
    const fileInput = document.getElementById("image-file");
    const statusEl = document.getElementById("upload-status");

    if (!image && fileInput.files.length) {
        const uploadedPath = await uploadImage();
        if (uploadedPath) {
            image = uploadedPath;
        }
    }

    if (!name || Number.isNaN(price) || Number.isNaN(stock)) {
        alert("Please provide name, price, and stock.");
        return;
    }

    if (!image) {
        alert("Please upload an image or enter an image path.");
        return;
    }

    let res;
    try {
        res = await fetch(API + "/products", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": token
            },
            body: JSON.stringify({ name, price, stock, image, category })
        });
    } catch (err) {
        if (statusEl) statusEl.textContent = "Create failed: network error";
        console.error(err);
        alert("Create failed: network error");
        return;
    }

    const data = await readJson(res);
    alert(data.message || (res.ok ? "Done" : `Create failed (${res.status})`));
    if (res.ok) {
        document.getElementById("name").value = "";
        document.getElementById("price").value = "";
        document.getElementById("stock").value = "";
        document.getElementById("category").value = "";
        document.getElementById("image").value = "";
        document.getElementById("image-file").value = "";
        document.getElementById("upload-status").textContent = "";
        loadProducts();
        loadStats();
    }
}

async function deleteProduct(id) {
    const token = localStorage.getItem("token");
    const res = await fetch(API + `/products/${id}`, {
        method: "DELETE",
        headers: { "Authorization": token }
    });

    const data = await res.json();
    alert(data.message || "Done");
    if (res.ok) {
        loadProducts();
        loadStats();
    }
}

async function editProduct(id, oldName, oldPrice, oldStock, oldImage, oldCategory) {
    const token = localStorage.getItem("token");

    const name = prompt("Name", oldName);
    if (name === null) return;
    const price = prompt("Price", oldPrice);
    if (price === null) return;
    const stock = prompt("Stock", oldStock);
    if (stock === null) return;
    const category = prompt("Category", oldCategory || "general");
    if (category === null) return;
    const image = prompt("Image filename/path", oldImage);
    if (image === null) return;

    const res = await fetch(API + `/products/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": token
        },
        body: JSON.stringify({
            name: name.trim(),
            price: Number(price),
            stock: Number(stock),
            category: category.trim() || "general",
            image: image.trim()
        })
    });

    const data = await res.json();
    alert(data.message || "Done");
    if (res.ok) {
        loadProducts();
        loadStats();
    }
}

async function loadProducts() {
    const res = await fetch(API + "/products");
    const products = await res.json();
    productsCatalog = Array.isArray(products) ? products : [];

    const container = document.getElementById("admin-products");
    container.innerHTML = "";

    products.forEach(p => {
        container.innerHTML += `
            <article class="admin-item">
                <div class="admin-item-main">
                    <img class="admin-thumb" src="${resolveImageSrc(p.image)}" alt="${p.name}">
                    <div>
                        <h3>${p.name}</h3>
                        <p class="meta">Price: INR ${p.price} | Stock: ${p.stock} | Category: ${p.category || "general"}</p>
                        <p class="stock-pill ${p.stock > 0 ? "in-stock" : "out-stock"}">
                            ${p.stock > 0 ? "In Stock" : "Out of Stock"}
                        </p>
                    </div>
                </div>
                <div class="admin-actions">
                    <button class="ghost-btn" onclick="editProduct('${p._id}', '${p.name}', ${p.price}, ${p.stock}, '${p.image || ""}', '${p.category || "general"}')">Edit</button>
                    <button class="danger-btn" onclick="deleteProduct('${p._id}')">Delete</button>
                </div>
            </article>
        `;
    });
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleString();
}

async function loadOrders() {
    const token = localStorage.getItem("token");
    const res = await fetch(API + "/admin/orders", {
        headers: { "Authorization": token }
    });
    allOrders = await res.json();
    renderOrders();
}

async function updateOrder(orderId) {
    const token = localStorage.getItem("token");
    const status = document.getElementById(`status-${orderId}`).value;
    const paymentStatus = document.getElementById(`payment-${orderId}`).value;
    const refundStatus = document.getElementById(`refund-${orderId}`).value;
    const refundReason = document.getElementById(`reason-${orderId}`).value;

    const res = await fetch(API + `/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "Authorization": token
        },
        body: JSON.stringify({ status, paymentStatus, refundStatus, refundReason })
    });
    const data = await res.json();
    alert(data.message || "Order updated");
    if (res.ok) {
        await loadOrders();
        await loadStats();
    }
}

function buildSelect(id, value, options) {
    const opts = options.map(opt => {
        const selected = opt === value ? "selected" : "";
        return `<option value="${opt}" ${selected}>${opt}</option>`;
    }).join("");
    return `<select id="${id}" class="admin-select">${opts}</select>`;
}

function renderOrders() {
    const container = document.getElementById("orders-table");
    if (!Array.isArray(allOrders) || !allOrders.length) {
        container.innerHTML = '<div class="empty">No orders yet.</div>';
        return;
    }

    const statusOptions = ["placed", "processing", "shipped", "delivered", "cancelled", "refunded"];
    const paymentOptions = ["pending", "paid", "refunded"];
    const refundOptions = ["none", "requested", "approved", "rejected"];

    const rows = allOrders.map(order => `
        <div class="admin-row">
            <div>
                <strong>${order.orderNumber || order._id}</strong>
                <p class="meta">Placed ${formatDate(order.createdAt)}</p>
                <p class="meta">${order.userId?.name || "User"} (${order.userId?.email || "no email"})</p>
            </div>
            <div>
                <p class="meta">Items: ${order.items?.length || 0}</p>
                <p class="meta">Payment: ${String(order.paymentMethod || "cod").toUpperCase()}</p>
                ${buildSelect(`status-${order._id}`, order.status || "placed", statusOptions)}
            </div>
            <div>
                <p class="price">INR ${order.total}</p>
                ${buildSelect(`payment-${order._id}`, order.paymentStatus || "pending", paymentOptions)}
            </div>
            <div>
                ${buildSelect(`refund-${order._id}`, order.refundStatus || "none", refundOptions)}
                <input id="reason-${order._id}" class="admin-input" placeholder="Refund reason" value="${order.refundReason || ""}">
                <button class="primary-btn admin-save" onclick="updateOrder('${order._id}')">Save</button>
                <button class="ghost-btn admin-toggle" onclick="toggleOrderItems('${order._id}')">Edit Items</button>
            </div>
        </div>
        <div id="items-wrap-${order._id}" class="admin-items-wrap" style="display:none;">
            ${renderOrderItemsEditor(order)}
        </div>
    `).join("");

    container.innerHTML = `<div class="admin-table-body">${rows}</div>`;
}

async function loadUsers() {
    const token = localStorage.getItem("token");
    const res = await fetch(API + "/admin/users", {
        headers: { "Authorization": token }
    });
    const users = await res.json();

    const container = document.getElementById("users-table");
    if (!Array.isArray(users) || !users.length) {
        container.innerHTML = '<div class="empty">No users found.</div>';
        return;
    }

    const rows = users.map(user => `
        <div class="admin-row">
            <div>
                <strong>${user.name || "User"}</strong>
                <p class="meta">${user.email || "no email"}</p>
            </div>
            <div>
                <span class="stock-pill ${user.isAdmin ? "in-stock" : "out-stock"}">
                    ${user.isAdmin ? "Admin" : "Customer"}
                </span>
            </div>
        </div>
    `).join("");

    container.innerHTML = `<div class="admin-table-body">${rows}</div>`;
}

async function loadStats() {
    const token = localStorage.getItem("token");
    const res = await fetch(API + "/admin/stats", {
        headers: { "Authorization": token }
    });
    const data = await res.json();

    const statsContainer = document.getElementById("admin-stats");
    statsContainer.innerHTML = `
        <article class="stat-card">
            <h3>Users</h3>
            <p>${data.userCount || 0}</p>
        </article>
        <article class="stat-card">
            <h3>Orders</h3>
            <p>${data.orderCount || 0}</p>
        </article>
        <article class="stat-card">
            <h3>Products</h3>
            <p>${data.productCount || 0}</p>
        </article>
        <article class="stat-card">
            <h3>Revenue</h3>
            <p>INR ${data.revenue || 0}</p>
        </article>
    `;

    const lowStock = document.getElementById("low-stock");
    if (!data.lowStock || !data.lowStock.length) {
        lowStock.innerHTML = '<div class="empty">All products are sufficiently stocked.</div>';
    } else {
        lowStock.innerHTML = data.lowStock.map(item => `
            <div class="admin-compact-row">
                <span>${item.name}</span>
                <span class="stock-pill out-stock">Stock: ${item.stock}</span>
            </div>
        `).join("");
    }

    const recentOrders = document.getElementById("recent-orders");
    if (!allOrders.length) {
        recentOrders.innerHTML = '<div class="empty">No orders yet.</div>';
        return;
    }
    const recent = allOrders.slice(0, 5);
    recentOrders.innerHTML = recent.map(order => `
        <div class="admin-compact-row">
            <span>${order.orderNumber || order._id}</span>
            <span>INR ${order.total}</span>
        </div>
    `).join("");
}

function exportOrdersCsv() {
    const token = localStorage.getItem("token");
    if (!token) return;
    const url = `${API}/admin/orders/export`;
    fetch(url, { headers: { "Authorization": token } })
        .then(res => res.blob())
        .then(blob => {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "orders.csv";
            document.body.appendChild(link);
            link.click();
            link.remove();
        });
}

function renderOrderItemsEditor(order) {
    if (!productsCatalog.length) {
        return `<div class="empty">Products not loaded yet.</div>`;
    }

    const rows = (order.items || []).map(item => {
        const productId = item.productId?._id || item.productId;
        const name = item.productId?.name || "Product";
        const qty = item.quantity || 1;
        return `
            <div class="admin-item-row" data-product-id="${productId}">
                <span>${name}</span>
                <input class="admin-input" type="number" min="1" value="${qty}">
                <button class="ghost-btn" onclick="removeOrderItemRow('${order._id}', '${productId}')">Remove</button>
            </div>
        `;
    }).join("");

    const options = productsCatalog.map(p => `<option value="${p._id}">${p.name}</option>`).join("");

    return `
        <div class="admin-items-panel" id="items-${order._id}">
            ${rows || '<div class="empty">No items yet.</div>'}
        </div>
        <div class="admin-item-actions">
            <select id="add-product-${order._id}" class="admin-select">${options}</select>
            <input id="add-qty-${order._id}" class="admin-input" type="number" min="1" value="1">
            <button class="ghost-btn" onclick="addOrderItemRow('${order._id}')">Add Item</button>
            <button class="primary-btn" onclick="saveOrderItems('${order._id}')">Save Items</button>
        </div>
    `;
}

function toggleOrderItems(orderId) {
    const wrap = document.getElementById(`items-wrap-${orderId}`);
    if (!wrap) return;
    wrap.style.display = wrap.style.display === "none" ? "block" : "none";
}

function removeOrderItemRow(orderId, productId) {
    const container = document.getElementById(`items-${orderId}`);
    if (!container) return;
    const row = container.querySelector(`.admin-item-row[data-product-id="${productId}"]`);
    if (row) row.remove();
}

function addOrderItemRow(orderId) {
    const container = document.getElementById(`items-${orderId}`);
    const select = document.getElementById(`add-product-${orderId}`);
    const qtyInput = document.getElementById(`add-qty-${orderId}`);
    if (!container || !select || !qtyInput) return;

    const productId = select.value;
    const qty = Math.max(1, Number(qtyInput.value) || 1);
    const product = productsCatalog.find(p => p._id === productId);
    if (!product) return;

    const existing = container.querySelector(`.admin-item-row[data-product-id="${productId}"]`);
    if (existing) {
        const input = existing.querySelector("input");
        input.value = String(Number(input.value || 0) + qty);
        return;
    }

    const row = document.createElement("div");
    row.className = "admin-item-row";
    row.dataset.productId = productId;
    row.innerHTML = `
        <span>${product.name}</span>
        <input class="admin-input" type="number" min="1" value="${qty}">
        <button class="ghost-btn" onclick="removeOrderItemRow('${orderId}', '${productId}')">Remove</button>
    `;
    container.appendChild(row);
}

async function saveOrderItems(orderId) {
    const token = localStorage.getItem("token");
    const container = document.getElementById(`items-${orderId}`);
    if (!container) return;

    const rows = Array.from(container.querySelectorAll(".admin-item-row"));
    if (!rows.length) {
        alert("At least one item is required.");
        return;
    }

    const items = [];
    rows.forEach(row => {
        const productId = row.dataset.productId;
        const qtyInput = row.querySelector("input");
        const quantity = Number(qtyInput?.value || 0);
        if (productId && Number.isInteger(quantity) && quantity > 0) {
            items.push({ productId, quantity });
        }
    });

    const res = await fetch(API + `/admin/orders/${orderId}/items`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "Authorization": token
        },
        body: JSON.stringify({ items })
    });
    const data = await res.json();
    alert(data.message || "Items updated");
    if (res.ok) {
        await loadOrders();
        await loadStats();
    }
}

async function refreshAll() {
    await loadProducts();
    await loadOrders();
    await loadStats();
    await loadUsers();
}

async function init() {
    adminProfile = await fetchMe();
    if (!adminProfile) return;

    document.getElementById("admin-name").textContent = adminProfile.name || "Admin";
    document.getElementById("admin-email").textContent = adminProfile.email || "";

    document.querySelectorAll(".admin-tab").forEach(btn => {
        btn.addEventListener("click", () => setTab(btn.dataset.tab));
    });

    await refreshAll();
}

init();
