import Q from 'q';
import { MongoClient } from 'mongodb';

import { getConfig, MONGO_CONNECTION_STRING, JOBS_COLLECTION_NAME } from './config';

let db;

let milestones = null;

export { milestones };

export const connect = () => {
    var deferred = Q.defer();

    Q.spawn(function* () {
        try {
            if (db) {
                return deferred.resolve(db);
            }

            db = yield MongoClient.connect(getConfig(MONGO_CONNECTION_STRING));

            milestones = db.collection(getConfig(JOBS_COLLECTION_NAME));

            deferred.resolve(milestones);
        }
        catch (e) {
            deferred.reject(e);
        }
    });

    return deferred.promise;
}

export const close = () => {
    if (!db) {
        return;
    }

    db.close();

    db = undefined;

    milestones = null;
};