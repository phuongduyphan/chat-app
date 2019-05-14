const _ = require('lodash');

const
  { User } = require('../user/user'),
  { Room } = require('../room/room');

module.exports = async (io) => {
  const chatChannel = io.of('/chat');

  // just set up a bit :)
  const room = new Room('83ed2a10-5206-4745-a4d8-293f28665438', 'Net Centric Class',
    'Just for demo');
  room.id = '986ac6d9-2030-420c-aa13-f0c4a9685819';

  chatChannel.on('connection', (socket) => {
    socket.on('create_user', async (callback) => {
      try {
        const displayName = Math.random().toString(36).substring(7);

        const user = await User.createNewUser(displayName);
        callback({
          id: user.id,
          displayName: user.display_name
        });
      } catch (err) {
        console.log(err);
        socket.emit('exception', err);
      }
    });

    socket.on('change_display_name', async (user, name, callback) => {
      try {
        const userInfo = await User.changeDisplayName(user.id, name);
        callback(userInfo);
      } catch (err) {
        console.log(err);
        socket.emit('exception', err);
      }
    });

    socket.on('user_typing', async (user) => {
      try {
        const userInfo = await User.getUserById(user.id);

        if (!_.isEmpty(userInfo)) {
          socket.broadcast.emit('user_typing', userInfo);
        }
      } catch (err) {
        console.log(err);
        socket.emit('exception', err);
      }
    });

    socket.on('user_stop_typing', async (user) => {
      try {
        const userInfo = await User.getUserById(user.id);
        if (!_.isEmpty(userInfo)) {
          socket.broadcast.emit('user_stop_typing', userInfo);
        }
      } catch (err) {
        console.log(err);
        socket.emit('exception', err);
      }
    });

    socket.on('join_room', async (user, callback) => {
      try {
        await User.addUser(user.id, user.displayName);
        await room.addMember(user.id);
        callback('OK');
      } catch (err) {
        console.log(err);
        socket.emit('exception', err);
      }
    });

    socket.on('add_message', async (user, message) => {
      try {
        await room.addMessage(user.id, message);
        socket.broadcast.emit('new_message', user, message);
        
      } catch (err) {
        console.log(err);
        socket.emit('exception', err);
      }
    });

    socket.on('get_all_message', async (callback) => {
      try {
        const messages = await room.getMessages();
        callback(messages);
      } catch (err) {
        console.log(err);
        socket.emit('exception', err);
      }
    });
  });
};
