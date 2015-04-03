var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var _ = require('underscore');
var escape = require("html-escape");
var md5 = require('MD5');

var users = {}

var command = {}
var adminPassword = '24a6f21e26b64fa50f75ec522fff9459'; //lol sorry
var blacklist = ['10\\..*'];

var motd = "Welcome to the chat! Please don't spam!";

var logs = []

function log(msg) {
  console.log(msg);
  logs.push(msg);
}

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
      var style = getStyle(user.color)
      user.socket.broadcast.emit('message', user.id, '<b'+style+'>'+user.name+"</b> is now an Admin.");
      log(user.id+" is now admin");
      user.socket.emit('message', user.id, "You are now Admin.");
    }
}
command.admin.hidden = true;

command.siladmin = function(user, args) {
  if(args.length > 0)
    if(md5(args.join(' ')) == adminPassword) {
      user.isAdmin = 1;
      log(user.id+" is now admin");
      user.socket.emit('message', user.id, "You are now Admin.");
    }
}
command.siladmin.hidden = true;

command.logs = function(user, args) {
  for(var l in logs) {
    user.socket.emit('message', -1, (l)+") "+logs[l]);
  }
}
command.logs.adminOnly = true;

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

command.whois = function(user, args) {
  if(args.length < 1 || args.length > 2) {
    user.socket.emit('message', -1, "Usage: <b>/whois [name]</b>");
    return;
  }
  var name = (args[0] + (args.length > 1 ? " " + args[1] : "")).toUpperCase();
  var targetid = findUserByName(name);
  if(targetid == -2) {
    user.socket.emit('message', -1, "Found more than one user, please be more specific");
  } else if(targetid != -1) {
    var style = getStyle(users[targetid].color)
    user.socket.emit('message', -1, "WHOIS");
    user.socket.emit('message', -1, "User: <b"+style+">"+users[targetid].name+"</b>");
    user.socket.emit('message', -1, "ID: "+targetid);
    user.socket.emit('message', -1, "Color: <b"+style+">"+users[targetid].color+"</b>");
    user.socket.emit('message', -1, "Address: "+users[targetid].addr);
    user.socket.emit('message', -1, "joinTime: "+users[targetid].joinTime);
    user.socket.emit('message', -1, "online: "+(new Date().getTime()-users[targetid].joinTime));
  } else {
    user.socket.emit('message', -1, "Could not find a user to whois");
  }
}
command.whois.adminOnly = true;

command.setname = function(user, args) {
  if(args.length < 1) {
    user.socket.emit('message', -1, "Usage: <b>/setname [name] [new name]</b>");
    return;
  }
  var userName = (args[0]).toUpperCase();
  var select = findUserByName(userName);
  args.splice(0,1);
  var newName = args.join(' ');


  if(select == -2) {
    user.socket.emit('message', -1, "Found more than one user, please be more specific");
  } else if(select != -1) {
    var style = getStyle(users[select].color)
    users[select].socket.broadcast.to(users[select].room).emit('message', users[select].id, '<b'+style+'>'+users[select].name+"</b> is now known as <b"+style+">"+newName+"</b>.");
    log(users[select].name+" changed name to "+newName);
    users[select].socket.emit('message', -1, "You are now known as <b"+style+">"+newName+"</b>.");
    users[select].name = newName;
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
    users[select].color = color;
    var style = getStyle(users[select].color)
    users[select].socket.emit('message', -1, "Your color is now <b"+style+">"+users[select].color+"</b>.");

  } else {
    user.socket.emit('message', -1, "Could not find a user to recolor");
  }
}
command.setcolor.adminOnly = true;

command.sethidden = function(user, args) {
  if(args.length != 1) {
    user.socket.emit('message', -1, "Usage: <b>/sethidden [name]</b>");
    return;
  }
  var userName = (args[0]).toUpperCase();
  var select = findUserByName(userName);

  if(select == -2) {
    user.socket.emit('message', -1, "Found more than one user, please be more specific");
  } else if(select != -1) {
    users[select].hidden = !users[select].hidden;
    if(users[select].hidden)
      users[select].socket.broadcast.to(users[select].room).emit('disconnection', users[select].name, users[select].color);
    users[select].socket.emit('message', -1, "You are "+(users[select].hidden?"now":"no longer")+" hidden");

  } else {
    user.socket.emit('message', -1, "Could not find a user to sethidden");
  }
}
command.sethidden.adminOnly = true;

command.nick = function(user, args) {
  var time = new Date().getTime();
  if(!user.lastNameChange || user.lastNameChange + 5000 < time) {
    var name = _(_.sample(adjArr)).capitalize().trim()+" "+_(_.sample(nounArr)).capitalize().trim();
    var style = getStyle(user.color);
    if(!user.hidden)
      user.socket.broadcast.to(user.room).emit('message', user.id, '<b'+style+'>'+user.name+"</b> is now known as <b"+style+">"+name+"</b>.");
    log(user.id+" changed name to "+name);
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
    user.socket.emit('message', -1, "Your color is now <b"+getStyle(user.color)+">"+user.color+"</b>.");
    user.lastColorChange = time;
  } else {
    user.socket.emit('message', -1, "You are doing that too often!");
  }
}

command.list = function(user, args) {
  var list = [];
  for(var u in users) {
    if((users[u].bot || users[u].hidden) && !user.isAdmin)
      continue;
    var style = getStyle(users[u].color)
    list.push('<span'+style+'>'+users[u].name+(users[u]==user ? "(You)" : "")+(users[u].hidden?"[H]":"")+"</span>");
  }
  user.socket.emit('message', -1, "<b>Online Users("+list.length+")</b>: "+list.join(", "));
}

command.mute = function(user, args) {
  if(args.length < 1 || args.length > 2) {
    user.socket.emit('message', -1, "Usage: <b>/mute [name]</b>");
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

command.pm = function(user, args) {
  if(args.length < 2 ) {
    user.socket.emit('message', -1, "Usage: <b>/pm [name] [message]</b>");
    return;
  }
  var name = args.splice(0,1)[0].toUpperCase();
  var targetid = findUserByName(name, user);
  if(targetid == -2) {
    user.socket.emit('message', -1, "Found more than one user, please be more specific");
  } else if(targetid != -1) {

    msg = args.join(' ').trim();

    msg = escape(msg);
    var time = new Date().getTime();

    if(msg.length == 0 || msg.length > 160) {
      user.socket.emit('message', -1, "Your message is empty or too long!");
      user.delay += 100;
      return;
    }
    
    if(msg.toUpperCase() == msg && msg.length > 10 && msg.toUpperCase() != msg.toLowerCase()) {
      user.socket.emit('message', -1, "Please don't type in all capital letters!");
      user.delay += 200;
      return;
    }

    if(msg.toUpperCase() == user.lastMessage || similar(msg.toUpperCase(),user.lastMessage) >= 0.80) {
      user.socket.emit('message', -1, "You're being too repetitive!");
      user.delay += 200;
      return;
    }

    if(time < user.lastMessageTime + user.delay) {
      user.delay += 200;
      user.socket.emit('message', -1, "You're sending messages too fast!");
      return;
    }

    user.lastMessage = msg.toUpperCase();
    user.lastMessageTime = time;
    if(user.delay > 1000) {
      user.delay -= 50;
    }

    log('private message('+user.id+' -> '+users[targetid].id+'): ' + msg);
    users[targetid].socket.emit('privatechatmessage', user.id, user.name, user.color, msg);
    user.socket.emit('sendprivatechatmessage', user.id, user.name, users[targetid].name, user.color, users[targetid].color, msg);
  } else {
    user.socket.emit('message', -1, "Could not find a user to message");
  }
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

function getStyle(color) {
  return " style='position:relative;padding:3px;border-radius:6px;background:#"+color+";'";
}

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
    log("Found "+nounArr.length+" nouns")
  }
});

var adjArr = [];
fs.readFile(__dirname + '/adj.txt', 'utf-8', function(err, data) {
  if(!err) {
    adjArr = data.split("\n")
    log("Found "+adjArr.length+" adjectives")
  }
});

app.set('port', (process.env.PORT || 5000));

var idCount = 0;

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket) {

  var ipAddr = socket.request.headers["x-forwarded-for"];
  if (ipAddr){
    var list = ipAddr.split(",");
    ipAddr = list[list.length-1];
  } else {
    ipAddr = undefined;
  }
  var addr = ipAddr;
  var bot =  (addr.indexOf("12.") == 0);

  var user = {};
  var id = idCount++;
  var name = (bot ? "ROBOT" : "User ")+id;

  user.name = name;
  user.bot = bot;
  user.addr = addr;
  user.isAdmin = false;
  user.id = id;
  user.history = [];
  user.delay = 1000;
  user.joinTime = new Date().getTime();
  user.lastMessage = '';
  user.lastMessageTime = '';
  user.color = 'fff'
  //log("color "+user.color);
  user.socket = socket;

  users[id] = user;

  if(!bot) {
    user.room = 'Main';
    socket.join('Main')
  }

  socket.broadcast.to(user.room).emit('connection', user.name);

  log('user '+user.id+' connected '+socket.handshake.address);
  socket.emit('message', -1, "Connected as <b>"+user.name+"</b>");

  if(!bot) {
    command['color'](user);
    command['nick'](user);
    command['list'](user);
    command['help'](user);
    command['motd'](user);
  }

  socket.on('chatmessage', function(msg) {

    msg = msg.trim();

    if(msg.charAt(0) == '/') { //handle commands
      args = msg.substring(1).split(' ') //split commands into arguments
      if(command.hasOwnProperty(args[0]) && (user.isAdmin && command[args[0]].adminOnly || !command[args[0]].adminOnly)) { //check if command exists
        log('command '+user.id+" "+args.join(' '));
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
    
    if(msg.toUpperCase() == msg && msg.length > 10 && msg.toUpperCase() != msg.toLowerCase()) {
      socket.emit('message', -1, "Please don't type in all capital letters!");
      user.delay += 200;
      return;
    }

//    if(msg.length / msg.split(' ').length)

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

    log('message('+user.id+'): ' + msg);
    io.to(user.room).emit('chatmessage', user.id, user.name, user.color, msg);
  });

  socket.on('disconnect', function() {
    if(!user.hidden)
      socket.broadcast.to(user.room).emit('disconnection', user.name, user.color);
    delete users[user.id];
    log('user '+user.id+' disconnected');
  });
});

http.listen(app.get('port'));

