import Q from 'q';
import moment from 'moment';
import Milestone from './src/domain/Milestone';
import Action from './src/domain/Action';
import { register, unregister, registeredMethods as bulkRegister } from './src/dispatcher';
import { setup, getConfig, RETRY_TIMESPAN } from './src/config';
import { connect } from './src/db';
import { run, spawn, createMilestone } from './src/robot';

const configure = (mongoConnectionString, retryTimespan, jobsCollectionName) => {
    setup(mongoConnectionString, retryTimespan, jobsCollectionName);

    const deferred = Q.defer();

    Q.spawn(function* () {
        try {
            const result = yield connect();

            deferred.resolve({ run, spawn, register, unregister, bulkRegister });
        }
        catch (e) {
            deferred.reject(e);
        }
    });

    return deferred.promise;
}

export { configure, Milestone, Action };