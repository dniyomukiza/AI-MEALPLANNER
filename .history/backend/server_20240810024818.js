const express = require('express');
const multer = require('multer');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const mongoose = require("mongoose");
const bcrypt = require('bcrypt');
const { User, Health } = require('./mongodb');
require('dotenv').config();

const app = express();
const upload = multer({ dest: 'uploads/' });
const saltRounds = 10;

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

function fileToGenerativePart(filePath, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
      mimeType
    },
  };
}

// Routes
app.get('/', (req, res) => {
  res.render('home');
});

app.get('/signup', (req, res) => {
  res.render('signup');
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.get('/upload_photo', (req, res) => {
  res.render('upload_photo');
});


app.post('/signup', async (req, res) => {
  try {
    const hashed_password = await bcrypt.hash(req.body.password, saltRounds);
    const userData = {
      username: req.body.username,
      password: hashed_password
    };
    const existingUser = await User.findOne({ username: userData.username });
    if (existingUser) {
      return res.redirect('/login');
    }
    const user = new User(userData);
    await user.save();

    const healthConditions = req.body.health_conditions || [];
    const healthGoal = req.body.health_goals || '';
    const healthData = {
      userId: user._id,
      health_cond: healthConditions,
      goal: healthGoal
    };
    const health = new Health(healthData);
    await health.save();

    res.render('home');
  } catch (err) {
    console.error('Error during signup:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/login', async (req, res) => {
  try {
    const checkUser = await User.findOne({ username: req.body.username });
    if (checkUser && await bcrypt.compare(req.body.password, checkUser.password)) {
      res.render('home');
    } else {
      res.send('Incorrect username or password');
    }
  } catch (err) {
    res.send('Wrong credentials');
  }
});

app.post('/analyze-image', upload.single('image'), async (req, res) => {
  try {

    // Check if the request contains an image file
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload an image file.' });
    }

    // Get the generative model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const prompt = "What are the food items you see in this image?";
    const imageParts = [fileToGenerativePart(req.file.path, req.file.mimetype)];

    // Generate content
    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    // Delete the uploaded file
    fs.unlinkSync(req.file.path);

    // Send the response
    res.json({ items: text });

  } catch (error) {
    console.log('Error analyzing image:', error);
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