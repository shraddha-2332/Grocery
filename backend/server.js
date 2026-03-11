const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

require("./db");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const Product = require("./models/Product");
const Order = require("./models/Order");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const Cart = require("./models/Cart");
const authMiddleware = require("./middleware/auth");
const adminMiddleware = require("./middleware/admin");
const app = express();
const createOrderNumber = () => `FC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const isAdminEmail = (email = "") =>
    (process.env.ADMIN_EMAIL || "").trim().toLowerCase() === String(email).trim().toLowerCase();
const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/\s+/g, "-");
        cb(null, `${Date.now()}-${safeName}`);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Only image files are allowed"));
        }
        cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

// REGISTER
app.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "Email already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            name,
            email,
            password: hashedPassword,
            isAdmin: isAdminEmail(email)
        });

        await user.save();

        res.json({ message: "User registered" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// LOGIN
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user)
            return res.status(400).json({ message: "User not found" });

        const valid = await bcrypt.compare(password, user.password);

        if (!valid)
            return res.status(400).json({ message: "Wrong password" });

        // Keep admin role in sync with ADMIN_EMAIL from .env.
        const shouldBeAdmin = isAdminEmail(user.email);
        if (user.isAdmin !== shouldBeAdmin) {
            user.isAdmin = shouldBeAdmin;
            await user.save();
        }

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.json({ token, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ---------------- GET PRODUCTS ---------------- */

app.get("/products", async (req, res) => {
    try {
        const { q = "", category = "all", sort = "default" } = req.query;
        const query = {};

        if (q.trim()) {
            query.name = { $regex: q.trim(), $options: "i" };
        }

        if (category !== "all") {
            query.category = String(category).trim().toLowerCase();
        }

        let mongoQuery = Product.find(query);
        if (sort === "price_asc") mongoQuery = mongoQuery.sort({ price: 1 });
        if (sort === "price_desc") mongoQuery = mongoQuery.sort({ price: -1 });
        if (sort === "stock_desc") mongoQuery = mongoQuery.sort({ stock: -1 });

        const products = await mongoQuery;
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/me", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("name email isAdmin");
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/products", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { name, price, stock, image, category } = req.body;
        const product = await Product.create({
            name,
            price: Number(price),
            stock: Number(stock),
            image,
            category: (category || "general").toLowerCase()
        });
        res.status(201).json({ message: "Product created", product });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put("/products/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, stock, image, category } = req.body;
        const product = await Product.findByIdAndUpdate(
            id,
            {
                name,
                price: Number(price),
                stock: Number(stock),
                image,
                category: (category || "general").toLowerCase()
            },
            { new: true, runValidators: true }
        );

        if (!product) return res.status(404).json({ message: "Product not found" });
        res.json({ message: "Product updated", product });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/products/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) return res.status(404).json({ message: "Product not found" });
        res.json({ message: "Product deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/upload-image", authMiddleware, adminMiddleware, upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Image file is required" });
        }
        res.json({
            message: "Image uploaded",
            imagePath: `/uploads/${req.file.filename}`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add to cart
app.post("/cart", authMiddleware, async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const qty = Number(quantity);

        if (!productId || !Number.isInteger(qty) || qty <= 0) {
            return res.status(400).json({ message: "Invalid cart payload" });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        if (product.stock < qty) {
            return res.status(400).json({ message: `${product.name} out of stock` });
        }

        let cart = await Cart.findOne({ userId: req.user.id });

        if (!cart) {
            cart = new Cart({
                userId: req.user.id,
                items: []
            });
        }

        const existingItem = cart.items.find(
            item => item.productId.toString() === productId
        );

        if (existingItem) {
            existingItem.quantity += qty;
        } else {
            cart.items.push({ productId, quantity: qty });
        }

        // Reserve stock when product is added to cart.
        product.stock -= qty;
        await product.save();
        await cart.save();
        res.json({ message: "Added to cart" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/cart", authMiddleware, async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.user.id })
            .populate("items.productId");

        if (!cart) return res.json([]);

        const validItems = cart.items.filter(item => item.productId);
        res.json(validItems);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/cart/:productId", authMiddleware, async (req, res) => {
    try {
        const { productId } = req.params;
        const cart = await Cart.findOne({ userId: req.user.id });

        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        const itemIndex = cart.items.findIndex(
            item => item.productId.toString() === productId
        );

        if (itemIndex === -1) {
            return res.status(404).json({ message: "Item not found in cart" });
        }

        const item = cart.items[itemIndex];
        const product = await Product.findById(item.productId);

        if (product) {
            product.stock += item.quantity;
            await product.save();
        }

        cart.items.splice(itemIndex, 1);
        await cart.save();

        res.json({ message: "Item removed from cart" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch("/cart/:productId", authMiddleware, async (req, res) => {
    try {
        const { productId } = req.params;
        const { quantity } = req.body;
        const nextQty = Number(quantity);

        if (!Number.isInteger(nextQty) || nextQty < 1) {
            return res.status(400).json({ message: "Invalid quantity" });
        }

        const cart = await Cart.findOne({ userId: req.user.id });
        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        const cartItem = cart.items.find(
            item => item.productId.toString() === productId
        );
        if (!cartItem) {
            return res.status(404).json({ message: "Item not found in cart" });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        const diff = nextQty - cartItem.quantity;

        if (diff > 0) {
            if (product.stock < diff) {
                return res.status(400).json({ message: `${product.name} out of stock` });
            }
            product.stock -= diff;
        } else if (diff < 0) {
            product.stock += Math.abs(diff);
        }

        cartItem.quantity = nextQty;
        await product.save();
        await cart.save();

        res.json({ message: "Cart updated" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/cart", authMiddleware, async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.user.id });
        if (!cart || cart.items.length === 0) {
            return res.json({ message: "Cart already empty" });
        }

        for (const item of cart.items) {
            const product = await Product.findById(item.productId);
            if (product) {
                product.stock += item.quantity;
                await product.save();
            }
        }

        cart.items = [];
        await cart.save();
        res.json({ message: "Cart cleared" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/checkout", authMiddleware, async (req, res) => {
    try {
        const { paymentMethod = "cod" } = req.body;
        const method = String(paymentMethod).toLowerCase();
        const paymentMethods = new Set(["cod", "card", "upi"]);

        if (!paymentMethods.has(method)) {
            return res.status(400).json({ message: "Invalid payment method" });
        }

        const cart = await Cart.findOne({ userId: req.user.id })
            .populate("items.productId");

        if (!cart || cart.items.length === 0) {
            return res.json({ message: "Cart empty" });
        }

        for (let item of cart.items) {
            if (!item.productId) {
                return res.status(400).json({ message: "One or more products are unavailable" });
            }
        }

        const orderItems = cart.items.map(item => ({
            productId: item.productId._id,
            quantity: item.quantity,
            price: item.productId.price
        }));

        const total = orderItems.reduce(
            (sum, item) => sum + (item.price * item.quantity),
            0
        );

        await Order.create({
            orderNumber: createOrderNumber(),
            userId: req.user.id,
            items: orderItems,
            total,
            paymentMethod: method,
            paymentStatus: method === "cod" ? "pending" : "paid",
            status: "placed"
        });

        cart.items = [];
        await cart.save();

        res.json({ message: "Order placed successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ---------------- PLACE ORDER ---------------- */

app.post("/order", authMiddleware, async (req, res) => {
    try {
        const { productId, quantity } = req.body;

        const product = await Product.findById(productId);

        if (!product)
            return res.status(404).json({ message: "Product not found" });

        if (product.stock < quantity)
            return res.json({ message: "Not enough stock" });

        // reduce stock
        product.stock -= quantity;
        await product.save();

        const order = new Order({
            orderNumber: createOrderNumber(),
            userId: req.user.id,
            items: [{
                productId: product._id,
                quantity,
                price: product.price
            }],
            total: product.price * quantity,
            status: "placed"
        });

        await order.save();

        res.json({ message: "Order placed successfully" });

    } catch (err) {
        console.log(err);
        res.status(500).send("Server Error");
    }
});

app.get("/orders", authMiddleware, async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .populate("items.productId");
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: view all orders
app.get("/admin/orders", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const orders = await Order.find({})
            .sort({ createdAt: -1 })
            .populate("items.productId")
            .populate("userId", "name email");
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: update order items (with stock adjustments)
app.patch("/admin/orders/:id/items", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const items = Array.isArray(req.body?.items) ? req.body.items : [];

        if (!items.length) {
            return res.status(400).json({ message: "At least one item is required" });
        }

        const normalized = items.map(i => ({
            productId: String(i.productId || "").trim(),
            quantity: Number(i.quantity)
        })).filter(i => i.productId);

        if (!normalized.length || normalized.some(i => !Number.isInteger(i.quantity) || i.quantity < 1)) {
            return res.status(400).json({ message: "Invalid items payload" });
        }

        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ message: "Order not found" });

        const currentQty = {};
        for (const item of order.items || []) {
            if (!item.productId) continue;
            const key = String(item.productId);
            currentQty[key] = (currentQty[key] || 0) + Number(item.quantity || 0);
        }

        const nextQty = {};
        for (const item of normalized) {
            nextQty[item.productId] = (nextQty[item.productId] || 0) + item.quantity;
        }

        const productIds = Object.keys(nextQty);
        const products = await Product.find({ _id: { $in: productIds } });
        const productMap = new Map(products.map(p => [String(p._id), p]));

        if (products.length !== productIds.length) {
            return res.status(400).json({ message: "One or more products are missing" });
        }

        for (const productId of new Set([...Object.keys(currentQty), ...productIds])) {
            const oldQty = currentQty[productId] || 0;
            const newQty = nextQty[productId] || 0;
            const diff = newQty - oldQty;
            if (diff > 0) {
                const product = productMap.get(productId);
                if (!product || product.stock < diff) {
                    return res.status(400).json({ message: "Not enough stock for update" });
                }
            }
        }

        for (const productId of new Set([...Object.keys(currentQty), ...productIds])) {
            const oldQty = currentQty[productId] || 0;
            const newQty = nextQty[productId] || 0;
            const diff = newQty - oldQty;
            if (diff !== 0) {
                const product = productMap.get(productId);
                if (!product) continue;
                product.stock -= diff;
                await product.save();
            }
        }

        const newItems = productIds.map(productId => {
            const product = productMap.get(productId);
            return {
                productId,
                quantity: nextQty[productId],
                price: product.price
            };
        });

        order.items = newItems;
        order.total = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        order.updatedAt = new Date();
        await order.save();

        const updated = await Order.findById(id)
            .populate("items.productId")
            .populate("userId", "name email");

        res.json({ message: "Order items updated", order: updated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: update order status / payment / refund
app.patch("/admin/orders/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            status,
            paymentStatus,
            refundStatus,
            refundReason
        } = req.body || {};

        const statusValues = ["placed", "processing", "shipped", "delivered", "cancelled", "refunded"];
        const paymentValues = ["pending", "paid", "refunded"];
        const refundValues = ["none", "requested", "approved", "rejected"];

        const update = {};
        if (status && statusValues.includes(status)) update.status = status;
        if (paymentStatus && paymentValues.includes(paymentStatus)) update.paymentStatus = paymentStatus;
        if (refundStatus && refundValues.includes(refundStatus)) update.refundStatus = refundStatus;
        if (typeof refundReason === "string") update.refundReason = refundReason.trim();

        if (update.refundStatus === "approved") {
            update.paymentStatus = "refunded";
            update.status = "refunded";
        }

        update.updatedAt = new Date();

        const order = await Order.findByIdAndUpdate(id, update, { new: true })
            .populate("items.productId")
            .populate("userId", "name email");

        if (!order) return res.status(404).json({ message: "Order not found" });
        res.json({ message: "Order updated", order });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: export orders as CSV
app.get("/admin/orders/export", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const orders = await Order.find({})
            .sort({ createdAt: -1 })
            .populate("userId", "name email")
            .populate("items.productId");

        const header = [
            "orderNumber",
            "orderId",
            "userName",
            "userEmail",
            "status",
            "paymentMethod",
            "paymentStatus",
            "refundStatus",
            "refundReason",
            "total",
            "createdAt",
            "updatedAt",
            "items"
        ].join(",");

        const rows = orders.map(order => {
            const items = (order.items || []).map(item => {
                const name = item.productId?.name || "Product";
                return `${name} x ${item.quantity}`;
            }).join(" | ");

            const values = [
                order.orderNumber || "",
                order._id,
                order.userId?.name || "",
                order.userId?.email || "",
                order.status || "",
                order.paymentMethod || "",
                order.paymentStatus || "",
                order.refundStatus || "",
                (order.refundReason || "").replace(/"/g, '""'),
                order.total || 0,
                order.createdAt ? order.createdAt.toISOString() : "",
                order.updatedAt ? order.updatedAt.toISOString() : "",
                items.replace(/"/g, '""')
            ];

            return values.map(v => `"${String(v)}"`).join(",");
        });

        const csv = [header, ...rows].join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=\"orders.csv\"");
        res.send(csv);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: list users (basic profile)
app.get("/admin/users", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const users = await User.find({})
            .select("name email isAdmin")
            .sort({ name: 1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: dashboard stats
app.get("/admin/stats", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const [userCount, orderCount, productCount] = await Promise.all([
            User.countDocuments({}),
            Order.countDocuments({}),
            Product.countDocuments({})
        ]);

        const revenueAgg = await Order.aggregate([
            { $group: { _id: null, total: { $sum: "$total" } } }
        ]);
        const revenue = revenueAgg[0]?.total || 0;

        const lowStock = await Product.find({ stock: { $lte: 5 } })
            .select("name stock")
            .sort({ stock: 1 })
            .limit(8);

        res.json({
            userCount,
            orderCount,
            productCount,
            revenue,
            lowStock
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
