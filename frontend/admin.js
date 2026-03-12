const API = window.API_BASE_URL || "http://localhost:5000";

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

async function fetchMe() {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location = "login.html";
        return null;
    }

    const res = await fetch(API + "/me", {
        headers: { "Authorization": token }
    });
    const data = await res.json();

    if (res.status === 401) {
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

async function loadProducts() {
    const res = await fetch(API + "/products");
    const products = await res.json();

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
    if (res.ok) loadProducts();
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
    if (res.ok) loadProducts();
}

(async function init() {
    const me = await fetchMe();
    if (!me) return;
    loadProducts();
})();
