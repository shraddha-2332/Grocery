const mongoose = require("mongoose");

const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/grocerydb";
mongoose.connect(mongoUri)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

module.exports = mongoose;
