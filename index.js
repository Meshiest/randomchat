var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var _ = require('underscore');

var users = {}

var command = {}

command.nick = function(user, args) {
  var name = _(_.sample(adjArr)).capitalize()+" "+_(_.sample(nounArr)).capitalize().trim();
  user.socket.broadcast.emit('message', '<strong>'+user.name+"</strong> is now known as <strong>"+name+"</strong>.");
  console.log(user.name+" changed name to "+name);
  user.socket.emit('message', "You are now known as <strong>"+name+"</strong>.");
  user.name = name;
}

command.list = function(user, args) {
  var list = [];
  for(var u in users) {
    list.push(users[u].name+"("+users[u].id+")");
  }
  user.socket.emit('message',"<strong>Online Users</strong>: "+list.join(", "));
}

_.mixin({
  capitalize: function(string) {
    return string.charAt(0).toUpperCase() + string.substring(1).toLowerCase();
  }
});

_.mixin({
  hex: function(int) {
    return Math.floor(int).toString(16);
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

  var user = {};
  var id = idCount++;
  var name = "User "+id;

  user.name = name;
  user.id = id;
  user.color = _(Math.random()*10+5).hex()+_(Math.random()*10+5).hex()+_(Math.random()*10+5).hex();
  console.log("color "+user.color);
  user.socket = socket;

  users[id] = user;

  socket.broadcast.emit('connection', user.name);

  console.log('user '+user.name+' connected');
  socket.emit('message', "Connected as <strong>"+user.name+"</strong>");

  command['nick'](user);
  command['list'](user);

  socket.on('chat message', function(msg) {
    if(msg.charAt(0) == '/') {
      args = msg.substring(1).split(' ')
      if(command.hasOwnProperty(args[0])) {
        command[args[0]](user,args.shift);
      } else {
        socket.emit('message', '"<strong>'+args[0]+'</strong>" is not a valid command');
      }
      return;
    }
    if(msg.length == 0 || msg.length > 160) {
      socket.emit('message', "Your message is empty or too long");
      return;
    }
    console.log('message('+user.name+'): ' + msg);
    io.emit('chat message', user.name, user.color, msg);
  });

  socket.on('disconnect', function() {
    socket.broadcast.emit('disconnection', user.name);
    delete users[user.id];
    console.log('user '+user.name+' disconnected');
  });
});

http.listen(app.get('port'));

