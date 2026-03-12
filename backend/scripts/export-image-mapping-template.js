const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const Product = require(path.join(__dirname, "..", "models", "Product"));

async function main() {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/grocerydb";
    await mongoose.connect(mongoUri);

    const products = await Product.find({}).select("_id name image").sort({ name: 1 });

    const header = ["productId", "productName", "currentImage", "filename"].join(",");
    const rows = products.map(p => {
        const vals = [
            p._id,
            String(p.name || ""),
            String(p.image || ""),
            ""
        ];
        return vals.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });

    const csv = [header, ...rows].join("\n");
    const outPath = path.join(__dirname, "image-mapping-template.csv");
    fs.writeFileSync(outPath, csv);

    console.log(`Wrote ${outPath}`);
    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
