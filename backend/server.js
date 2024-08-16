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


app.post('/signup', async (req, res) => {
  try {
    const { username, password, user_email } = req.body;

    // Normalize the username to lowercase for case-insensitive comparison
    const normalizedUsername = username.toLowerCase();

    // Check if user already exists (case-insensitive search)
    const existingUser = await User.findOne({ username: normalizedUsername });

    if (existingUser) {
      req.flash('error', 'This user already exists. Please login or reset password');
      return res.redirect('/login'); // Ensure this return statement exits the function
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create and save new user
    const newUser = new User({
      username: normalizedUsername, // Save the username in lowercase
      password: hashedPassword,
      user_email
    });

    await newUser.save();

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
        res.redirect(`/reset?username=${encodeURIComponent(req.body.username)}`); // Redirect to reset if password is incorrect
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
  