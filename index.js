var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var _ = require('underscore');
var escape = require("html-escape");

var users = {}

var command = {}

command.nick = function(user, args) {
  var name = _(_.sample(adjArr)).capitalize().trim()+" "+_(_.sample(nounArr)).capitalize().trim();
  user.socket.broadcast.emit('message', '<b>'+user.name+"</b> is now known as <b>"+name+"</b>.");
  console.log(user.name+" changed name to "+name);
  user.socket.emit('message', "You are now known as <b>"+name+"</b>.");
  user.name = name;
}

command.list = function(user, args) {
  var list = [];
  for(var u in users) {
    list.push(users[u].name+(users[u]==user ? "(You)" : ""));
  }
  user.socket.emit('message',"<b>Online Users("+list.length+")</b>: "+list.join(", "));
}

command.color = function(user, args) {
  user.color = _(Math.random()*7+8).hex()+_(Math.random()*7+8).hex()+_(Math.random()*7+8).hex();
  user.socket.emit('message', "Your color is now <b style='position:relative;padding:3px;border-radius:6px;background:#"+user.color+";'>"+user.color+"</b>.");
}

command.help = function(user, args) {
  list = [];
  for(var c in command) {
    list.push('/'+c);
  }
  user.socket.emit('message',"<b>Commands</b>: "+list.join(', '));
};

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
  user.lastMessage = '';
  user.lastMessageTime = '';
  user.color = 'fff'
  console.log("color "+user.color);
  user.socket = socket;

  users[id] = user;

  socket.broadcast.emit('connection', user.name);

  console.log('user '+user.name+' connected');
  socket.emit('message', "Connected as <b>"+user.name+"</b>");

  command['nick'](user);
  command['color'](user);
  command['list'](user);
  command['help'](user);

  socket.on('chatmessage', function(msg) {

    if(msg.charAt(0) == '/') { //handle commands
      args = msg.substring(1).split(' ') //split commands into arguments
      if(command.hasOwnProperty(args[0])) { //check if command exists
        command[args[0]](user,args.shift); //execute command
      } else {
        socket.emit('message', '"<b>'+args[0]+'</b>" is not a valid command');
      }
      return;
    }
    
    msg = escape(msg);

    if(msg.length == 0 || msg.length > 160) {
      socket.emit('message', "Your message is empty or too long!");
      return;
    }
    
    if(msg == user.lastMessage) {
      socket.emit('message', "You're being too repetitive!");
      return;
    }

    var time = new Date().getTime();
    if(time < user.lastMessageTime + 400) {
      socket.emit('message', "You're sending messages too fast!");
      return;
    }

    user.lastMessage = msg;
    user.lastMessageTime = time;

    console.log('message('+user.name+'): ' + msg);
    io.emit('chatmessage', user.name, user.color, msg);
  });

  socket.on('disconnect', function() {
    socket.broadcast.emit('disconnection', user.name);
    delete users[user.id];
    console.log('user '+user.name+' disconnected');
  });
});

http.listen(app.get('port'));

