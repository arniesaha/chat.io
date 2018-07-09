'use strict';

var express	 	= require('express');
var router 		= express.Router();
var passport 	= require('passport');

var User = require('../models/user');
var Room = require('../models/room');

var axios = require('axios');

// export const productionAddr = 'http://10.2.0.100:8000'
const productionAddr = 'http://localhost:8082'

const serverAddr = axios.create({
    baseURL: productionAddr,
    timeout: 30000,
    headers: {},
    withCredentials: true,
    transformRequest: [function (data, headers) {
      // Do whatever you want to transform the data
    //   const access_token = localStorage.getItem("x-access-token");
    //   const refresh_token = localStorage.getItem("x-refresh-token");
    //   if(access_token && refresh_token){
    //     headers['x-access-token'] = access_token;
    //     headers['x-refresh-token'] = refresh_token;
    //   }
      headers['Content-Type'] = "application/json;charset=UTF-8";
      return JSON.stringify(data);
    }],
    transformResponse: [function(data) {
        data = JSON.parse(data)
        if ("tokenParams" in data && data.tokenParams.isTokenRefreshed){
			delete serverAddr.defaults.headers['x-access-token'];
			serverAddr.defaults.headers.post['x-access-token'] = data.tokenParams["x-access-token"];
        }
        return data;
    }]
})

// Home page
router.get('/', function(req, res, next) {
	// If user is already logged in, then redirect to rooms page
	if(req.isAuthenticated()){
		res.redirect('/rooms');
	}
	else{
		res.render('login', {
			success: req.flash('success')[0],
			errors: req.flash('error'),
			showRegisterForm: req.flash('showRegisterForm')[0]
		});
	}
});

// Login
// router.post('/login', passport.authenticate('local', {
// 	successRedirect: '/rooms',
// 	failureRedirect: '/',
// 	failureFlash: true
// }));
router.post('/login', function(req, res, next){
	serverAddr.post('/v1/user-login/',{
		"username" : req.body.username,
		"password" : req.body.password
	})
	.then(function(data){
		console.log("User Login: ", data.data);
		if(data.data.status && data.data.data.length>0){
			serverAddr.defaults.headers.post['x-access-token'] = data.data["x-access-token"];
			serverAddr.defaults.headers.post['x-refresh-token'] = data.data["x-refresh-token"];
			res.redirect('/rooms');
		} else {
			req.flash('error', 'Invalid credentials');
			res.redirect('/');
		}
	})
	.catch(function(error){
 		console.log(error);
	})
});


// Register via username and password
router.post('/register', function(req, res, next) {

	var credentials = {'username': req.body.username, 'password': req.body.password };

	if(credentials.username === '' || credentials.password === ''){
		req.flash('error', 'Missing credentials');
		req.flash('showRegisterForm', true);
		res.redirect('/');
	}else{

		// Check if the username already exists for non-social account
		User.findOne({'username': new RegExp('^' + req.body.username + '$', 'i'), 'socialId': null}, function(err, user){
			if(err) throw err;
			if(user){
				req.flash('error', 'Username already exists.');
				req.flash('showRegisterForm', true);
				res.redirect('/');
			}else{
				User.create(credentials, function(err, newUser){
					if(err) throw err;
					req.flash('success', 'Your account has been created. Please log in.');
					res.redirect('/');
				});
			}
		});
	}
});

// Social Authentication routes
// 1. Login via Facebook
router.get('/auth/facebook', passport.authenticate('facebook'));
router.get('/auth/facebook/callback', passport.authenticate('facebook', {
		successRedirect: '/rooms',
		failureRedirect: '/',
		failureFlash: true
}));

// 2. Login via Twitter
router.get('/auth/twitter', passport.authenticate('twitter'));
router.get('/auth/twitter/callback', passport.authenticate('twitter', {
		successRedirect: '/rooms',
		failureRedirect: '/',
		failureFlash: true
}));

// Rooms
router.get('/rooms', [User.isAuthenticated, function(req, res, next) {
	Room.find(function(err, rooms){
		if(err) throw err;
		res.render('rooms', { rooms });
	});
}]);

// Chat Room
router.get('/chat/:id', [User.isAuthenticated, function(req, res, next) {
	var roomId = req.params.id;
	Room.findById(roomId, function(err, room){
		if(err) throw err;
		if(!room){
			return next();
		}
		res.render('chatroom', { user: req.user, room: room });
	});

}]);

// Logout
router.get('/logout', function(req, res, next) {
	// remove the req.user property and clear the login session
	req.logout();

	// destroy session data
	req.session = null;

	// redirect to homepage
	res.redirect('/');
});

module.exports = router;
