# Zibah Backend

Production API for the Zibah application. It provides authentication, products, cart, checkout, orders, wishlist, vendors, feedback, and file uploads.

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
- MongoDB with Mongoose
- JWT authentication
- Cloudinary for uploads
- Resend for emails
- Paystack payments with signed webhooks

## Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` from `.env.example` and configure MongoDB Atlas, JWT, and the service keys

## Run the server
- Development mode:
  ```bash
  npm run dev
  ```
- Production mode:
  ```bash
  npm start
  ```

The API health endpoint is `/api/health`. The server refuses to start unless `MONGODB_URI` and `JWT_SECRET` are set.

## Production deployment

The included `render.yaml` is ready for a Render web service. Set the secret values in the hosting dashboard, not in Git:

- `MONGODB_URI`: MongoDB Atlas connection string with the database name included
- `JWT_SECRET`: long random value
- `FRONTEND_URL`: deployed frontend URL
- `BACKEND_URL`: deployed API URL
- `CORS_ORIGINS`: comma-separated allowed frontend origins when more than one is needed
- `PAYSTACK_SECRET_KEY`, Cloudinary variables, and Resend variables

Set `TRUST_PROXY=1` on Render. After the first deploy, run `npm run seed:admin` once with `ADMIN_EMAIL` and `ADMIN_PASSWORD`, then optionally run `npm run seed:locations`.

## Project Structure
- `server.js` - main server entry point
- `routes/` - API route handlers
- `middleware/` - authentication and security middleware
- `services/` - supporting services such as email sending
- `utils/` - helper utilities

## Notes

IDs are MongoDB ObjectId strings. The API serializers preserve the frontend's existing snake_case response fields. Do not commit `.env` or real service credentials.
