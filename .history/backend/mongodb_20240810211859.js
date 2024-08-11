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
    ref: 'User',
    required: true,
    unique: true
  },
  health_cond: {
    type: [String],
    required: true
  },
  goal: {
    type: String,
    required: true
  }
});


const foodItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

});

// Define Food Inventory Schema
const foodInventorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [foodItemSchema]
});

// Create Models that use the schemas
const User = mongoose.model("User", userSchema);
const Health = mongoose.model("Health", healthSchema);
const FoodInventory = mongoose.model("FoodInventory", foodInventorySchema);

// Export Models
module.exports = { User, Health };