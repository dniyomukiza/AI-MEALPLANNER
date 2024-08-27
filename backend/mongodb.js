const mongoose = require("mongoose");

mongoose.connect("mongodb://localhost:27017/userdb")
  .then(() => console.log("Connected to MongoDB!"))
  .catch(err => console.error("Failed to connect to MongoDB:", err));

// Define User Schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique:true
  },
  password: {
    type: String,
    required: true
  },
  profile_picture: {
    type: String, 
    default: null
  },
  user_email: {
    type: String,
    required: false
  },
  resetToken: {
    type: String,
    required: false
  },
  resetTokenExpiry: {
    type: Date,
    required: false
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

const foodInventorySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{
      name: { type: String, required: true }
    }]
  });
  

// Create Models that use the schemas
const User = mongoose.model("User", userSchema);
const Health = mongoose.model("Health", healthSchema);
const FoodInventory = mongoose.model("FoodInventory", foodInventorySchema);

// Export Models
module.exports = { User, Health, FoodInventory };