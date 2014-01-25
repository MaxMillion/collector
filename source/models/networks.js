var config = require('../../config');
var db = require('../db')(config);
var users = require('./users');

var queries = {
	initial: {
		$or: [ {mode: {$exists: false }}, { mode: 'initial'}, {mode: 'rateLimit'}]
	},

	normal: {
		mode: 'normal'
	}
};

module.exports = {
	findAll: function (query, callback) {
		return db.networks.find(query, callback);
	},

	find: function (query, callback) {
		return db.networks.findOne(query, callback);
	},

	findByMode: function (mode, callback) {
		return db.networks.find(queries[mode], callback);
	},

	update: function (obj, callback) {
		return users.findByEmail(obj.user, function (err, user) {
			if (err) {
				return callback(err);
			}

			obj.userData = user;

			db.networks.findAndModify({
				query: { _id: obj._id },
				update: obj
			}, callback);
		});
	},

	disable: function(state, callback) {
		return db.networks.findAndModify({
			query: {_id: state._id},
			update: {$set: {disabled: true}}
		}, callback);
	},

	stream: function (query) {
		return db.networks.find(query || {});
	}
};