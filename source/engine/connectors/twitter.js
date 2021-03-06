var request = require('request');
var moment = require('moment');
var scheduleTo = require('../scheduleTo');
var util = require('util');

var handleUnexpected = require('../handleUnexpected');
var helpers = require('./../../utils/helpers');
var logger = require('./../../utils/logger');
var config = require('../../../config');

var API = 'https://api.twitter.com/1.1';

function connector(state, user, callback) {
	var accessToken = state.accessToken;
	var accessTokenSecret = state.accessTokenSecret;
	var log = logger.connector('twitter');

	if (!accessToken) {
		return callback('missing accessToken for user: ' + state.user);
	}

	if (!accessTokenSecret) {
		return callback('missing accessTokenSecret for user: ' + state.user);
	}

	initState(state);

	var uri = formatRequestUri(state);
	var headers = { 'Content-Type': 'application/json', 'User-Agent': 'likeastore/collector'};

	var oauth = {
		consumer_key: config.services.twitter.consumerKey,
		consumer_secret: config.services.twitter.consumerSecret,
		token: accessToken,
		token_secret: accessTokenSecret
	};

	log.info('prepearing request in (' + state.mode + ') mode for user: ' + state.user);

	request({uri: uri, headers: headers, oauth: oauth, timeout: config.collector.request.timeout, json: true}, function (err, response, body) {
		if (failed(err, response, body)) {
			return handleUnexpected(response, body, state, err, function (err) {
				callback (err, state);
			});
		}

		return handleResponse(response, body);
	});

	function failed(err, response, body) {
		return err || response.statusCode !== 200 || !body;
	}

	function initState(state) {
		if (!state.mode) {
			state.mode = 'initial';
		}

		if (!state.errors) {
			state.errors = 0;
		}

		if (state.mode === 'rateLimit') {
			state.mode = state.prevMode;
		}
	}

	function formatRequestUri(state) {
		var base = util.format('%s/favorites/list.json?count=200&include_entities=false', API);
		return state.maxId ?
			util.format('%s&max_id=%s', base, state.maxId) :
			state.mode === 'normal' && state.sinceId ?
				util.format('%s&since_id=%s', base, state.sinceId) :
				base;
	}

	function handleResponse(response, body) {
		var rateLimit = +response.headers['x-rate-limit-remaining'];
		log.info('rate limit remaining: ' + rateLimit + ' for user: ' + state.user);

		if (!Array.isArray(body)) {
			return handleUnexpected(response, body, state, function (err) {
				callback(err, scheduleTo(updateState(state, [], rateLimit, true)));
			});
		}

		var favorites = body.map(function (fav) {
			return {
				itemId: fav.id_str,
				user: state.user,
				userData: user,
				created: moment(fav.created_at).toDate(),
				description: fav.text,
				avatarUrl: fav.user.profile_image_url_https,
				authorName: fav.user.screen_name,
				source: util.format('%s/%s/status/%s', 'https://twitter.com', fav.user.screen_name, fav.id_str),
				type: 'twitter'
			};
		});

		log.info('retrieved ' + favorites.length + ' favorites for user: ' + state.user);

		return callback(null, scheduleTo(updateState(state, favorites, rateLimit, false)), favorites);
	}

	function updateState(state, data, rateLimit, failed) {
		state.lastExecution = moment().toDate();

		if (!failed) {
			if (state.mode === 'initial' && data.length > 0 && !state.sinceId) {
				state.sinceId = data[0].itemId;
			}

			if (state.mode === 'normal' && data.length > 0) {
				state.sinceId = data[0].itemId;
			}

			if (state.mode === 'initial' && data.length > 0) {
				state.maxId = helpers.decrementStringId(data[data.length - 1].itemId);
			}

			if (state.mode === 'initial' && data.length === 0) {
				state.mode = 'normal';
				delete state.maxId;
			}

			if (rateLimit <= 1) {
				var currentState = state.mode;
				state.mode = 'rateLimit';
				state.prevMode = currentState;
			}
		}

		return state;
	}
}

module.exports = connector;