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
