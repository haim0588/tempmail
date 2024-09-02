# Temporary Email Application

This application provides a temporary email service using Mailinator API.

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory and add your Mailinator API key and domain:
   ```bash
   MAILINATOR_API_KEY=your_api_key_here
   MAILINATOR_DOMAIN=your_domain_here
   SESSION_SECRET=your_session_secret_here
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Open `http://localhost:3000` in your browser

## Features

- Generate temporary email addresses
- View incoming messages
- Copy email address to clipboard
- View message content

## Technologies Used

- Node.js
- Express.js
- Mailinator API
- HTML/CSS/JavaScript