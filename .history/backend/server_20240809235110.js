const mongoose = require("mongoose");
const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const { User, Health } = require('./mongodb');

// Express App Setup
const app = express();

// Path to my-app/templates directory
const templatePath = path.join(__dirname, '../my-app/templates');
console.log('Template Path:', templatePath);

// Setting up static files and view engine
app.use('/images', express.static(path.join(__dirname, '../my-app/images')));
app.use(express.static(path.join(__dirname, '../my-app/public')));
app.set('view engine', 'hbs');
app.set('views', templatePath);

// Parsing incoming requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.get('/', (req, res) => {
  res.render('home');
});


app.get('/signup', (req, res) => {
  res.render('signup');
});

app.get('/login', (req, res) => {
  res.render('login');
});


app.post('/signup', async (req, res) => {

  hashed_password = await bcrypt.hash(req.body.password, saltRounds);
  try {
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
    
    // Health data
    const healthConditions = req.body.health_conditions || [];
    const healthGoal = req.body.health_goals || '';
    const healthData = {
      userId: user._id,
      health_cond: healthConditions,
      goal: healthGoal
    };

    // Create a new health record for the user
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

// Start the server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});