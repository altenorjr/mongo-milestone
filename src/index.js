import Q from 'q';
import moment from 'moment';
import Milestone from './domain/Milestone';
import Action from './domain/Action';
import { register, unregister, registerMethods as bulkRegister } from './dispatcher';
import { setup, getConfig, RETRY_TIMESPAN } from './config';
import { connect } from './db';
import { run, spawn, createMilestone } from './robot';

const deferred = Q.defer();
const isReady = deferred.promise;

const configure = (mongoConnectionString, retryTimespan, jobsCollectionName) => {
    setup(mongoConnectionString, retryTimespan, jobsCollectionName);

    Q.spawn(function* () {
        try {
            const result = yield connect();

            deferred.resolve({ run, spawn, register, unregister, bulkRegister });
        }
        catch (e) {
            deferred.reject(e);
        }
    });

    return isReady;
}

export { configure, Milestone, Action, isReady, register, unregister, bulkRegister, run, spawn };