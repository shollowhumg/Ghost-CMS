"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// express-session ships no types
const { Store } = require('express-session');
class SessionStore extends Store {
    SessionModel;
    constructor(SessionModel) {
        super();
        this.SessionModel = SessionModel;
    }
    destroy(sid, callback) {
        this.SessionModel.destroy({ session_id: sid })
            .then(() => {
            callback(null);
        })
            .catch(callback);
    }
    get(sid, callback) {
        this.SessionModel.findOne({ session_id: sid })
            .then((model) => {
            if (!model) {
                return callback(null, null);
            }
            callback(null, model.get('session_data'));
        })
            .catch(callback);
    }
    set(sid, sessionData, callback) {
        this.SessionModel.upsert({ session_data: sessionData }, { session_id: sid })
            .then(() => {
            callback(null);
        })
            .catch(callback);
    }
    clear(callback) {
        this.SessionModel.destroyAll()
            .then(() => {
            callback(null);
        })
            .catch(callback);
    }
}
exports.default = SessionStore;
