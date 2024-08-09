const express = require('express');
const path = require('path');
const hbs = require('hbs');
const { User, Health } = require('./mongodb');

const app = express();
app.use('/images', express.static(path.join(__dirname, '../images')));
app.use(express.static(path.join(__dirname, '../public')));
const templatePath = path.join(__dirname, '../templates');
app.use(express.json());
app.set('view engine', 'hbs');
app.set('views', templatePath);
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
    try {
        const userData = {
            username: req.body.username,
            password: req.body.password
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
        if (checkUser && checkUser.password === req.body.password) {
            res.render('home');
        } else {
            res.send('Incorrect username or password');
        }
    } catch (err) {
        res.send('Wrong credentials');
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
