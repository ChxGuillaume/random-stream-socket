const schedule = require('node-schedule');
const colors = require('colors');
const moment = require('moment');
require('moment/locale/fr');
moment.locale('fr');
const db = require('./DB.class');

class Scheduler {

    constructor(Stream) {
        this.stream = Stream;
        this.schedule = schedule.scheduleJob('*/10 * * * *', () => {
            this.retrieveStats();
        });
    }

    retrieveStats() {
        let streamCount = this.stream.getStreamsCount();
        if (streamCount === 0) return;
        let viewerCount = this.stream.getTotalViewersCount();
        let topTenViewerCount = this.stream.getTop10ViewerCount();
        let gamesCount = this.stream.getGames().length;

        db.query('INSERT INTO `stream_activity` SET ?', {
            datetime: new Date(),
            streamCount,
            viewerCount,
            topTenViewerCount,
            gamesCount,
        }, (error, results, fields) => {
            if (error) throw error;
            console.log('STATS STORED'.yellow);
        })
    }

    async getWeeksStats(token, week) {
        if (token !== process.env.STATS_TOKEN) return false;
        let weekDate = moment({hour: 0, minute: 0}).year(week.year);
        let firstDay = weekDate.clone().week(week.week).weekday(0).format();
        let lastDay = weekDate.clone().week(week.week + 1).weekday(0).format();

        return new Promise((resolve, reject) => {
            db.query('SELECT * FROM `stream_activity` WHERE datetime BETWEEN ? AND ?', [firstDay, lastDay], (error, results, fields) => {
                if (error) reject(error);
                resolve(results.map(e => {
                    return {
                        id: e.id,
                        date: new Date(e.datetime).getTime(),
                        streamCount: e.streamCount,
                        viewerCount: e.viewerCount,
                        topTenViewerCount: e.topTenViewerCount,
                        gamesCount: e.gamesCount,
                    };
                }));
            });
        });
    }

    async getStatsWeeks(token) {
        if (token !== process.env.STATS_TOKEN) return false;

        return new Promise((resolve, reject) => {
            db.query('SELECT MIN(datetime) as "min", MAX(datetime) as "max" FROM `stream_activity`', (error, results, fields) => {
                if (error) reject(error);
                let min = moment(results[0].min);
                let max = moment(results[0].max);
                let weeks = [];

                for (let year = min.year(); year <= max.year(); year++) {
                    for (let week = (year === min.year() ? min.week() : 1); week <= (year === max.year() ? max.week() : 12); week++) {
                        let weekDate = moment().year(year).week(week);
                        let firstDay = weekDate.clone().weekday(0);
                        let lastDay = weekDate.clone().weekday(6);

                        weeks.push({week, year, firstDay, lastDay});
                    }
                }

                resolve(weeks);
            });
        });
    }

}

module.exports = (Stream) => {
    return new Scheduler(Stream);
};
