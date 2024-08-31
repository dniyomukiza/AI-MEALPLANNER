const express = require('express');
const multer = require('multer');
const path = require('path');
const flash = require('express-flash');
const session = require('express-session');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const mongoose = require("mongoose");
const bcrypt = require('bcrypt');
const { User, Health, FoodInventory } = require('./mongodb');
require('dotenv').config();
const app = express();
const upload = multer({ dest: 'uploads/' });
const saltRounds = 10;
const axios = require('axios');
const pluralize = require('pluralize');

//The session secret is used to create a hash (or signature) of the session ID. 
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

// Create a transporter object using environment variables
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


// Path to my-app/templates directory
const templatePath = path.join(__dirname, '../frontend/templates');

// Setting up static files and view engine
app.use('/images', express.static(path.join(__dirname, '../frontend/images')));
app.use(express.static(path.join(__dirname, '../frontend/styles')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
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

app.get('/guest', (req, res) => {
  res.render('guest');
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
app.get('/upload_photo', async (req, res) => {

  // Fetch the user data from a database or session
  const user = await User.findById(req.session.userId); 

  // Render the template with the user context
  res.render('upload_photo', { user });
});


// Modify the analyze-image route to work for guests
app.post('/analyze-image-guest', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload an image file.' });
    }

    // Get the generative model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const prompt = "What are the food items you see in this image? Split the food items by comma";
    const imageParts = [fileToGenerativePart(req.file.path, req.file.mimetype)];

    // Generate content from the image
    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    fs.unlinkSync(req.file.path);

    res.json({ items: text, message: 'Items detected' });
  } catch (error) {
    res.status(500).json({
      error: 'Image analysis failed.',
      details: error.message
    });
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = process.env.PROFILE_PATH || 'uploads'; // Fallback to 'uploads' if PROFILE_PATH is not set
    cb(null, path.resolve(__dirname, uploadPath)); // Resolve to absolute path
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const username = req.body.username || 'default'; // Use a default if username is not provided
    cb(null, `${username}_photo${ext}`);
  }
});

const upload_profile = multer({ storage: storage });


// Modify the generate_meals route to work for guests
app.post('/generate_meals_guest', async (req, res) => {
  try {
    const { ingredients } = req.body;

    if (!ingredients || !Array.isArray(ingredients)) {
      return res.status(400).json({ error: 'Invalid ingredients list' });
    }

    // Make a request to the Spoonacular API
    const response = await axios.get(`https://api.spoonacular.com/recipes/findByIngredients`, {
      params: {
        ingredients: ingredients.join(','),
        apiKey: process.env.SPOONACULAR_KEY,
        number: 5
      }
    });

    // Get the recipes from the response
    const recipes = response.data;

    // Function to get recipe instructions
    const getRecipeInstructions = async (recipeId) => {
      try {
        const recipeResponse = await axios.get(`https://api.spoonacular.com/recipes/${recipeId}/information`, {
          params: {
            apiKey: process.env.SPOONACULAR_KEY
          }
        });
        return recipeResponse.data.instructions;
      } catch (error) {
        console.error('Error retrieving recipe instructions:', error);
        return 'Instructions not available';
      }
    };

    // Use Promise.all to wait for all instructions
    const mealsWithInstructions = await Promise.all(recipes.map(async (meal) => {
      // Get the instructions for each recipe
      const instructions = await getRecipeInstructions(meal.id);

      // Return a structured object with the meal data
      return {
        id: meal.id,
        title: meal.title,
        image: meal.image,
        usedIngredients: meal.usedIngredients.map(ingredient => ({
          name: ingredient.name,
          amount: ingredient.amount,
          unit: ingredient.unit
        })),
        missedIngredients: meal.missedIngredients.map(ingredient => ({
          name: ingredient.name,
          amount: ingredient.amount,
          unit: ingredient.unit
        })),
        instructions: instructions
      };
    }));

    // Sort the meals by the number of missed ingredients
    mealsWithInstructions.sort((a, b) => a.missedIngredients.length - b.missedIngredients.length);

    // Send the structured data to the front end
    res.json({ meals: mealsWithInstructions });
  } catch (error) {
    console.error('Error retrieving recipes:', error);
    res.status(500).send('Internal Server Error');
  }
});




app.post('/signup', upload.single('profile_picture'), async (req, res) => {
  try {
    const { username, password, user_email, food_intolerances, health_goals } = req.body;
    const profilePicturePath = req.file ? req.file.filename : null;
    console.log('File info:', req.file);
    // Normalize the username to lowercase for case-insensitive comparison
    const normalizedUsername = username.toLowerCase();

    // Check if user already exists 
    const existingUser = await User.findOne({ username: normalizedUsername });

    if (existingUser) {
      req.flash('error', 'This user already exists. Please login or reset password');
      return res.redirect('/login');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create and save new user
    const newUser = new User({
      username: normalizedUsername, // Save the username in lowercase
      password: hashedPassword,
      user_email,
      profile_picture: profilePicturePath // Save the profile picture path
    });

    await newUser.save();

    // Create and save health data
    const healthData = new Health({
      userId: newUser._id,
      health_cond: food_intolerances || [],
      goal: health_goals || ''
    });

    await healthData.save();
    console.log('Food Intolerances:', healthData.health_cond);

    // Set flash message and redirect to login page
    req.flash('success', 'Registration successful. Please log in.');

    return res.redirect('/login'); // Ensure this return statement exits the function
  } catch (error) {
    console.error('Error during signup:', error);
    req.flash('error', 'Internal Server Error');
    return res.redirect('/signup'); // Ensure this return statement exits the function
  }
});


// login user
app.post('/login', async (req, res) => {
  try {
    // Convert username to lowercase for case-insensitive search
    const username = req.body.username.toLowerCase();
    
    // Find user by lowercase username
    const user = await User.findOne({ username: new RegExp('^' + username + '$', 'i') });

    if (user) {
      if (await bcrypt.compare(req.body.password, user.password)) {
        req.session.userId = user._id; //
        res.redirect('/upload_photo'); 
      } else {
        req.flash('success', 'Incorrect password!');
        res.redirect(`/reset?username=${encodeURIComponent(req.body.username)}`); 
      }
    } else {
      // Flash a message and redirect to the signup page if the user does not exist
      req.flash('error', 'This user does not exist. Please register!');
      res.redirect('/signup');
    }
  } catch (err) {
    res.status(500).send('Server Error');
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

app.get('/generate_meals', async (req, res) => {
  try {

    // Find the user's food inventory
    const inventory = await FoodInventory.findOne({ userId: req.session.userId });

    console.log(inventory);

    // If the inventory doesn't exist, initialize an empty array
    const items = inventory ? inventory.items : [];

    // Extract the 'name' attribute from each item
    const ingredientList = items.map(item => item.name);

    // Make a request to the Spoonacular API
    const response = await axios.get(`https://api.spoonacular.com/recipes/findByIngredients`, {
      params: {
        ingredients: ingredientList.join(','),
        apiKey: process.env.SPOONACULAR_KEY,
        number: 10
      }
    });

    // Get the recipes from the response
    const recipes = response.data;

    // Function to get recipe instructions
    const getRecipeInstructions = async (recipeId) => {
      try {
        const recipeResponse = await axios.get(`https://api.spoonacular.com/recipes/${recipeId}/information`, {
          params: {
            apiKey: process.env.SPOONACULAR_KEY
          }
        });
        return recipeResponse.data.instructions;
      } catch (error) {
        console.error('Error retrieving recipe instructions:', error);
        return 'Instructions not available';
      }
    };

   
    // Use Promise.all to wait for all instructions
    const mealsWithInstructions = await Promise.all(recipes.map(async (meal) => {

      // Get the instructions for each recipe
      const instructions = await getRecipeInstructions(meal.id);

      // Return a structured object with the meal data
      return {
        id: meal.id,
        title: meal.title,
        image: meal.image,
        usedIngredients: meal.usedIngredients.map(ingredient => ({
          name: ingredient.name,
          amount: ingredient.amount,
          unit: ingredient.unit
        })),
        missedIngredients: meal.missedIngredients.map(ingredient => ({
          name: ingredient.name,
          amount: ingredient.amount,
          unit: ingredient.unit
        })),
        instructions: instructions
      };
    }));

    // Sort the meals by the number of missed ingredients
    mealsWithInstructions.sort((a, b) => a.missedIngredients.length - b.missedIngredients.length);

    // Send the structured data to the front end
    res.json({ meals: mealsWithInstructions });

  } catch (error) {
    console.error('Error retrieving recipes:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Lists the food items from the image and inserts them into the user's inventory
app.post('/analyze-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload an image file.' });
    }

    // Get the generative model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const prompt = "What are the food items you see in this image? Split the food items by comma";
    const imageParts = [fileToGenerativePart(req.file.path, req.file.mimetype)];

    // Generate content from the image
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


app.get('/inventory', isAuthenticated, async (req, res) => {
  try {

    // Find the user's food inventory
    const inventory = await FoodInventory.findOne({ userId: req.session.userId });

    // If the inventory doesn't exist, initialize an empty array
    const items = inventory ? inventory.items : [];

    res.json({ items });
  
  } catch (error) {
    console.error('Error retrieving inventory:', error);
    res.status(500).send('Internal Server Error');
  }
});


app.post('/delete_item', isAuthenticated, async (req, res) => {
  try {

    // Get the item to delete from the query string
    const { item } = req.query;

    if (!item) {
      return res.status(400).json({ error: 'Item name is required' });
    }

    // Find the user's food inventory
    const inventory = await FoodInventory.findOne({ userId: req.session.userId });

    if (!inventory) {
      return res.status(404).json({ error: 'Inventory not found' });
    }

    // Remove the item from the inventory by filtering out the item to delete
    inventory.items = inventory.items.filter(i => i.name !== item);

    // Save the updated inventory
    await inventory.save();
    
    // Send a success response
    res.json({ message: 'Item deleted successfully' });

  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

//Display form to user
app.route('/reset')
  .get((req, res) => {
    res.render('reset'); 
  })

//Reset route
app.route('/reset')
  .post(async (req, res) => {
    const { username, user_email } = req.body;

    if (!username || !user_email) {
      return res.status(400).send('Username and email are required');
    }

    try {
      const user = await User.findOne({ username });

      if (!user) {
        return res.status(404).send('User not found');
      }

      function generateResetToken() {
        return crypto.randomBytes(32).toString('hex');
      }

      // Generate and store reset token
      const resetToken = generateResetToken();
      const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now

      await User.updateOne(
        { username },
        { user_email, resetToken, resetTokenExpiry }
      );

      // Send email with reset link
      const resetLink = `http://localhost:3000/update_password?token=${resetToken}`;
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user_email,
        subject: 'Password Reset',
        text: `Click the link to reset your password: ${resetLink}`
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error(error);
          return res.status(500).send('Error sending email');
        }
        res.send('Password reset link sent');
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Server Error');
    }
  });

  app.route('/update_password')
  .get(async (req, res) => {
    const { token } = req.query;

    if (!token) {
      return res.status(400).send('Token is required');
    }

    try {
      const user = await User.findOne({
        resetToken: token,
        resetTokenExpiry: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(400).send('Invalid or expired token');
      }

      // Render reset password form
      res.render('update_password', { token });
    } catch (error) {
      console.error(error);
      res.status(500).send('Server Error');
    }
  })
  .post(async (req, res) => {
    const { token, new_password } = req.body;

    if (!token || !new_password) {
      return res.status(400).send('Token and new password are required');
    }

    try {
      const user = await User.findOne({
        resetToken: token,
        resetTokenExpiry: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(400).send('Invalid or expired token');
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(new_password, 10);

      // Update the user's password and clear the reset token
      await User.updateOne(
        { resetToken: token },
        { password: hashedPassword, resetToken: null, resetTokenExpiry: null }
      );
      req.flash('success', 'Your password has been updated!');
      // Redirect to login page
      res.redirect('/login');
    } catch (error) {
      console.error(error);
      res.status(500).send('Server Error');
    }
  });

  // Start the server
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
  

//Display form to user
app.get('/filtered_meals', async (req, res) => {
  try {
    // Fetch the user's profile data
    const user = await User.findById(req.session.userId);

    // Render the template and pass the user object
    res.render('filtered', { user: user });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/filter_meals', async (req, res) => {
  try {
    // Find the user's intolerances
    const healthData = await Health.findOne({ userId: req.session.userId });

    if (!healthData) {
      console.log("No health data found for this user.");
      return res.json({ meals: [], removed: [] }); // Return empty arrays if no data is found
    }

    // Extract the intolerances from healthData
    const intoleranceArray = healthData.health_cond || [];

    // Find the user's food inventory
    const inventory = await FoodInventory.findOne({ userId: req.session.userId });

    // If the inventory doesn't exist, initialize an empty array
    const items = inventory ? inventory.items : [];

    // Extract the 'name' attribute from each item
    const ingredientList = items.map(item => item.name);

    // Make a request to the Spoonacular API
    const response = await axios.get(`https://api.spoonacular.com/recipes/findByIngredients`, {
      params: {
        ingredients: ingredientList.join(','),
        apiKey: process.env.SPOONACULAR_KEY,
        number: 5,
        intolerances: intoleranceArray.join(",") // Add intolerances to API request
      }
    });

    // Get the recipes from the response
    const recipes = response.data;
    // Function to get recipe instructions
    const getRecipeInstructions = async (recipeId) => {
      try {
        const recipeResponse = await axios.get(`https://api.spoonacular.com/recipes/${recipeId}/information`, {
          params: {
            apiKey: process.env.SPOONACULAR_KEY
          }
        });
        return recipeResponse.data.instructions;
      } catch (error) {
        console.error('Error retrieving recipe instructions:', error);
        return 'Instructions not available';
      }
    };

    // Use Promise.all to wait for all instructions
    const mealsWithInstructions = await Promise.all(recipes.map(async (meal) => {

      // Track removed intolerances
      const removedIntolerances = intoleranceArray.filter(intolerance =>
        meal.missedIngredients.some(ingredient => ingredient.name.toLowerCase().includes(intolerance.toLowerCase()))
      );

      // Get the instructions for each recipe
      const instructions = await getRecipeInstructions(meal.id);

      // Return a structured object with the meal data
      return {
        id: meal.id,
        title: meal.title,
        image: meal.image,
        usedIngredients: meal.usedIngredients.map(ingredient => ({
          name: ingredient.name,
          amount: ingredient.amount,
          unit: ingredient.unit
        })),
        missedIngredients: meal.missedIngredients.map(ingredient => ({
          name: ingredient.name,
          amount: ingredient.amount,
          unit: ingredient.unit
        })),
        removedIntolerances: removedIntolerances.length > 0 ? removedIntolerances : ['None'],
        instructions: instructions
      };
    }));

    // Sort the meals by the number of missed ingredients
    mealsWithInstructions.sort((a, b) => a.missedIngredients.length - b.missedIngredients.length);

    // Send the structured data to the front end
    res.json({ meals: mealsWithInstructions, removedIntolerances: intoleranceArray });

  } catch (error) {
    console.error('Error retrieving recipes:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/meal_plan', isAuthenticated, async (req, res) => {
  try {
    const num_of_days = parseInt(req.query.days) || 1;
    
    // Find the user's food inventory
    const inventory = await FoodInventory.findOne({ userId: req.session.userId });
    let availableIngredients = inventory ? inventory.items.map(item => pluralize.singular(item.name.toLowerCase())) : [];
    
    // Fetch user health data for dietary restrictions
    const healthData = await Health.findOne({ userId: req.session.userId });
    let intolerances = healthData ? healthData.health_cond : [];
    intolerances = intolerances.length > 0 ? intolerances.join(',') : '';

    // Create an array to store the meal plan
    const mealPlan = [];
    const totalUsedIngredients = new Set();

    for (let day = 0; day < num_of_days; day++) {
      const dayMeals = {};
      for (const mealType of ['breakfast', 'lunch', 'dinner']) {
        
        // Create a string of available ingredients
        const ingredientListString = availableIngredients.join(',');

        // Make a request to the Spoonacular API to find a recipe
        const recipesResponse = await axios.get('https://api.spoonacular.com/recipes/findByIngredients', {
          params: {
            ingredients: ingredientListString,
            apiKey: process.env.SPOONACULAR_KEY,
            number: 1,
            type: mealType, // Add meal type to get more appropriate recipes
            intolerances: intolerances
          }
        });

        if (recipesResponse.data.length > 0) {
          const meal = recipesResponse.data[0];
          const instructions = await getRecipeInstructions(meal.id);

          // Add the meal to the day's meals
          dayMeals[mealType] = {
            id: meal.id,
            title: meal.title,
            image: meal.image,
            usedIngredients: meal.usedIngredients.map(ingredient => ({
              name: pluralize.singular(ingredient.name.toLowerCase()),
              amount: ingredient.amount,
              unit: ingredient.unit
            })),
            missedIngredients: meal.missedIngredients.map(ingredient => ({
              name: pluralize.singular(ingredient.name.toLowerCase()),
              amount: ingredient.amount,
              unit: ingredient.unit
            })),
            instructions: instructions
          };

          // Update total used ingredients and available ingredients 
          meal.usedIngredients.forEach(ingredient => {
            const ingredientName = pluralize.singular(ingredient.name.toLowerCase());
            totalUsedIngredients.add(ingredientName);

            // Remove the used ingredient from availableIngredients
            availableIngredients = availableIngredients.filter(item => 
              item !== ingredientName
            );
          });

          console.log('Available:', availableIngredients);
          console.log('Used Ingredients:', Array.from(totalUsedIngredients));
        } else {
          dayMeals[mealType] = null;
        }
      }
      mealPlan.push(dayMeals);
    }

    // Convert the set of used ingredients to an array
    const leftoverIngredients = availableIngredients;

    console.log('Meal Plan:', mealPlan);

    // Return the meal plan and leftover ingredients to the client
    res.json({ mealPlan, leftoverIngredients });
  } catch (error) {
    console.error('Error generating meal plan:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

// Helper function to get recipe instructions
async function getRecipeInstructions(recipeId) {
  try {
    const recipeResponse = await axios.get(`https://api.spoonacular.com/recipes/${recipeId}/information`, {
      params: {
        apiKey: process.env.SPOONACULAR_KEY
      }
    });
    return recipeResponse.data.instructions;
  } catch (error) {
    console.error('Error retrieving recipe instructions:', error);
    return 'Instructions not available';
  }
}


app.post('/save_recipes', (req, res) => {
  const { username, recipes } = req.body;

  // Read existing data
  const filePath = path.join(__dirname, 'user_recipes.txt');
  fs.readFile(filePath, 'utf8', (err, data) => {
      let usersData = {};

      if (!err && data) {
          usersData = JSON.parse(data);
      }

      // Update the user's selected meals
      usersData[username] = recipes;

      // Save the updated data back to the file
      fs.writeFile(filePath, JSON.stringify(usersData, null, 2), (err) => {
          if (err) {
              console.error('Error writing to file', err);
              return res.status(500).json({ message: 'Failed to save recipe selection' });
          }
          res.status(200).json({ message: 'Recipe selection saved successfully' });
      });
  });
});