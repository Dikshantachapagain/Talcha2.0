const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const dotenv = require('dotenv');

// Load environment variables first
dotenv.config();

// Now you can log the configuration
console.log("Email config:", {
  service: process.env.EMAIL_SERVICE,
  user: process.env.EMAIL_USER,
  pass: process.env.EMAIL_PASSWORD ? "Password set (not shown)" : "Missing password"
});

const authRoutes = require('./routes/authRoutes');
const passwordRoutes = require('./routes/passwordRoutes');
const profileRoutes = require('./routes/profileRoutes');
const apiRoutes = require('./routes/api.Routes')
const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Set view engine
app.set('view engine', 'ejs');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

//This will prevent browser from caching pages.
app.use((req, res, next) => {
  // For protected routes or all routes if you prefer
  res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/passwords', passwordRoutes);
app.use('/passwords', profileRoutes);
app.use('/api', apiRoutes);
// Home route
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/passwords/dashboard');
  }
  res.redirect('/auth/login');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error occurred:', err);
  res.status(500).render('error', { 
    error: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message 
  });
});

// Handle 404 errors
app.use((req, res) => {
  console.log('404 Not Found:', req.originalUrl);
  res.status(404).render('error', { error: 'Page not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;