const
  express = require('express'),
  cluster = require('cluster'),
  net = require('net'),
  sio = require('socket.io'),
  sio_redis = require('socket.io-redis'),
  farmhash = require('farmhash');

const
  createError = require('http-errors'),
  path = require('path'),
  cookieParser = require('cookie-parser'),
  logger = require('morgan');

const 
  indexRouter = require('./routes/index'),
  usersRouter = require('./routes/users');

const 
  port = 3000,
  num_processes = require('os').cpus().length;

if (cluster.isMaster) {
  // This stores our workers. We need to keep them to be able to reference
  // them based on source IP address. It's also useful for auto-restart,
  // for example.
  const workers = [];

  // Helper function for spawning worker at index 'i'.
  const spawn = function (i) {
    workers[i] = cluster.fork();

    // Optional: Restart worker on exit
    workers[i].on('exit', function (code, signal) {
      console.log('respawning worker', i);
      spawn(i);
    });
  };

  // Spawn workers.
  for (let i = 0; i < num_processes; i++) {
    spawn(i);
  }

  // Helper function for getting a worker index based on IP address.
  // This is a hot path so it should be really fast. The way it works
  // is by converting the IP address to a number by removing non numeric
  // characters, then compressing it to the number of slots we have.
  //
  // Compared against "real" hashing (from the sticky-session code) and
  // "real" IP number conversion, this function is on par in terms of
  // worker index distribution only much faster.
  const worker_index = function (ip, len) {
    return farmhash.fingerprint32(ip) % len; // Farmhash is the fastest and works with IPv6, too
  };

  // Create the outside facing server listening on our port.
  const server = net.createServer({ pauseOnConnect: true }, function (connection) {
    // We received a connection and need to pass it to the appropriate
    // worker. Get the worker for this connection's source IP and pass
    // it the connection.
    const worker = workers[worker_index(connection.remoteAddress, num_processes)];
    worker.send('sticky-session:connection', connection);
  }).listen(port, () => {
    console.log(`Master server is running on ${port}`);
  });
} else {
  
  // Note we don't use a port here because the master listens on it for us.
  const app = new express();

  // Here you might use middleware, attach routes, etc.

  // view engine setup
  app.set('views', path.join(__dirname, 'views'));
  app.set('view engine', 'ejs');

  app.use(logger('dev'));
  app.use(logger(`process-pid: ${process.pid}`));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, 'public')));

  app.use('/', indexRouter);
  app.use('/users', usersRouter);

  // catch 404 and forward to error handler
  app.use(function (req, res, next) {
    next(createError(404));
  });

  // error handler
  app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
  });

  // Don't expose our internal server to the outside.
  const server = app.listen(0, 'localhost', () => {
    console.log(`Worker server ${process.pid} is running`);
  }),
    io = sio(server);

  // Tell Socket.IO to use the redis adapter. By default, the redis
  // server is assumed to be on localhost:6379. You don't have to
  // specify them explicitly unless you want to change them.
  io.adapter(sio_redis({ host: 'localhost', port: 6379 }));

  // Here you might use Socket.IO middleware for authorization etc.

  // Listen to messages sent from the master. Ignore everything else.
  require('./src/channel/channel')(io);
  process.on('message', function (message, connection) {
    if (message !== 'sticky-session:connection') {
      return;
    }

    // Emulate a connection event on the server by emitting the
    // event with the connection the master sent us.
    server.emit('connection', connection);

    connection.resume();
  });
}
