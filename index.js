const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const path = require('path');
const app = express();

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "GrabNGo upd",
  password: "onsaas21@",
  port: 5432,
});

pool.connect((err) => {
  if (err) {
    console.error('Database connection error', err.stack);
  } else {
    console.log('Database connected');
  }
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Root route
app.get('/', (req, res) => {
  res.redirect('/login');
});

// Login route
app.get('/login', (req, res) => {
  res.render('login');
});

// Handle login POST request
app.post('/login', async (req, res) => {
  const { user_email, user_pwd } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM "user" WHERE user_email = $1 AND user_pwd = $2',
      [user_email, user_pwd]
    );

    if (result.rows.length > 0) {
      res.render('home', { name: result.rows[0].user_fname });
    } else {
      res.send('Invalid email or password');
    }
  } catch (err) {
    console.error(err);
    res.send('Error logging in');
  }
});

// Sign-up route
app.get('/signup', (req, res) => {
  res.render('signup');
});

// Handle sign-up POST request
app.post('/signup', async (req, res) => {
  const { user_fname, user_lname, user_email, user_pwd } = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO "user" (user_fname, user_lname, user_email, user_pwd) VALUES ($1, $2, $3, $4) RETURNING *',
      [user_fname, user_lname, user_email, user_pwd]
    );

    if (result.rows.length > 0) {
      res.redirect('/login');
    } else {
      res.send('Error signing up');
    }
  } catch (err) {
    console.error(err);
    res.send('Error signing up');
  }
});

// Start server
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});