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

const csvPath = getArg("--csv");
const imageDir = getArg("--dir");
const dryRun = args.includes("--dry-run");

if (!csvPath || !imageDir) {
    console.error("Usage: node scripts/import-image-mapping.js --csv <mapping.csv> --dir <image-folder> [--dry-run]");
    process.exit(1);
}

const allowedExt = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

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

const parseCsv = (content) => {
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    const header = lines.shift();
    if (!header) return [];
    const cols = header.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    const rows = [];

    for (const line of lines) {
        const values = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i += 1) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i += 1;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }
            if (ch === "," && !inQuotes) {
                values.push(current);
                current = "";
                continue;
            }
            current += ch;
        }
        values.push(current);

        const row = {};
        cols.forEach((col, idx) => {
            row[col] = values[idx] !== undefined ? values[idx] : "";
        });
        rows.push(row);
    }

    return rows;
};

async function main() {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/grocerydb";
    await mongoose.connect(mongoUri);

    const csv = fs.readFileSync(csvPath, "utf8");
    const rows = parseCsv(csv);

    let updated = 0;
    let skipped = 0;
    let missing = 0;

    for (const row of rows) {
        const productId = String(row.productId || "").trim();
        const filename = String(row.filename || "").trim();
        if (!productId || !filename) {
            skipped += 1;
            continue;
        }

        const ext = path.extname(filename).toLowerCase();
        if (!allowedExt.has(ext)) {
            console.log(`Skipping ${productId}: unsupported extension ${ext}`);
            skipped += 1;
            continue;
        }

        const filePath = path.join(imageDir, filename);
        if (!fs.existsSync(filePath)) {
            console.log(`Missing file for ${productId}: ${filename}`);
            missing += 1;
            continue;
        }

        const dataUrl = buildDataUrl(filePath);
        if (dryRun) {
            console.log(`[dry-run] ${productId} <- ${filename}`);
        } else {
            await Product.findByIdAndUpdate(productId, { image: dataUrl });
            console.log(`Updated ${productId} <- ${filename}`);
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
