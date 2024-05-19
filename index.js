
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const { Pool } = require("pg");
const path = require("path");
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
    console.error("Database connection error", err.stack);
  } else {
    console.log("Database connected");
  }
});


app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({ secret: "secret-key", resave: false, saveUninitialized: true })
);
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));


app.get("/", (req, res) => {
  res.redirect("/login");
});


app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/profile", async (req, res) => {
  const user_email = req.session.user_email;
  if (!user_email) {
    return res.redirect("/login");
  }
  try {
    const userResult = await pool.query(
      'SELECT * FROM "user" WHERE user_email = $1',
      [user_email]
    );
    if (userResult.rows.length > 0) {
      res.render("profiletest", { user: userResult.rows[0] });
    } else {
      res.send("User not found");
    }
  } catch (err) {
    console.error("Error retrieving user profile:", err);
    res.send("Error retrieving user profile");
  }
});

app.post("/update-profile", async (req, res) => {
  const { user_fname, user_lname, user_email, user_pwd } = req.body;
  try {
    await pool.query(
      'UPDATE "user" SET user_fname = $1, user_lname = $2, user_pwd = $3 WHERE user_email = $4',
      [user_fname, user_lname, user_pwd, user_email]
    );
    logProfileUpdate(user_email);
    res.redirect("/profile");
  } catch (err) {
    console.error("Error updating user profile:", err);
    res.send("Error updating user profile");
  }
});

function logProfileUpdate(user_email) {
  console.log(`Profile updated for user: ${user_email}`);
}

app.post("/delete-account", async (req, res) => {
  const { delete_pwd } = req.body;
  const user_email = req.session.user_email;
  if (!user_email) {
    return res.redirect("/login");
  }
  try {
    const userResult = await pool.query(
      'SELECT * FROM "user" WHERE user_email = $1 AND user_pwd = $2',
      [user_email, delete_pwd]
    );
    if (userResult.rows.length > 0) {
      const user_id = userResult.rows[0].user_id;

      await pool.query(
        'DELETE FROM "order_line" WHERE order_id IN (SELECT order_id FROM "Order" WHERE user_id = $1)',
        [user_id]
      );

      await pool.query(
        'DELETE FROM "delivery" WHERE order_id IN (SELECT order_id FROM "Order" WHERE user_id = $1)',
        [user_id]
      );

      await pool.query(
        'DELETE FROM "payment" WHERE order_id IN (SELECT order_id FROM "Order" WHERE user_id = $1)',
        [user_id]
      );

      await pool.query('DELETE FROM "Order" WHERE user_id = $1', [user_id]);

      await pool.query('DELETE FROM "cart" WHERE user_id = $1', [user_id]);

      await pool.query('DELETE FROM "review" WHERE user_id = $1', [user_id]);

      await pool.query('DELETE FROM "user" WHERE user_email = $1', [
        user_email,
      ]);

      logAccountDeletion(user_email);

      req.session.destroy();
      res.redirect("/login");
    } else {
      res.send("Invalid password. Account not deleted.");
    }
  } catch (err) {
    console.error("Error deleting account:", err);
    res.send("Error deleting account");
  }
});

function logAccountDeletion(user_email) {
  console.log(`Account deleted for user: ${user_email}`);
}

app.get("/product/:id/:type", async (req, res) => {
  const { id, type } = req.params;
  try {
    const restaurantResult = await pool.query(
      "SELECT * FROM Establishment WHERE src_id = $1 AND src_type = $2",
      [id, type]
    );
    const productsResult = await pool.query(
      "SELECT * FROM product WHERE src_id = $1",
      [id]
    );

    res.render("product", {
      restaurant: restaurantResult.rows[0],
      products: productsResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.send("Error occurred");
  }
});

app.post("/add-to-cart", async (req, res) => {
  const { product_id } = req.body;
  if (!req.session.cart) {
    req.session.cart = [];
  }

  try {
    const productResult = await pool.query(
      "SELECT * FROM product WHERE product_id = $1",
      [product_id]
    );
    if (productResult.rows.length > 0) {
      req.session.cart.push(productResult.rows[0]);
    }
    res.redirect("back");
  } catch (err) {
    console.error(err);
    res.send("Error adding to cart");
  }
});

app.post("/remove-from-cart", (req, res) => {
  const { product_id } = req.body;
  if (req.session.cart) {
    req.session.cart = req.session.cart.filter(
      (product) => product.product_id !== parseInt(product_id)
    );
  }
  res.redirect("/cart");
});

app.get("/cart", (req, res) => {
  res.render("cart", { cart: req.session.cart });
});

app.get("/checkout", (req, res) => {
  res.render("checkout", { cart: req.session.cart });
});

app.post("/checkout", async (req, res) => {
  const { delivery, credit_card } = req.body;
  const cart = req.session.cart;

  if (!cart || cart.length === 0) {
    return res.redirect("/carttest");
  }

  try {
    const user_email = req.session.user_email;
    const userResult = await pool.query(
      'SELECT user_fname, user_lname FROM "user" WHERE user_email = $1',
      [user_email]
    );
    if (userResult.rows.length === 0) {
      return res.redirect("/logintest");
    }
    const user = userResult.rows[0];

    const totalCost = parseFloat(
      cart
        .reduce((sum, product) => sum + parseFloat(product.prod_price), 0)
        .toFixed(2)
    );
    const taxes = parseFloat((totalCost * 0.1).toFixed(2));
    const finalTotal = parseFloat((totalCost + taxes).toFixed(2));

    const restaurantPromises = cart.map((product) => {
      return pool.query("SELECT * FROM Establishment WHERE src_id = $1", [
        product.src_id,
      ]);
    });
    const restaurantResults = await Promise.all(restaurantPromises);
    const restaurants = restaurantResults.map((result) => result.rows[0]);

    req.session.invoice = {
      products: cart,
      credit_card: credit_card,
      delivery: delivery === "on",
      total_cost: finalTotal,
      taxes: taxes,
      user_fname: user.user_fname,
      user_lname: user.user_lname,
      restaurants: restaurants,
    };

    req.session.cart = [];

    res.redirect("/invoice");
  } catch (err) {
    console.error("Error processing order:", err);
    res.send("Error processing order");
  }
});

app.get("/invoice", (req, res) => {
  const invoice = req.session.invoice;

  if (!invoice) {
    return res.redirect("/checkout");
  }

  const maskedCreditCard = `**** **** **** ${invoice.credit_card.slice(-4)}`;
  invoice.masked_credit_card = maskedCreditCard;

  res.render("invoice", { invoice });
});

app.get("/review/:id", (req, res) => {
  const { id } = req.params;
  res.render("review", { restaurant_id: id });
});

app.post("/review/:id", async (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body;
  const user_email = req.session.user_email;

  try {
    const userResult = await pool.query(
      'SELECT user_id FROM "user" WHERE user_email = $1',
      [user_email]
    );
    if (userResult.rows.length > 0) {
      const user_id = userResult.rows[0].user_id;
      await pool.query(
        'INSERT INTO "review" (restaurant_id, user_id, rating, comment) VALUES ($1, $2, $3, $4)',
        [id, user_id, rating, comment]
      );
      res.redirect("/invoice");
    } else {
      res.send("User not found");
    }
  } catch (err) {
    console.error("Error submitting review:", err);
    res.send("Error submitting review");
  }
});

app.post("/login", async (req, res) => {
  const { user_email, user_pwd } = req.body;

  console.log("Received login request:", { user_email, user_pwd });

  try {
    const userResult = await pool.query(
      'SELECT * FROM "user" WHERE user_email = $1 AND user_pwd = $2',
      [user_email, user_pwd]
    );

    const restResult = await pool.query(
      "SELECT * FROM establishment WHERE src_type = $1",
      ["R"]
    );
    const coffeeResult = await pool.query(
      "SELECT * FROM establishment WHERE src_type = $1",
      ["C"]
    );
    const MMResult = await pool.query(
      "SELECT * FROM establishment WHERE src_type = $1",
      ["M"]
    );

    if (userResult.rows.length > 0) {
      req.session.user_email = user_email;
      res.render("home", {
        name: userResult.rows[0].user_fname,
        establishmentsR: restResult.rows,
        establishmentsC: coffeeResult.rows,
        establishmentsM: MMResult.rows,
      });
    } else {
      res.send("Invalid email or password");
    }
  } catch (err) {
    console.error("Error during login process:", err);
    res.send("Error logging in");
  }
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.post("/signup", async (req, res) => {
  const { user_fname, user_lname, user_email, user_pwd } = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO "user" (user_fname, user_lname, user_email, user_pwd) VALUES ($1, $2, $3, $4) RETURNING *',
      [user_fname, user_lname, user_email, user_pwd]
    );

    if (result.rows.length > 0) {
      logSignup(user_email);
      res.redirect("/login");
    } else {
      res.send("Error signing up");
    }
  } catch (err) {
    console.error(err);
    res.send("Error signing up");
  }
});

function logSignup(user_email) {
  console.log(`New user signed up: ${user_email}`);
}

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
