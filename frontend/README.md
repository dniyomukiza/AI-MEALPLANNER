# Smart Meal Planning Application

Smart Meal Planning is a web application that helps users plan meals based on their available ingredients, dietary restrictions, and health goals. It uses AI-powered image recognition to identify food items and integrates with the Spoonacular API to generate recipe suggestions.

## Features

- User authentication and profile management
- AI-powered food item recognition from uploaded images
- Personalized meal suggestions based on available ingredients
- Dietary restriction and food intolerance filtering
- Multi-day meal planning
- Recipe saving and analytics

## Technologies Used

- Node.js
- Express.js
- MongoDB with Mongoose
- Google's Generative AI (Gemini 1.5 Pro)
- Spoonacular API
- Handlebars (HBS) for templating
- Multer for file uploads
- Nodemailer for email functionality
- bcrypt for password hashing
- Express-session for user sessions

## Setup and Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables in a `.env` file:
   - SESSION_SECRET
   - EMAIL_USER
   - EMAIL_PASS
   - API_KEY (for Google's Generative AI)
   - SPOONACULAR_KEY
   - PROFILE_PATH (optional, for profile picture uploads)
4. Ensure MongoDB is running and accessible
5. Start the server: `node server.js`

## API Endpoints

- `/`: Home page
- `/guest`: Guest user page
- `/login`: User login
- `/signup`: User registration
- `/reset`: Reset password
- `/upload_photo`: Photo upload for food recognition
- `/analyze-image`: AI analysis of uploaded food images
- `/generate_meals`: Generate meal suggestions
- `/filter_meals`: Filter meals based on dietary restrictions
- `/meal_plan`: Generate multi-day meal plans
- `/inventory`: Manage user's food inventory
- `/analytics`: View recipe popularity analytics

## Security Features

- Password hashing with bcrypt
- Secure session management
- CSRF protection with express-session
- Authenticated routes with middleware

## Future Improvements

- Implement OAuth for social login
- Add more detailed nutritional information
- Enhance the AI model for better food recognition
- Implement a mobile app version

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request with your proposed changes.

