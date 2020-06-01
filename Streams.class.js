require('dotenv').config();
const axios = require('axios');
const colors = require('colors');

class Streams {

    constructor() {
        this.streams = [];
        this.gamesList = [];

        this.fetchStreams = [];
        this.fetchStreamsIDs = [];
        this.fetchEvery = 60 * 1000;
        this.bearer = '';

        this.canFetch = true;

        axios.post(`https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`)
            .then(({data}) => {
                this.bearer = data.access_token;
                this.startFetchStreams();
                setTimeout(() => this.refreshToken(), (data.expires_in * 60));
            });

        this.events = {
            'fetchFinished': () => ({}),
        };
    }

    refreshToken() {
        axios.post(`https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`)
            .then(({data}) => {
                this.bearer = data.access_token;
                setTimeout(() => this.refreshToken(), (data.expires_in * 60));
            });
    }

    /// GETTER FUNCTIONS

    pickRandomStream(games) {
        if (!games || games.length < 1) return this.streams[Math.floor(Math.random() * this.streams.length)];
        else {
            let selectedStreams = this.streams.filter(s => games.includes(parseInt(s.game_id)));
            return selectedStreams[Math.floor(Math.random() * selectedStreams.length)];
        }
    }

    getStreamsCount(games) {
        if (!games || games.length < 1) return this.streams.length;
        else {
            return this.streams.filter(s => games.includes(parseInt(s.game_id))).length;
        }
    }

    getTotalViewersCount() {
        let viewersCount = 0;
        this.streams.forEach(s => viewersCount += s.viewer_count);
        return viewersCount;
    }

    getTop10ViewerCount() {
        let viewersCount = 0;
        this.streams.slice(0, 9).forEach(s => viewersCount += s.viewer_count);
        return viewersCount;
    }

    streamsCount() {
        return this.streams.length;
    }

    getGames() {
        return this.gamesList;
    }

    /// EVENT FUNCTIONS

    onFetchFinished(event) {
        this.events.fetchFinished = event;
    }

    /// FETCHING FUNCTIONS

    startFetchStreams() {
        if (this.canFetch) {
            this.canFetch = false;

            console.log('NEXT FETCH'.yellow, (new Date(Date.now() + this.fetchEvery)).toLocaleTimeString('fr-FR').magenta);

            this.startGetStreams();
        }

        setTimeout(() => {
            this.startFetchStreams();
        }, this.fetchEvery);
    }

    tryAddStream(stream) {
        if (!this.fetchStreamsIDs.includes(stream.id) && stream.type === 'live') {
            this.fetchStreams.push(stream);
            this.fetchStreamsIDs.push(stream.id);
        }
    }

    startGetStreams() {
        console.log('FETCHING STREAMS'.cyan);
        this.fetchStreams = [];
        this.fetchStreamsIDs = [];

        axios.get('https://api.twitch.tv/helix/streams?language=fr&first=100', {
            headers: {
                'Client-ID': process.env.TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${this.bearer}`,
            },
        }).then(r => {
            this.firstFetchedViewerCount = r.data.data[0].viewer_count;

            r.data.data.forEach(e => {
                this.tryAddStream(e);
            });

            this.getNextPage(r.data.pagination.cursor);
        });
    }

    getNextPage(cursor) {
        axios.get(`https://api.twitch.tv/helix/streams?language=fr&first=100&after=${cursor}`, {
            headers: {
                'Client-ID': process.env.TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${this.bearer}`,
            },
        }).then(r => {
            r.data.data.forEach(e => {
                this.tryAddStream(e);
            });

            if (r.data.data[0] && r.data.data[0].viewer_count < this.firstFetchedViewerCount)
                this.getNextPage(r.data.pagination.cursor);
            else {
                this.streams = this.fetchStreams;
                this.streams.sort((a, b) => {
                    if (a.viewer_count < b.viewer_count) return 1;
                    if (a.viewer_count > b.viewer_count) return -1;
                    else return 0;
                });

                console.log('STEAMS FETCHED'.cyan, `(${this.streams.length} total)`.yellow);

                this.events.fetchFinished(this.streams);
                this.fetchGames().then(() => this.canFetch = true);
            }
        }).catch(e => {
            let resetTimeStamp = parseInt(e.response.headers['ratelimit-reset']);
            let RateLimit = e.response.headers['ratelimit-limit'];
            let RateLimitRemaining = e.response.headers['ratelimit-remaining'];

            let resetIn = (resetTimeStamp * 1000) - Date.now() + 2000;

            console.error('ERROR | Retry in:'.red, `${resetIn / 1000} s`.magenta, `RPM: ${RateLimit} - RPMR: ${RateLimitRemaining}`.yellow);

            this.refreshToken();

            if (e.response.status) setTimeout(() => {
                this.getNextPage(cursor);
            }, resetIn);
        });
    }

    async fetchGames() {
        return new Promise(async (resolve, reject) => {
            console.log('FETCHING GAMES'.blue)
            let gamesIds = [];
            let games = {};

            this.streams.forEach(s => {
                if (!gamesIds.includes(s.game_id)) gamesIds.push(s.game_id);
            });

            for (let i = 0; i < Math.ceil(gamesIds.length / 100); i++) {
                let isLastPart = (i === Math.ceil(gamesIds.length / 100));

                let idList = [];
                for (let j = i * 100; j < i * 100 + 100; j++) {
                    idList.push(`id=${gamesIds[j]}`);
                }

                await axios.get(`https://api.twitch.tv/helix/games?${idList.join('&')}`, {
                    headers: {
                        'Client-ID': process.env.TWITCH_CLIENT_ID,
                        'Authorization': `Bearer ${this.bearer}`,
                    },
                }).then(d => {
                    d.data.data.forEach(g => {
                        games[g.id] = {
                            name: g.name,
                            imgUrl: g.box_art_url,
                            streamCount: 0,
                        };
                    })
                });
            }

            this.streams.forEach(s => {
                if (games[s.game_id]) games[s.game_id].streamCount++;
            });

            this.gamesList = {
                games,
                length: Object.keys(games).length,
            };

            console.log('GAMES FETCHED'.blue)
            resolve();
        });
    }
}

module.exports = () => {
    return new Streams;
};
