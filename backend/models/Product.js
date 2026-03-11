const mongoose = require("../db");

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    stock: {
        type: Number,
        required: true,
        min: 0
    },
    image: String,
    category: {
        type: String,
        default: "general",
        trim: true,
        lowercase: true
    }
});

module.exports = mongoose.model("Product", productSchema);
