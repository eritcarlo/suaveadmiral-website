# Suave Barbershop Website

A comprehensive barbershop management system built with Node.js, Express, and SQLite.

## Features

- Customer booking system
- Barber management
- Admin dashboard
- Email notifications
- QR code generation for bookings
- User authentication and authorization
- Payment tracking
- Analytics and reporting

## Local Development

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your values
4. Start the server:
   ```bash
   npm start
   ```
5. Visit `http://localhost:3000`

## Deployment to Railway

### Prerequisites
- Railway account (sign up at [railway.app](https://railway.app))
- GitHub account
- Git installed on your machine

### Step 1: Prepare Your Repository
1. Initialize git in your project (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. Push to GitHub:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Deploy on Railway

1. Go to [railway.app](https://railway.app) and sign in
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway will automatically detect the Node.js project and deploy it

### Step 3: Configure Environment Variables

In your Railway project dashboard, go to Variables and add:

```bash
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
SESSION_SECRET=generate_a_very_strong_random_string_here
NODE_ENV=production
```

### Step 4: Set up Custom Domain (Optional)

1. In Railway dashboard, go to Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed

## Environment Variables

- `PORT` - Server port (automatically set by Railway)
- `DATABASE_URL` - Database file path (optional, defaults to local file)
- `EMAIL_USER` - Gmail address for sending notifications
- `EMAIL_PASS` - Gmail app password (not your regular password)
- `SESSION_SECRET` - Secret key for session encryption
- `NODE_ENV` - Environment mode (development/production)

## Database

The application uses SQLite database which automatically migrates on startup. The database file will be created automatically if it doesn't exist.

## File Uploads

Barber profile images are stored in the `uploads/barbers/` directory. Make sure this directory has proper write permissions in production.

## License

This project is licensed under the ISC License.