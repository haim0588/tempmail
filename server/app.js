require('dotenv').config();
const express = require('express');
const axios = require('axios');
const session = require('express-session');
const path = require('path');
const csrf = require('csurf');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

const csrfProtection = csrf({ cookie: true });

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});

app.use('/generate-email', apiLimiter);

const GUERRILLA_API_URL = 'http://api.guerrillamail.com/ajax.php';

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

async function generateEmail(req) {
    const response = await axios.get(`${GUERRILLA_API_URL}?f=get_email_address&ip=${req.ip}&agent=${req.get('User-Agent')}`);
    req.session.sidToken = response.data.sid_token;
    req.session.guerrillaEmail = response.data.email_addr;
    
    // נגדיר זמן תפוגה ל-10 דקות מעכשיו
    const expirationTime = new Date(Date.now() + 10 * 60 * 1000);
    req.session.emailExpirationTime = expirationTime;
    
    return {
        email: response.data.email_addr,
        expirationTime: expirationTime.toISOString() // שימוש ב-ISO string לפורמט אחיד
    };
}

app.get('/current-email', csrfProtection, async (req, res) => {
    try {
        if (!req.session.guerrillaEmail || !req.session.emailExpirationTime) {
            const emailData = await generateEmail(req);
            res.json(emailData);
        } else {
            res.json({ 
                email: req.session.guerrillaEmail, 
                expirationTime: req.session.emailExpirationTime 
            });
        }
    } catch (error) {
        console.error('Error getting/generating email:', error);
        res.status(500).json({ error: 'Failed to get/generate email' });
    }
});

app.post('/generate-email', csrfProtection, async (req, res) => {
    try {
        const emailData = await generateEmail(req);
        res.json(emailData);
    } catch (error) {
        console.error('Error generating email:', error);
        res.status(500).json({ error: 'Failed to generate email' });
    }
});

app.get('/messages', csrfProtection, async (req, res) => {
    if (!req.session.guerrillaEmail || !req.session.sidToken) {
        return res.status(400).json({ error: 'No temporary email generated' });
    }

    try {
        const response = await axios.get(`${GUERRILLA_API_URL}?f=get_email_list&offset=0&sid_token=${req.session.sidToken}`);
        res.json(response.data.list || []);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

app.get('/message/:id', csrfProtection, async (req, res) => {
    if (!req.session.guerrillaEmail || !req.session.sidToken) {
        return res.status(400).json({ error: 'No temporary email generated' });
    }

    try {
        const response = await axios.get(`${GUERRILLA_API_URL}?f=fetch_email&email_id=${req.params.id}&sid_token=${req.session.sidToken}`);
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching message content:', error);
        res.status(500).json({ error: 'Failed to fetch message content' });
    }
});

app.post('/extend-email', csrfProtection, (req, res) => {
    if (!req.session.guerrillaEmail || !req.session.emailExpirationTime) {
        return res.status(400).json({ error: 'No temporary email generated' });
    }

    // Extend the expiration time by 10 minutes
    const newExpirationTime = new Date(Date.now() + 10 * 60 * 1000);
    req.session.emailExpirationTime = newExpirationTime;

    res.json({ expirationTime: newExpirationTime.toISOString() });
});

app.use((err, req, res, next) => {
    console.error(err);
    if (err.code === 'EBADCSRFTOKEN') {
        res.status(403).json({ error: 'Invalid CSRF token' });
    } else {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});