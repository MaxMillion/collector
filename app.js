var express = require('express');
var http = require('http');
var path = require('path');

var app = express();
var engine = require('./source/engine').create();

app.configure(function(){
	app.set('port', process.env.VCAP_APP_PORT || 3002);
	app.set('views', __dirname + '/views');
	app.use(express.favicon());
	app.use(express.logger('dev'));
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(app.router);
	app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
	app.use(express.errorHandler());
});

http.createServer(app).listen(app.get('port'), function() {
	var env = process.env.NODE_ENV || 'development';
	console.log("likeastore-collector listening on port " + app.get('port') + ' ' + env);

	engine.start();
});