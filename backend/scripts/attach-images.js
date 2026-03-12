const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const Product = require(path.join(__dirname, "..", "models", "Product"));

const args = process.argv.slice(2);
const getArg = (name) => {
    const idx = args.findIndex(a => a === name || a.startsWith(`${name}=`));
    if (idx === -1) return null;
    const arg = args[idx];
    if (arg.includes("=")) return arg.split("=").slice(1).join("=");
    return args[idx + 1] || null;
};

const imageDir = getArg("--dir");
const overwriteAll = args.includes("--all");
const dryRun = args.includes("--dry-run");

if (!imageDir) {
    console.error("Usage: node scripts/attach-images.js --dir <image-folder> [--all] [--dry-run]");
    process.exit(1);
}

const allowedExt = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const normalize = (value) =>
    String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");

const fileStem = (filename) => normalize(path.basename(filename, path.extname(filename)));

const shouldUpdate = (image) => {
    if (overwriteAll) return true;
    if (!image) return true;
    return String(image).startsWith("/uploads/");
};

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

const pickBestMatch = (productName, files) => {
    const productNorm = normalize(productName);
    if (!productNorm) return null;
    let best = null;
    let bestScore = 0;

    for (const file of files) {
        const stem = fileStem(file);
        if (!stem) continue;
        if (stem.includes(productNorm)) {
            const score = productNorm.length;
            if (score > bestScore) {
                best = file;
                bestScore = score;
            }
        }
    }

    return best;
};

async function main() {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/grocerydb";
    await mongoose.connect(mongoUri);

    const entries = fs.readdirSync(imageDir, { withFileTypes: true });
    const imageFiles = entries
        .filter(e => e.isFile())
        .map(e => e.name)
        .filter(f => allowedExt.has(path.extname(f).toLowerCase()));

    if (!imageFiles.length) {
        console.log("No images found in folder.");
        process.exit(0);
    }

    const products = await Product.find({});
    let updated = 0;
    let skipped = 0;
    let unmatched = 0;

    for (const product of products) {
        if (!shouldUpdate(product.image)) {
            skipped += 1;
            continue;
        }

        const match = pickBestMatch(product.name, imageFiles);
        if (!match) {
            unmatched += 1;
            continue;
        }

        const filePath = path.join(imageDir, match);
        const dataUrl = buildDataUrl(filePath);

        if (dryRun) {
            console.log(`[dry-run] ${product.name} <- ${match}`);
        } else {
            product.image = dataUrl;
            await product.save();
            console.log(`Updated ${product.name} <- ${match}`);
        }
        updated += 1;
    }

    console.log(`Done. updated=${updated} skipped=${skipped} unmatched=${unmatched}`);
    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
