var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var idCount = 0;

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket) {

  var id = idCount++;

  socket.broadcast.emit('connection', id);

  console.log('user '+id+' connected');

  socket.on('chat message', function(msg) {
    console.log('message('+id+'): ' + msg);
    io.emit('chat message', id, msg);
  });

  socket.on('disconnect', function() {
    socket.broadcast.emit('disconnection', id);
    console.log('user '+id+' disconnected');
  });
});

http.listen(80, function() {
  console.log('listening on *:80');
});

