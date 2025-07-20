const mineflayer = require('mineflayer');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalBlock } = require('mineflayer-pathfinder').goals;

const config = require('./settings.json');
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Bot has arrived');
});

app.listen(8000, () => {
  console.log('Server started');
});

function createBot() {
  const bot = mineflayer.createBot({
    username: config['bot-account']['username'],
    password: config['bot-account']['password'],
    auth: config['bot-account']['type'],
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version
  });

  bot.loadPlugin(pathfinder);
  const mcData = require('minecraft-data')(bot.version);
  const defaultMove = new Movements(bot, mcData);
  bot.settings.colorsEnabled = false;

  let pendingPromise = Promise.resolve();

  function sendRegister(password) {
    return new Promise((resolve, reject) => {
      bot.chat(`/register ${password} ${password}`);
      console.log(`[Auth] Sent /register command.`);

      bot.once('chat', (username, message) => {
        console.log(`[ChatLog] <${username}> ${message}`);
        if (message.includes('successfully registered') || message.includes('already registered')) {
          resolve();
        } else {
          reject(`Registration failed: ${message}`);
        }
      });
    });
  }

  function sendLogin(password) {
    return new Promise((resolve, reject) => {
      bot.chat(`/login ${password}`);
      console.log(`[Auth] Sent /login command.`);

      bot.once('chat', (username, message) => {
        console.log(`[ChatLog] <${username}> ${message}`);
        if (message.includes('successfully logged in')) {
          resolve();
        } else {
          reject(`Login failed: ${message}`);
        }
      });
    });
  }

  bot.once('spawn', () => {
    console.log('[AfkBot] Bot joined the server');

    const password = config.utils['auto-auth'].password;
    if (config.utils['auto-auth'].enabled) {
      pendingPromise = pendingPromise
        .then(() => sendRegister(password))
        .then(() => sendLogin(password))
        .catch(err => console.error('[ERROR]', err));
    }

    if (config.utils['chat-messages'].enabled) {
      const messages = config.utils['chat-messages'].messages;
      const delay = config.utils['chat-messages']['repeat-delay'] * 1000;
      let i = 0;
      setInterval(() => {
        bot.chat(messages[i]);
        i = (i + 1) % messages.length;
      }, delay);
    }

    if (config.position.enabled) {
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalBlock(config.position.x, config.position.y, config.position.z));
    }

    if (config.utils['anti-afk'].enabled) {
      console.log('[Anti-AFK] Enabled anti-AFK movements');

      setInterval(() => {
        bot.setControlState('jump', true);
        setTimeout(() => bot.setControlState('jump', false), 1000);
        if (config.utils['anti-afk'].sneak) {
          bot.setControlState('sneak', true);
          setTimeout(() => bot.setControlState('sneak', false), 1000);
        }
        bot.look(Math.random() * Math.PI * 2, 0);
      }, 30000); // Every 30 seconds
    }
  });

  bot.on('goal_reached', () => {
    console.log(`[AfkBot] Reached goal at ${bot.entity.position}`);
  });

  bot.on('death', () => {
    console.log(`[AfkBot] Bot died and respawned at ${bot.entity.position}`);
  });

  bot.on('kicked', reason => {
    console.log(`[AfkBot] Bot was kicked. Reason: ${reason}`);
  });

  bot.on('error', err => {
    console.log(`[ERROR] ${err.message}`);
  });

  if (config.utils['auto-reconnect']) {
    bot.on('end', () => {
      setTimeout(() => {
        createBot();
      }, config.utils['auto-recconect-delay']);
    });
  }
}

createBot();
