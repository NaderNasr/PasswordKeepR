// load .env data into process.env
require("dotenv").config();

// Web server config
const PORT = process.env.PORT || 8080;
const sassMiddleware = require("./lib/sass-middleware");
const express = require("express");
const app = express();
const morgan = require("morgan");
const bodyParser = require("body-parser");
const cookieSession = require('cookie-session');
const bcrypt = require('bcrypt');

// PG database client/connection setup
const { Pool } = require("pg");
const dbParams = require("./lib/db.js");
const db = new Pool(dbParams);
db.connect();

// Load the logger first so all (static) HTTP requests are logged to STDOUT
// 'dev' = Concise output colored by response status for development use.
//         The :status token will be colored red for server error codes, yellow for client error codes, cyan for redirection codes, and uncolored for all other codes.
app.use(morgan("dev"));
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieSession({
  name: 'session',
  keys: ['df9c8e16-42ca-46a3-8457-aa83a2e94930', 'dd2f9568-af42-4ccf-abfe-da1f5563d6d0']
}));

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

app.use(
  "/styles",
  sassMiddleware({
    source: __dirname + "/styles",
    destination: __dirname + "/public/styles",
    isSass: false, // false => scss, true => sass
  })
);

app.use(express.static("public"));

// Separated Routes for each Resource
// Note: Feel free to replace the example routes below with your own
const usersRoutes = require("./routes/users");
const websitesRoutes = require("./routes/websites");
const organizationsRoutes = require("./routes/organizations");
// const registerRoutes = require("./routes/register");
const { password } = require("pg/lib/defaults");
const { redirect } = require("express/lib/response");




// Mount all resource routes
// Note: Feel free to replace the example routes below with your own
app.use("/api/users", usersRoutes(db));
app.use("/api/organizations", organizationsRoutes(db));
app.use("/api/websites", websitesRoutes(db));
// app.use("/api/register", registerRoutes(db));


// Note: mount other resources here, using the same pattern above

// Home page
// Warning: avoid creating more routes in this file!
// Separate them into separate routes files (see above).

app.get("/", (req, res) => {
  const session = req.session["user_id"];
  console.log('                            USER COOKIE SESSION ID: ======>        ' +  JSON.stringify(session));
  if (!session) {
    res.render('register');
  }
  res.render('index');
});

app.get("/register", (req, res) => {
  const session = req.session["user_id"];
  if (!session) {
    res.render("register");
  }
  res.render("index");

});

app.get("/login", (req, res) => {
  const session = req.session["user_id"];
  if (!session) {
    res.render("login");
  }
  res.render("index");

});

const renderUserWebsite = (userId) => {
  return db.query(`
  SELECT users.id, websites.name FROM users
JOIN websites ON users.id = user_id
WHERE users.id = $1
    `, [userId])

    .catch((error) => {
      console.log('renderUserWebsite: ', error.message);
    });
};

app.get("/members", (req, res) => {
  const session = req.session["user_id"];
  if (!session) {
    res.render("login");
  }
  renderUserWebsite(session)
    .then((data) => {
      let result = data.rows[0];
      let tempVars = {
        result
      };
      console.log(tempVars);
      res.render("member_homepage", tempVars);
    });


});

// Add function in helper dir
const addUser = (name, password, email) => {
  return db.query(`
  INSERT INTO users (name, password, email )
  VALUES($1, $2, $3) RETURNING *;`, [name, password, email])
    .then((result) => result.rows[0])
    .catch((error) => {
      console.log(error.message);
    });
};



//Fix to authenticate email
app.post("/register", (req, res) => {
  let name = req.body.name;
  let hashedPassword = bcrypt.hashSync(req.body.password[0], 12);
  let email = req.body.email;
  console.log(req.session["user_id"]);
  //verify email
  addUser(name, hashedPassword, email)
    .then((result) => {
      result['userId'] = {
        name,
        email,
        hashedPassword
      };
    });

  req.session['userId'] = name;
  res.render('index');


  //if email exists alert user
});

const getUserWithEmail = (email) => {
  return db
    .query(`SELECT * FROM users WHERE users.email = $1;` ,[email])
    .then((result) => result.rows[0])
    .catch((err) => {
      console.log(err.message);
    });
};


app.post("/login", (req, res) => {
  const email = req.body.email;
  const password = req.body.password[0];
  // const userSession = req.session['user_id'];

  if (!email || !password) {
    console.log('input cant be empty');
    return;
  }

  getUserWithEmail(email)
    .then((result) => {
      if (!result || !bcrypt.compareSync(password, result.password)) {
        console.log('wrong email');
        return;
      }
      req.session["user_id"] = result.id;
      return res.redirect('/');
    })
    .catch((err) => {
      console.log(err.message);
      res.send('Wrong email or password');
    });
});


app.post('/logout', (req, res) => {
  req.session["user_id"] = null;
  res.redirect('/register');
});

const addToVault = (name, username, url, password) => {
  return db.query(`
  INSERT INTO websites (name, username, url, password)
  VALUES($1, $2, $3, $4) RETURNING *;
  `, [name, username, url, password]);
};

app.post('/membersPage', (req, res) => {
  const session = req.session["user_id"];
  if (!session) {
    res.render('/login');
  }
  const name = req.body.name;
  const username = req.body.username;
  const url = req.body.url;
  const password = req.body.password;


  addToVault(name, username, url, password)
    .then((result) => {
      //set the row to the current user id
      result.rows[0]["user_id"] = session;
      console.log(result.rows);
    })
    .catch((err) => {
      console.log(err.message);
    });
  
  res.render('member_homepage');
});

// app.post('/delete') delete from table DELETE FROM ...



app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});
