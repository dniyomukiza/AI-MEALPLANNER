const mongoose = require("mongoose");

mongoose.connect("mongodb://localhost:27017/userdb")
    .then(() => console.log("Connected to MongoDB!"))
    .catch(err => console.error("Failed to connect to MongoDB:", err));

// Define User Schema
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

// Define Health Schema
const healthSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the User model
        required: true,
        unique: true // Ensures a one-to-one relationship
    },
    health_cond: {
        type: [String],  // Array of strings
        required: true
    },
    goal: {
        type: String,
        required: true
    }
});

// Create Models that use the schemas
const User = mongoose.model("User", userSchema);
const Health = mongoose.model("Health", healthSchema);

// Export Models
module.exports = { User, Health };


