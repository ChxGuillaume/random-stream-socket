const db = require('./DB.class');

class VisitHistory {

    async generateNewSession() {
        return new Promise(async (resolve, reject) => {
            let token = VisitHistory.generate_token(64);

            while (await this.sessionExist(token)) token = VisitHistory.generate_token(64);

            db.query('INSERT INTO `user_session` SET ?', {
                token,
            }, function (error, results, fields) {
                if (error) reject(error);
                resolve(token);
            });
        });
    }

    newHistoryRow(token, streamerName) {
        new Promise(async () => {
            let userId = await this.getUserId(token);

            if (userId) db.query('INSERT INTO `user_visits` SET ?', {
                user_id: userId,
                streamer_id: await this.getStreamerId(streamerName),
                date: new Date(),
            });
        });
    }

    async getVisits(token) {
        return new Promise(async (resolve, reject) => {
            let userId = await this.getUserId(token);

            if (userId) db.query('SELECT date, name FROM `user_visits` u JOIN `streamers` s ON (u.streamer_id = s.id) WHERE user_id = ? ORDER BY date DESC', [userId], function (error, results, fields) {
                if (error) reject(error);
                resolve(results.map(e => {
                    return {date: e.date, name: e.name}
                }));
            });
        });
    }

    async sessionExist(token) {
        return new Promise((resolve, reject) => {
            db.query('SELECT * FROM `user_session` WHERE token = ?', [token], function (error, results, fields) {
                if (error) reject(error);
                resolve(results.length >= 1);
            });
        });
    }

    async getUserId(token) {
        return new Promise((resolve, reject) => {
            db.query('SELECT * FROM `user_session` WHERE token = ?', [token], function (error, results, fields) {
                if (error) reject(error);
                if (results.length >= 1) resolve(results[0].id);
                else resolve(false);
            });
        });
    }

    async getStreamerId(streamer) {
        return new Promise((resolve, reject) => {
            db.query('SELECT * FROM `streamers` WHERE name = ?', [streamer], function (error, results, fields) {
                if (error) reject(error);
                if (results.length >= 1) resolve(results[0].id);
                else db.query('INSERT INTO `streamers` SET ?', {name: streamer}, function (error, results, fields) {
                    if (error) reject(error);
                    resolve(results.insertId);
                })
            });
        });
    }


    static generate_token(length) {
        let a = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890".split("");
        let b = [];
        for (let i = 0; i < length; i++) {
            let j = (Math.random() * (a.length - 1)).toFixed(0);
            b[i] = a[j];
        }
        return b.join("");
    }

}

module.exports = () => {
    return new VisitHistory();
};
