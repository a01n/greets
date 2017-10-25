const yaml = require('js-yaml');
const fs = require('fs');
const Sysmsg = require('sysmsg');

let greets;

function load() {
  try {
    greets = yaml.safeLoad(fs.readFileSync(__dirname + 'greets.yml', 'utf8'));
    if (greets) return true;
  } catch (e) {
    console.log(e);
    return false;
  }
}

load();
fs.watch('greets.yml', load);

function idToString(id) {
  return `${id.high},${id.low}`;
}

module.exports = function Greets(dispatch) {
  const sysmsg = new Sysmsg(dispatch);
  let myName;
  let lastGreetedBy;
  let greetMessage = '';
  const returnEmotes = { 23: true, 24: true, 25: true, 26: true, 28: true, 29: true, 38: true };

  const nameMap = new Map();

  function getGreet(name) {
    if (!greets) return '';

    if (!greets[myName]) return '';

    if (!greets[myName][name]) {
      name = '___default';
    }

    if (!greets[myName][name]) return '';

    const length = greets[myName][name].length;
    const g = Math.floor(Math.random() * length);
    return greets[myName][name][g];
  }

  function hasGreet(name) {
    const names = greets[myName];
    return names && names[name];
  }

  dispatch.hook('S_LOGIN', 1, (event) => {
    myName = event.name;
    greetMessage = '';
  });

  dispatch.hook('S_SPAWN_USER', 1, (event) => {
    const cid = idToString(event.cid);
    nameMap.set(cid, event.name);
  });

  dispatch.hook('S_DESPAWN_USER', 1, (event) => {
    const cid = idToString(event.target);
    nameMap.delete(cid);
  });

  dispatch.hook('C_START_INSTANCE_SKILL', 1, (event) => {
    if (event.skill === 127510165) {
      console.log(event.targets);
      let name = '';

      // Try pruning non-player targets
      event.targets = event.targets.filter(targ => nameMap.has(idToString(targ.target)));
      console.log(event.targets);

      // Assuming here the first target is always chosen
      if (event.targets.length > 0) {
        const cid = idToString(event.targets[0].target);
        if (nameMap.has(cid)) name = nameMap.get(cid);
      }

      if (name) {
        greetMessage = getGreet(name);
        console.log('Name: %s ', name);
        console.log('Greet message: %s', greetMessage);
      } else {
        greetMessage = '';
      }
    }
  });

  dispatch.hook('S_SOCIAL', 1, (event) => {
    const name = nameMap.get(idToString(event.target));
    if (!name || !hasGreet(name) || !lastGreetedBy) return;
    if (name !== lastGreetedBy.name) return;
    const delta = Date.now() - lastGreetedBy.time;
    if (delta > 5000) {
      lastGreetedBy = null;
      return;
    }

    if (!returnEmotes[event.animation]) return;
    console.log('Time to return friend emote %s', event.animation);
    dispatch.toServer('cSocial', 1, { emote: event.animation, unk: 0 });
    lastGreetedBy = null;
  });

  dispatch.hook('C_CHAT', 1, (event) => {
    if (event.channel === 9 && greetMessage) {
      event.message = greetMessage;
      return true;
    }
  });

  sysmsg.on('SMT_FRIEND_RECEIVE_HELLO', (params) => {
    const name = params['UserName'];
    if (!hasGreet(name)) return;
    lastGreetedBy = { name, time: Date.now(), lastReacted: Date.now() };
  });
};
