const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const Streams = require('./Streams.class')();
const Scheduler = require('./Scheduler.class')(Streams);
const VisitHistory = require('./VisitHistory.class')();
const db = require('./DB.class');

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', function (socket) {
    socket.on('initSession', async (eSession) => {
        if (!eSession.session) {
            socket.emit('initSession', await VisitHistory.generateNewSession());
        }
    });

    socket.on('getFirstData', () => {
        socket.emit('getFirstData', {
            streamersCount: Streams.streamsCount(),
        });
    });

    socket.on('getGames', () => {
        socket.emit('getGames', Streams.getGames());
    });

    socket.on('getStreams', () => {
        socket.emit('getStreams', Streams.streams);
    });

    socket.on('pickRandom', async (obj) => {
        let pickedStream = Streams.pickRandomStream(obj.games);

        VisitHistory.newHistoryRow(obj.session, pickedStream.user_name);

        socket.emit('pickRandom', pickedStream);
    });

    socket.on('streamsCount', (games) => {
        socket.emit('streamsCount', Streams.getStreamsCount(games));
    });

    socket.on('getStats', async (obj) => {
        socket.emit('getStats', await Scheduler.getWeeksStats(obj.token, obj.week));
    });

    socket.on('getStatsWeeks', async (obj) => {
        socket.emit('getStatsWeeks', await Scheduler.getStatsWeeks(obj.token));
    });

    socket.on('getVisits', async (obj) => {
        socket.emit('getVisits', await VisitHistory.getVisits(obj.session));
    });
});

http.listen(3000, function () {
    console.log('listening on *:3000'.red);

    Streams.onFetchFinished(() => {
        io.emit('newFetch', {
            streamersCount: Streams.streamsCount(),
        });

        io.emit('getGames', Streams.getGames());
    });
});
