var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var _ = require('underscore');
var escape = require("html-escape");
var md5 = require('MD5');

var users = {}
var command = {}
var adminPassword = '24a6f21e26b64fa50f75ec522fff9459';

var motd = "Welcome to <b>chatwhs</b>! Please don't spam! I know it's tempting, but please don't. It would be fantastic if you invited all of your friends (mostly because it's boring being alone here)";

command.admin = function(user, args) {
  if(args.length > 0)
    if(md5(args.join(' ')) == adminPassword) {
      user.isAdmin = 1;
      user.color = 'f44';
      var style = " style='position:relative;padding:3px;border-radius:6px;background:#"+user.color+";'"
      user.socket.broadcast.emit('message', user.id, '<b'+style+'>'+user.name+"</b> is now an Admin.");
      console.log(user.name+" is now admin");
      user.socket.emit('message', user.id, "You are now Admin.");
    }
}
command.admin.hidden = true;

command.setmotd = function(user, args) {
  if(args.length < 1) {
      user.socket.emit('message', -1, "Usage: <b>/setmotd [message]</b>");
    return;
  }
  motd = args.join(' ');
  io.emit('message', -1, "The MOTD has been changed");
}
command.setmotd.adminOnly = true;

//socket.clients[kickedClientId].send({ event: 'disconnect' });
//socket.clients[kickedClientId].connection.end();

command.hellban = function(user, args) {
  if(args.length < 1 || args.length > 2) {
    user.socket.emit('message', -1, "Usage: <b>/hellban [name]</b>");
    return;
  }
  var name = (args[0] + (args.length > 1 ? " " + args[1] : "")).toUpperCase();
  var kickedId = -1;
  for(var u in users) {
    var select = users[u];
    if(select == user)
      continue;
    if(select.name.toUpperCase().indexOf(name) >= 0) {
      if(kickedId != -1) {
        user.socket.emit('message', -1, "Found more than one user, please be more specific");
        return;
      }
      kickedId = select.id;
    }
  }
  if(kickedId != -1) {
    users[kickedId].socket.send({ event: 'disconnect' });
    users[kickedId].socket.broadcast.emit('mute', kickedId, users[kickedId].name, true);
  } else {
    user.socket.emit('message', -1, "Could not find a user to kick");
  }
}
command.hellban.adminOnly = true;

command.nick = function(user, args) {
  var time = new Date().getTime();
  if(!user.lastNameChange || user.lastNameChange + 5000 < time) {
    var name = _(_.sample(adjArr)).capitalize().trim()+" "+_(_.sample(nounArr)).capitalize().trim();
    var style = " style='position:relative;padding:3px;border-radius:6px;background:#"+user.color+";'"
    user.socket.broadcast.emit('message', user.id, '<b'+style+'>'+user.name+"</b> is now known as <b"+style+">"+name+"</b>.");
    console.log(user.name+" changed name to "+name);
    user.socket.emit('message', user.id, "You are now known as <b"+style+">"+name+"</b>.");
    user.name = name;

    user.lastNameChange = time;
  } else {
    user.socket.emit('message', -1, "You are doing that too often!");
  }
}

command.color = function(user, args) {
  var time = new Date().getTime();
  if(!user.lastColorChange || user.lastColorChange + 5000 < time) {
    user.color = _(Math.random()*7+8).hex()+_(Math.random()*7+8).hex()+_(Math.random()*7+8).hex();
    user.socket.emit('message', -1, "Your color is now <b style='position:relative;padding:3px;border-radius:6px;background:#"+user.color+";'>"+user.color+"</b>.");
    user.lastColorChange = time;
  } else {
    user.socket.emit('message', -1, "You are doing that too often!");
  }
}

command.list = function(user, args) {
  var list = [];
  for(var u in users) {
    list.push(users[u].name+(users[u]==user ? "(You)" : ""));
  }
  user.socket.emit('message', -1, "<b>Online Users("+list.length+")</b>: "+list.join(", "));
}

command.mute = function(user, args) {
  if(args.length < 1 || args.length > 2) {
    user.socket.emit('message', -1, "Usage: <b>/mute [name]</b>"+args.join(','));
    return;
  }
  var name = (args[0] + (args.length > 1 ? " " + args[1] : "")).toUpperCase();
  var mutedId = -1;
  for(var u in users) {
    var select = users[u];
    if(select == user)
      continue;
    if(select.name.toUpperCase().indexOf(name) >= 0) {
      if(mutedId != -1) {
        user.socket.emit('message', -1, "Found more than one user, please be more specific");
        return;
      }
      mutedId = select.id;
    }
  }
  if(mutedId != -1) {
    user.socket.emit('mute', mutedId, users[mutedId].name);
  } else {
    user.socket.emit('message', -1, "Could not find a user to mute");
  }
}


command.help = function(user, args) {
  list = [];
  for(var c in command) {
    if(user.isAdmin && command[c].adminOnly || !command[c].adminOnly && !command[c].hidden)
      list.push('/'+c);
  }

  user.socket.emit('message', -1, "<b>Commands</b>: "+list.join(', '));
};

command.motd = function(user, args) {
  user.socket.emit('message', -1, "<b>MOTD</b>: "+motd);
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
  user.isAdmin = false;
  user.id = id;
  user.delay = 1000;
  user.joinTime = new Date().getTime();
  user.lastMessage = '';
  user.lastMessageTime = '';
  user.color = 'fff'
  //console.log("color "+user.color);
  user.socket = socket;

  users[id] = user;

  socket.broadcast.emit('connection', user.name);

  console.log('user '+user.name+' connected');
  socket.emit('message', -1, "Connected as <b>"+user.name+"</b>");

  command['color'](user);
  command['nick'](user);
  command['list'](user);
  command['help'](user);
  command['motd'](user);

  socket.on('chatmessage', function(msg) {

    msg = msg.trim();

    if(msg.charAt(0) == '/') { //handle commands
      args = msg.substring(1).split(' ') //split commands into arguments
      if(command.hasOwnProperty(args[0]) && (user.isAdmin && command[args[0]].adminOnly || !command[args[0]].adminOnly)) { //check if command exists
        command[args.splice(0,1)](user,args); //execute command
      } else {
        socket.emit('message', -1, '"<b>'+args[0]+'</b>" is not a valid command');
      }
      return;
    }
    
    msg = escape(msg);
    var time = new Date().getTime();

    if(msg.length == 0 || msg.length > 160) {
      socket.emit('message', -1, "Your message is empty or too long!");
      user.delay += 100;
      return;
    }
    
    if(msg.toUpperCase() == user.lastMessage) {
      socket.emit('message', -1, "You're being too repetitive!");
      user.delay += 200;
      return;
    }

    if(time < user.lastMessageTime + user.delay) {
      user.delay += 200;
      socket.emit('message', -1, "You're sending messages too fast!");
      return;
    }

    user.lastMessage = msg.toUpperCase();
    user.lastMessageTime = time;
    if(user.delay > 1000) {
      user.delay -= 50;
    }

    console.log('message('+user.name+'): ' + msg);
    io.emit('chatmessage', user.id, user.name, user.color, msg);
  });

  socket.on('disconnect', function() {
    socket.broadcast.emit('disconnection', user.name);
    delete users[user.id];
    console.log('user '+user.name+' disconnected');
  });
});

http.listen(app.get('port'));

