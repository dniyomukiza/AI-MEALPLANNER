const mongoose = require("mongoose");

mongoose.connect("mongodb://localhost:27017/userdb")
.then(() => console.log("Connected to MongoDB!"))
.catch(err => console.error("Failed to connect to MongoDB:", err));

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    }
});

const User = mongoose.model("User", userSchema);
module.exports = User;


