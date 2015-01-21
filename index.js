var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var _ = require('underscore');

_.mixin({
  capitalize: function(string) {
    return string.charAt(0).toUpperCase() + string.substring(1).toLowerCase();
  }
});

var nounArr = [];
fs.readFile(__dirname + '/noun.txt', 'utf-8', function(err, data) {
  if(!err) {
    nounArr = data.split("\n")
    console.log("Found "+nounArr.length+" nouns")
  }
});

var adjArr = [];
fs.readFile(__dirname + '/adj.txt', 'utf-8', function(err, data) {
  if(!err) {
    adjArr = data.split("\n")
    console.log("Found "+adjArr.length+" adjectives")
  }
});

app.set('port', (process.env.PORT || 5000));

var idCount = 0;

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket) {

  var id = idCount++;
  var name = _(_.sample(adjArr)).capitalize()+" "+_(_.sample(nounArr)).capitalize();

  socket.broadcast.emit('connection', name);

  console.log('user '+name+' connected');

  socket.on('chat message', function(msg) {
    console.log('message('+name+'): ' + msg);
    io.emit('chat message', name, msg);
  });

  socket.on('disconnect', function() {
    socket.broadcast.emit('disconnection', name);
    console.log('user '+name+' disconnected');
  });
});

http.listen(app.get('port'), function() {
  console.log('listening on *:'+app.get('port'));
});

