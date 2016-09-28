import 'babel-polyfill';

import Q from 'q';
import moment from 'moment';
import Milestone from './domain/Milestone';
import Action from './domain/Action';
import { register, unregister, registeredMethods as bulkRegister } from './dispatcher';
import { setup, getConfig, RETRY_TIMESPAN } from './config';
import { connect } from './db';
import { run, spawn, createMilestone } from './robot';

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