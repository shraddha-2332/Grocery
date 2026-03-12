const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const Product = require(path.join(__dirname, "..", "models", "Product"));

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const uploadsDir = path.join(__dirname, "..", "uploads");

const buildDataUrl = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const mime =
        ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
            : ext === ".png" ? "image/png"
                : ext === ".webp" ? "image/webp"
                    : ext === ".gif" ? "image/gif"
                        : "application/octet-stream";
    const base64 = fs.readFileSync(filePath).toString("base64");
    return `data:${mime};base64,${base64}`;
};

async function main() {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/grocerydb";
    await mongoose.connect(mongoUri);

    if (!fs.existsSync(uploadsDir)) {
        console.error(`Uploads folder not found: ${uploadsDir}`);
        process.exit(1);
    }

    const products = await Product.find({});
    let updated = 0;
    let skipped = 0;
    let missing = 0;

    for (const product of products) {
        const image = String(product.image || "");
        if (!image.startsWith("/uploads/")) {
            skipped += 1;
            continue;
        }

        const filename = image.replace("/uploads/", "");
        const filePath = path.join(uploadsDir, filename);
        if (!fs.existsSync(filePath)) {
            console.log(`Missing file for ${product.name || product._id}: ${filename}`);
            missing += 1;
            continue;
        }

        const dataUrl = buildDataUrl(filePath);
        if (dryRun) {
            console.log(`[dry-run] ${product.name || product._id} <- ${filename}`);
        } else {
            product.image = dataUrl;
            await product.save();
            console.log(`Updated ${product.name || product._id} <- ${filename}`);
        }
        updated += 1;
    }

    console.log(`Done. updated=${updated} skipped=${skipped} missing=${missing}`);
    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
