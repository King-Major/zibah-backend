# Zibah Backend

This is the backend for the Zibah application. It provides API endpoints for authentication, products, cart, checkout, orders, wishlist, vendors, and file uploads.

## Features
- User authentication and authorization
- Product management routes
- Cart and checkout flow
- Orders and email notifications
- Wishlist and vendor endpoints
- Image upload support via Cloudinary

## Tech Stack
- Node.js
- Express.js
- PostgreSQL
- JWT authentication
- Cloudinary for uploads
- Nodemailer for emails

## Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file and configure your environment variables

## Run the server
- Development mode:
  ```bash
  npm run dev
  ```
- Production mode:
  ```bash
  npm start
  ```

## Project Structure
- `server.js` - main server entry point
- `routes/` - API route handlers
- `middleware/` - authentication and security middleware
- `services/` - supporting services such as email sending
- `utils/` - helper utilities

## Notes
Make sure your PostgreSQL database is running and the required environment variables are set before starting the server.
