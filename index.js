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

function findUserByName(name, exclude) {
  name = name.toUpperCase();
  var id = -1;
  for(var u in users) {
    var select = users[u];
    if(select == exclude)
      continue;
    if(select.name.toUpperCase().indexOf(name) >= 0) {
      if(id != -1) {
        return -2;
      }
      id = select.id;
    }
  }
  return id;
}

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
  var mutedId = findUserByName(name, user);
  if(mutedId == -2) {
    user.socket.emit('message', -1, "Found more than one user, please be more specific");
  } else if(mutedId != -1) {
    users[mutedId].socket.broadcast.emit('mute', mutedId, users[mutedId].name, true);
  } else {
    user.socket.emit('message', -1, "Could not find a user to mute");
  }
}
command.hellban.adminOnly = true;

command.setname = function(user, args) {
  if(args.length < 1) {
    user.socket.emit('message', -1, "Usage: <b>/setname [name] [new name]</b>");
    return;
  }
  var userName = (args[0]).toUpperCase();
  var select = findUserByName(userName);
  args.splice(1,1);
  var name = args.join(' ');


  if(select == -2) {
    user.socket.emit('message', -1, "Found more than one user, please be more specific");
  } else if(select != -1) {
    var style = " style='position:relative;padding:3px;border-radius:6px;background:#"+users[select].color+";'"
    users[select].socket.broadcast.emit('message', users[select].id, '<b'+style+'>'+users[select].name+"</b> is now known as <b"+style+">"+name+"</b>.");
    console.log(users[select].name+" changed name to "+name);
    users[select].socket.emit('message', -1, "You are now known as <b"+style+">"+name+"</b>.");
    users[select].name = name;
  } else {
    user.socket.emit('message', -1, "Could not find a user to rename");
  }
}
command.setname.adminOnly = true;

command.setcolor = function(user, args) {
  if(args.length < 1) {
    user.socket.emit('message', -1, "Usage: <b>/color [name] [color]</b>");
    return;
  }
  var userName = (args[0]).toUpperCase();
  var color = args[1]
  var select = findUserByName(userName);


  if(select == -2) {
    user.socket.emit('message', -1, "Found more than one user, please be more specific");
  } else if(select != -1) {
    var style = " style='position:relative;padding:3px;border-radius:6px;background:#"+users[select].color+";'"
    users[select].color = color;
    users[select].socket.emit('message', -1, "Your color is now <b"+style+">"+users[select].color+"</b>.");

  } else {
    user.socket.emit('message', -1, "Could not find a user to recolor");
  }
}
command.setcolor.adminOnly = true;

command.nick = function(user, args) {
  var time = new Date().getTime();
  if(!user.lastNameChange || user.lastNameChange + 5000 < time) {
    var name = _(_.sample(adjArr)).capitalize().trim()+" "+_(_.sample(nounArr)).capitalize().trim();
    var style = " style='position:relative;padding:3px;border-radius:6px;background:#"+user.color+";'"
    user.socket.broadcast.emit('message', user.id, '<b'+style+'>'+user.name+"</b> is now known as <b"+style+">"+name+"</b>.");
    console.log(user.name+" changed name to "+name);
    user.socket.emit('message', -1, "You are now known as <b"+style+">"+name+"</b>.");
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
    var style = " style='position:relative;padding:3px;border-radius:6px;background:#"+users[u].color+";'"
    list.push('<span'+style+'>'+users[u].name+(users[u]==user ? "(You)" : "")+"</span>");
  }
  user.socket.emit('message', -1, "<b>Online Users("+list.length+")</b>: "+list.join(", "));
}

command.mute = function(user, args) {
  if(args.length < 1 || args.length > 2) {
    user.socket.emit('message', -1, "Usage: <b>/mute [name]</b>"+args.join(','));
    return;
  }
  var name = (args[0] + (args.length > 1 ? " " + args[1] : ""));
  var mutedId = findUserByName(name, user);
  if(mutedId == -2) {
    user.socket.emit('message', -1, "Found more than one user, please be more specific");
  } else if(mutedId != -1) {
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

function similar(a, b) {
    var lengthA = a.length;
    var lengthB = b.length;
    var equivalency = 0;
    var minLength = (a.length > b.length) ? b.length : a.length;    
    var maxLength = (a.length < b.length) ? b.length : a.length;    
    for(var i = 0; i < minLength; i++) {
        if(a[i] == b[i]) {
            equivalency++;
        }
    }


    var weight = equivalency / maxLength;
    return weight;
}

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
  user.history = [];
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
    
if(msg.toUpperCase() == msg) {
      socket.emit('message', -1, "Please don't type in all capital letters!");
      user.delay += 200;
      return;
    }

    if(msg.toUpperCase() == user.lastMessage || similar(msg.toUpperCase(),user.lastMessage) >= 0.80) {
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

