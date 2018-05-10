const express = require('express');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');

const { secret } = require('./config');
const port = process.env.PORT || 5000;
const User = require('./models');

mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost/auth');

const corsOptions = {
  origin: 'http://localhost:3000',
  credentials: true
};

const server = express();
server.use(bodyParser.json());
server.use(cors(corsOptions));

// ######################## HELPER FUNCTIONS ########################

const getTokenForUser = userObject => {
  // creating a JWT and returning it.
  // this function is more of a simple helper function than middleware,
  // notice `req, res and next` are missing, this is because the auth is simple here.
  // no need for custom middleware, just a helper function. :)
  return jwt.sign(userObject, secret, { expiresIn: '1h' });
};

const validateToken = (req, res, next) => {
  // this piece of middleware is taking the token delivered up to the server and verifying it
  // if no token is found in the header, you'll get a 422
  // if token is not valid, you'll be asked to login
  const token = req.headers.authorization;
  console.log('validateToken')
  if (!token) {
    res
      .status(422)
      .json({ error: 'No authorization token found on Authorization header' });
    return;
  }
  jwt.verify(token, secret, (authError, decoded) => {
    if (authError) {
      res
        .status(403)
        .json({ error: 'Token invalid, please login', message: authError });
      return;
    }
    // sets the decoded JWT/user object on the request object for use in next middleware.
    req.decoded = decoded;
    next();
  });
};

// ######################## ROUTE HANDLERS/CONTROLLERS ########################

const createUser = (req, res) => {
  const { username, password } = req.body;
  const user = new User({ username, password });
  user.save((err, user) => {
    if (err) return res.send(err);
    res.json({
      success: 'User saved',
      user
    });
  });
};

const getUsers = (req, res) => {
  // This handler will not work until a user has sent up a valid JWT
  // check out what's going on in the `validate` token function
  User.find({}, (err, users) => {
    if (err) return res.send(err);
    res.send(users);
  });
};

const login = (req, res) => {
  const { username, password } = req.body;
  User.findOne({ username }, (err, user) => {
    if (err) {
      res.status(500).json({ error: 'Invalid Username/Password' });
      return;
    }
    if (user === null) {
      res.status(422).json({ error: 'No user with that username in our DB' });
      return;
    }
    user.checkPassword(password, (nonMatch, hashMatch) => {
      // This is an example of using our User.method from our model.
      if (nonMatch !== null) {
        res.status(422).json({ error: 'passwords dont match' });
        return;
      }
      if (hashMatch) {
        const token = getTokenForUser({ username: user.username });
        res.json({ token });
      }
    });
  });
};

// ######################## ROUTES ########################

server.get('/api/users', validateToken, getUsers);
server.post('/api/users', createUser);
server.post('/api/login', login);

server.listen(port, (req, res) => {
  console.log(`server listening on port ${port}`);
});
