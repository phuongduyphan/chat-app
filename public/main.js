$(document).ready(function () {
  $("#sidebar").mCustomScrollbar({
    theme: "minimal"
  });

  $('#sidebarCollapse').on('click', function () {
    $('#sidebar, #content').toggleClass('active');
    $('.collapse.in').toggleClass('in');
    $('a[aria-expanded=true]').attr('aria-expanded', 'false');
  });
});

// socket.io 
const socket = io('/chat');

socket.on('connect', async () => {
  let userInfo;
  const nameField = document.getElementById('name-field');
  const chatTextField = document.getElementById('chat-textfield');
  const typingIndicator = document.getElementById('typing-indicator-wrapper');
  const chatContent = document.getElementById('chat-content');

  if (!localStorage.getItem('userInfo')) {
    socket.emit('create_user', (user) => {
      localStorage.setItem('userInfo', JSON.stringify(user));
      userInfo = user;
      socket.emit('join_room', userInfo, () => {
        console.log('Joined room');
        initialize();
      });
    })
  } else {
    userInfo = JSON.parse(localStorage.getItem('userInfo'));
    socket.emit('join_room', userInfo, () => {
      console.log('Joined room');
      initialize();
    });
  }

  const initialize = () => {
    nameField.value = userInfo.displayName;
    socket.emit('get_all_message', (messages) => {
      messages.forEach(ele => {
        addMessage(ele.userInfo, ele.message);
      });
    });
  }

  nameField.addEventListener('focusout', () => {
    const name = nameField.value;
    socket.emit('change_display_name', userInfo, name, (user) => {
      userInfo = user;
      localStorage.setItem('userInfo', JSON.stringify(user));
    });
  });

  function delay(callback, ms) {
    var timer = 0;
    return function () {
      var context = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        callback.apply(context, args);
      }, ms || 0);
    };
  }

  // global varibales
  const userTypingList = [];
  const messages = [];

  socket.on('user_typing', (user) => {
    if (!_.find(userTypingList, user)) {
      userTypingList.push(user);
    }
    renderTypingList();
  });

  socket.on('user_stop_typing', (user) => {
    _.remove(userTypingList, (ele) => {
      return ele.id === user.id;
    });
    renderTypingList();
  });


  chatTextField.addEventListener('keyup', (e) => {
    if (e.keyCode === 13) {
      socket.emit('user_stop_typing', userInfo);
      const content = chatTextField.value;
      if (content) {
        chatTextField.value = '';
        addMessage(userInfo, content);

        socket.emit('add_message', userInfo, content);
      }
    } else {
      const keycode = e.keyCode;
      let valid =
        (keycode > 47 && keycode < 58) || // number keys
        keycode == 32 || keycode == 13 || // spacebar & return key(s) (if you want to allow carriage returns)
        (keycode > 64 && keycode < 91) || // letter keys
        (keycode > 95 && keycode < 112) || // numpad keys
        (keycode > 185 && keycode < 193) || // ;=,-./` (in order)
        (keycode > 218 && keycode < 223);   // [\]' (in order)
      if (valid) socket.emit('user_typing', userInfo);
    }
  });

  $('#chat-textfield').keyup(delay(function (e) {
    socket.emit('user_stop_typing', userInfo);
  }, 1600));

  const renderTypingList = () => {

    let str = '';
    userTypingList.forEach(ele => {
      str += `<p>${ele.displayName} is typing ...</p>`
    });
    typingIndicator.innerHTML = str;
    chatContentScrollIntoView();
  }

  const chatContentScrollIntoView = () => {
    chatContent.lastElementChild.scrollIntoView();
  }

  const addMessage = (user, message) => {
    const node = document.createElement('p');
    const spannode = document.createElement('span');
    const nameNode = document.createTextNode(`${user.displayName}: `);
    spannode.appendChild(nameNode);
    const contentNode = document.createTextNode(message);
    node.appendChild(spannode);
    node.appendChild(contentNode);
    chatContent.insertBefore(node, typingIndicator);

    chatContentScrollIntoView();
  };

  socket.on('new_message', (user, message) => {
    addMessage(user, message);
  });
});