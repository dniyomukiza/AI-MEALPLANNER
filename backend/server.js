const express = require('express');
const multer = require('multer');
const path = require('path');
const flash = require('express-flash');
const session = require('express-session');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const mongoose = require("mongoose");
const bcrypt = require('bcrypt');
const { User, Health, FoodInventory } = require('./mongodb');
require('dotenv').config();
const app = express();
const upload = multer({ dest: 'uploads/' });
const saltRounds = 10;


//The session secret is used to create a hash (or signature) of the session ID. 
//When the server receives a session cookie from a client, it verifies that the session ID has not been 
//altered by checking the hash.
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 60000 * 60 * 24,  
    secure: process.env.NODE_ENV === 'production', 
    httpOnly: true           
  }
}));

app.use(flash());
// Middleware to check if user is logged in
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
};


// Path to my-app/templates directory
const templatePath = path.join(__dirname, '../my-app/templates');

// Setting up static files and view engine
app.use('/images', express.static(path.join(__dirname, '../my-app/images')));
app.use(express.static(path.join(__dirname, '../my-app/public')));
app.set('view engine', 'hbs');
app.set('views', templatePath);

// Parsing incoming requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Google AI setup
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

app.get('/', (req, res) => {
  res.render('home');
});

// Display login page directly when accessing root
app.get('/login', (req, res) => {
  res.render('login');
});

// Display signup page directly when accessing root
app.get('/signup', (req, res) => {
  res.render('signup');
});

// Display the user's inventory
app.get('/upload_photo', (req, res) => {
  res.render('upload_photo');
});

// Register user
app.post('/signup', async (req, res) => {
  try {
    // Hash the password
    const hashed_password = await bcrypt.hash(req.body.password, saltRounds);
    const userData = {
      username: req.body.username,
      password: hashed_password
    };

    // Check if the user already exists
    const existingUser = await User.findOne({ username: userData.username });
    if (existingUser) {
      // Flash a message and redirect to login
      req.flash('error', 'This user already exists! Please log in.');
      return res.redirect('/login');
    }

    // If user doesn't exist, create a new user
    const user = new User(userData);
    await user.save();

    // Save health data
    const healthConditions = req.body.health_conditions || [];
    const healthGoal = req.body.health_goals || '';
    const healthData = {
      userId: user._id,
      health_cond: healthConditions,
      goal: healthGoal
    };

    // Save the health data
    const health = new Health(healthData);
    await health.save();

    // Flash a success message and redirect to login
    req.flash('success', 'Account created successfully! Please log in.');
    res.redirect('/login'); 
  } catch (err) {
    console.error('Error during signup:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Route to display the login page
app.get('/login', (req, res) => {
  res.render('login', { messages: req.flash('error') });
});
// login user
app.post('/login', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.body.username });
    if (user && await bcrypt.compare(req.body.password, user.password)) {
      res.render('upload_photo');

      // Save the user ID in the session
      req.session.userId = user._id;
    } else {
      res.send('Incorrect username or password');
    }
  } catch (err) {
    res.send('Wrong credentials');
  }
});

//logs the user out and destroys the session
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/home');
  });
});

// Splits the text by comma and adds the new items to user inventory
async function addToUserInventory(userId, items) {
  try {
    let inventory = await FoodInventory.findOne({ userId: userId });
    
    if (!inventory) {
      inventory = new FoodInventory({ userId: userId, items: [] });
    }
    
    // Split the text by comma and add the new items to the inventory
    const newItems = items.split(',').map(item => ({ name: item.trim() })).filter(item => item.name !== '');
    inventory.items.push(...newItems);

    // Save the inventory
    await inventory.save();
    console.log('Items added to inventory successfully');

  } catch (error) {
    console.error('Error adding items to inventory:', error);
    throw error;
  }
}

//Converts the file to a generative part so that it can be used as input to the generative model
function fileToGenerativePart(filePath, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
      mimeType
    },
  };
}

// Lists the food items from the image and inserts them into the user's inventory
app.post('/analyze-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload an image file.' });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const prompt = "What are the food items you see in this image? Split the food items by comma";
    const imageParts = [fileToGenerativePart(req.file.path, req.file.mimetype)];

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    await addToUserInventory(req.session.userId, text);
    fs.unlinkSync(req.file.path);

    res.json({ items: text, message: 'Item has been recorded' });
  } catch (error) {
    res.status(500).json({
      error: 'Image analysis failed.',
      details: error.message
    });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});