# MealMate: Smart Meal Planning Application

MealMate is a web application that helps users plan meals based on their available ingredients, dietary restrictions, and health goals. It uses AI-powered image recognition to identify food items and integrates with the Spoonacular API to generate recipe suggestions.

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

## License

This project is licensed under the MIT License.

# Deploying to GitHub Pages with a Custom Domain

## Initial Setup

1. **Go to Your Repository**
   - Navigate to your GitHub repository in a web browser.

2. **Access Repository Settings**
   - Click the "Settings" tab at the top of your repository page.

3. **Navigate to Pages Settings**
   - In the left sidebar, select "Pages" under "Code and automation".

4. **Select Source**
   - Under "Source", choose your deployment branch (usually "main" or "master").
   - Select the appropriate root folder (typically "/ (root)").
   - Click "Save".

## Adding a Custom Domain

5. **Add Custom Domain**
   - Scroll to the "Custom domain" section.
   - Enter your custom domain (e.g., "www.yourdomain.com").
   - Click "Save".

6. **Verify Domain Ownership**
   - GitHub will add a CNAME file to your repository with your custom domain.
   - Commit this change if prompted.

## DNS Configuration

7. **Configure DNS Settings**
   - Go to your domain registrar's website.
   - Access the DNS settings for your domain.
   - Add the following DNS records:
     - For an apex domain (yourdomain.com):
       - Add four A records pointing to GitHub's IP addresses:
         ```
         185.199.108.153
         185.199.109.153
         185.199.110.153
         185.199.111.153
         ```
     - For a www subdomain:
       - Add a CNAME record pointing to your GitHub Pages URL:
         `<username>.github.io` or `<organization>.github.io`

8. **Wait for DNS Propagation**
   - DNS changes can take up to 24 hours to propagate globally.

## Finalizing Setup

9. **Enforce HTTPS**
   - In GitHub Pages settings, check "Enforce HTTPS".
   - Note: This may be unavailable initially; wait a few hours and refresh.

10. **Verify Custom Domain**
    - GitHub will automatically verify your custom domain.
    - Look for a success message in the Pages settings.

11. **Test Your Custom Domain**
    - Open a new browser tab and navigate to your custom domain.
    - Your GitHub Pages site should be accessible via your custom domain.

## Additional Steps

12. **Update Repository Settings (Optional)**
    - Update your repository description or website field with your new custom domain.

13. **Maintain CNAME File**
    - Ensure the CNAME file remains in your repository's root.
    - For static site generators, add this file to your build process.

14. **Monitor and Troubleshoot**
    - Check the Pages section in repository settings for warnings or errors.
    - If the site isn't working, verify DNS settings and allow time for propagation.

## Remember

- Use "www" in custom domain settings if you've set up a www CNAME record.
- For apex domains, ensure A records are set up correctly.
- HTTPS certification for custom domains can take up to 24 hours.

By following these steps, your GitHub Pages site should be successfully connected to your custom domain, providing a professional and branded web address for your project.