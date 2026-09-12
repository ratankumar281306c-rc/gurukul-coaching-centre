# Gurukul Coaching Centre — Live Deployment

This package is ready to deploy as a Node.js web app.

## What you need
You only need a hosting account that can run Node.js. The easiest route is a service such as Render.

## Deploy
1. Create a GitHub account if you do not already have one.
2. Create a new GitHub repository.
3. Upload all files from this folder to the repository.
4. In your hosting provider, create a new Web Service from that repository.
5. Use:
   - Build command: `npm install`
   - Start command: `npm start`
6. Add environment variables:
   - `NODE_ENV=production`
   - `JWT_SECRET` = a long random secret
   - `ADMIN_USER=admin`
   - `ADMIN_PASSWORD` = a strong password you choose
7. Deploy.

## Important database note
The current MVP uses SQLite. For production use with reliable persistent student/payment data, move the database to PostgreSQL (or another managed database) before handling real traffic/payments. Do not treat the free hosting filesystem as permanent storage.

## Admin
Use the ADMIN_USER and ADMIN_PASSWORD values you set during deployment.

## Payments
The current code intentionally does not fake successful payments. Razorpay/UPI credentials and webhook verification must be configured before taking real payments.
