const mongoose = require("../db");

const orderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        unique: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    items: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product"
            },
            quantity: Number,
            price: Number
        }
    ],
    total: {
        type: Number,
        default: 0
    },
    paymentMethod: {
        type: String,
        enum: ["cod", "card", "upi"],
        default: "cod"
    },
    paymentStatus: {
        type: String,
        enum: ["pending", "paid", "refunded"],
        default: "pending"
    },
    refundStatus: {
        type: String,
        enum: ["none", "requested", "approved", "rejected"],
        default: "none"
    },
    refundReason: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        default: "placed"
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Order", orderSchema);
