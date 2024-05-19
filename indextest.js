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

app.get('/home', (req, res) => {
  res.render('home');
});

// Handle login POST request
app.post('/login', async (req, res) => {
  const { user_email, user_pwd } = req.body;

  console.log('Received login request:', { user_email, user_pwd });

  try {
    const userResult = await pool.query(
      'SELECT * FROM "user" WHERE user_email = $1 AND user_pwd = $2',
      [user_email, user_pwd]
    );
    console.log('User query result:', userResult.rows);

    const restResult = await pool.query(
      'SELECT * FROM establishment WHERE src_type = $1',
      ['R']
    );
    const coffeeResult = await pool.query(
      'SELECT * FROM establishment WHERE src_type = $1',
      ['C']
    );
    const MMResult = await pool.query(
      'SELECT * FROM establishment WHERE src_type = $1',
      ['M']
    );
    

    if (userResult.rows.length > 0) {
      res.render('home', {
        name: userResult.rows[0].user_fname,
        establishmentsR: restResult.rows,establishmentsC: coffeeResult.rows,establishmentsM: MMResult.rows
      });
    } else {
      res.send('Invalid email or password');
    }
  } catch (err) {
    console.error('Error during login process:', err);
    res.send('Error logging in');
  }
});






// Start server
const PORT = 40000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});