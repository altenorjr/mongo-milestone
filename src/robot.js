import Q from 'q';
import moment from 'moment';
import serializeError from 'serialize-error';
import { dispatch } from './dispatcher';
import { getConfig, RETRY_TIMESPAN } from './config';

import Milestone from './domain/Milestone';
import Action from './domain/Action';
import Attempt from './domain/Attempt';
import NamedAttempt from './domain/NamedAttempt';
import * as db from './db';

export const INVALID_MILESTONE = 'The object passed in should be of type Milestone';
export const MILESTONE_NOT_FOUND = 'The passed id is not of a valid Milestone';
export const ACTION_NOT_READY = (type) => `The Action "${type}" is not yet ready to be retried. Check the retry timespan.`;

const threshold = () => {
    return moment().subtract(getConfig(RETRY_TIMESPAN), 'minutes').toDate();
};

const getElapsedTime = (start, end = new Date()) => {
    const offset = (new Date()).getTimezoneOffset();

    const method = offset > 0 ? 'add' : 'subtract';

    const elapsed = moment(end.getTime() - start.getTime())[method](offset, 'minutes').format('H:mm"ss\'SSS\\m\\s');

    return { start, end, elapsed };
};

export const spawn = () => {
    var deferred = Q.defer();

    Q.spawn(function* () {
        try {
            const timespan = getConfig(RETRY_TIMESPAN);

            const nextRun = moment().add(timespan, 'minutes').toDate();

            const result = yield run();

            const currentRunEnd = new Date();

            deferred.resolve(result);

            const nextRunPassed = moment(currentRunEnd).isAfter(nextRun);

            if (nextRunPassed) {
                return spawn();
            }

            const millisecondsToNextRun = nextRun.getTime() - currentRunEnd.getTime();

            setTimeout(() => {
                spawn();
            }, millisecondsToNextRun);
        }
        catch (e) {
            deferred.resolve(e);
        }
    });

    return deferred.promise;
};

export const run = () => {
    const deferred = Q.defer();

    Q.spawn(function* () {
        try {
            const currentRunStart = new Date();

            const found = yield db.milestones.aggregate([
                { $match: { state: false } },
                { $project: { _id: true, type: true, parameters: true } },
                { $sort: { _id: 1 } }
            ]).toArray();

            const resolved = [];
            const rejected = [];

            for (const milestone of found) {
                const milestoneStart = new Date();

                try {
                    const output = yield robot.startMilestone(milestone._id);

                    const { elapsed } = getElapsedTime(milestoneStart);

                    resolved.push({ milestone, output, elapsed });
                }
                catch (error) {
                    const { elapsed } = getElapsedTime(milestoneStart);

                    rejected.push({ milestone, error, elapsed });
                }
            }

            const elapsed = getElapsedTime(currentRunStart);

            deferred.resolve({ found, resolved, rejected, elapsed });
        }
        catch (e) {
            deferred.reject(e);
        }
    });

    return deferred.promise;
};

export const createMilestone = (milestone) => {
    const deferred = Q.defer();

    if (!(milestone instanceof Milestone)) {
        throw new Error(INVALID_MILESTONE);
    }

    Q.spawn(function* () {
        try {
            yield db.milestones.insertOne(milestone);

            deferred.resolve(milestone);
        }
        catch (e) {
            deferred.reject(e);
        }
    });

    return deferred.promise;
};

export const startMilestone = (id) => {
    var deferred = Q.defer();

    Q.spawn(function* () {
        try {
            let milestone = yield db.milestones.findOne({ _id: id });

            if (!milestone) {
                return deferred.reject(new Error(MILESTONE_NOT_FOUND))
            }

            const params = { milestone: milestone.parameters };

            const output = yield robot.runAction(milestone, milestone.action, params, 'action');

            milestone = yield db.milestones.findOne({ _id: id });

            const milestoneOutput = milestone.report.filter(t => t.success).reduce((params, attempt) => (Object.assign({}, params, { [attempt.actionName]: attempt.output })), params);

            milestone = yield robot.endMilestone(milestone._id, milestoneOutput);

            deferred.resolve(milestone);
        }
        catch (e) {
            deferred.reject(e);
        }
    });

    return deferred.promise;
};

export const endMilestone = (id, output) => {
    const deferred = Q.defer();

    const query = { _id: id };

    Q.spawn(function* () {
        try {
            const result = yield db.milestones.findOneAndUpdate(query, {
                $set: {
                    state: true,
                    endDate: new Date(),
                    output
                }
            }, { returnOriginal: false });

            deferred.resolve(result.value);
        }
        catch (e) {
            deferred.reject(e);
        }
    });

    return deferred.promise;
};

export const runAction = (milestone, action, parameters, path) => {
    var deferred = Q.defer();

    Q.spawn(function* () {
        try {
            if (!action.state) {
                const attemptData = yield robot.createAttempt(milestone, action, parameters, path);

                milestone = attemptData.milestone;

                const attemptId = attemptData.attemptId;

                let methodOutput;
                try {
                    methodOutput = yield dispatch(action.method, parameters);
                }
                catch (e) {
                    methodOutput = e;
                }
                finally {
                    milestone = yield robot.finishAttempt(milestone._id, methodOutput, path, attemptId);
                }

                if (methodOutput instanceof Error) {
                    return deferred.reject(methodOutput);
                }
            }

            const parentSuccessfulOutput = ((walkPath(milestone, `${path}.report`) || []).find(attempt => attempt.success) || {}).output;

            const childrenParameters = Object.assign({}, parameters);

            childrenParameters[action.type] = parentSuccessfulOutput;

            const allActionsComplete = (action.next || []).map((currentAction, index) => {
                if (currentAction.state) {
                    return Q.fcall(() => {
                        return { [currentAction.type]: (currentAction.report.find(t => t.success) || {}).output };
                    });
                }
                else {
                    const lastAttempt = currentAction.report[0];

                    let isAbandoned = lastAttempt ? lastAttempt.success === null && lastAttempt.beginDate.getTime() < threshold().getTime() : false;

                    if (!lastAttempt || lastAttempt.success == false || isAbandoned) {
                        const childPath = `${path}.next.${index}`;

                        return robot.runAction(milestone, currentAction, childrenParameters, childPath);
                    }
                    else {
                        return Q.fcall(() => { throw new Error(ACTION_NOT_READY(currentAction.type)) });
                    }
                }
            });

            const allActionsCompleteResult = yield Q.all(allActionsComplete);

            const doneParameters = allActionsCompleteResult.reduce((parameters, item) => {
                return Object.assign({}, parameters, item);
            }, childrenParameters);

            let doneResult = {};

            if (action.done) {
                doneResult = yield robot.runAction(milestone, action.done, doneParameters, `${path}.done`);
            }

            deferred.resolve({ [action.type]: parentSuccessfulOutput });
        }
        catch (e) {
            deferred.reject(e);
        }
    });

    return deferred.promise;
};


export const createAttempt = (milestone, action, parameters, path) => {
    var deferred = Q.defer();

    const id = milestone._id;

    const namedAttempt = new NamedAttempt(action.type, parameters);
    const attempt = new Attempt(parameters, namedAttempt._id);

    Q.spawn(function* () {
        try {
            const update = {
                $push: {
                    'report': {
                        $each: [namedAttempt],
                        $position: 0
                    }
                }
            };

            update.$push[`${path}.report`] = {
                $each: [attempt],
                $position: 0
            };

            const result = yield db.milestones.findOneAndUpdate({ _id: id }, update, { returnOriginal: false });

            deferred.resolve({ milestone: result.value, attemptId: namedAttempt._id });
        }
        catch (e) {
            deferred.reject(e);
        }
    });

    return deferred.promise;
};


export const finishAttempt = (id, output, path, attemptId) => {
    const deferred = Q.defer();

    const query = { _id: id, 'report._id': attemptId };

    Q.spawn(function* () {
        try {
            const isError = output instanceof Error;

            const parsedOutput = isError ? serializeError(output) : (typeof output.toObject === 'function' ? output.toObject() : output);

            const completionDate = new Date();

            const update = {
                $set: {
                    'report.$.success': !isError,
                    'report.$.output': parsedOutput,
                    'report.$.endDate': completionDate,
                }
            };

            update.$set[`${path}.report.0.success`] = !isError;
            update.$set[`${path}.report.0.output`] = parsedOutput;
            update.$set[`${path}.report.0.endDate`] = completionDate;

            if (!isError) {
                update.$set[`${path}.state`] = true;
            }

            const result = yield db.milestones.findOneAndUpdate(query, update, { returnOriginal: false });

            deferred.resolve(result.value);
        }
        catch (e) {
            deferred.reject(e);
        }
    });

    return deferred.promise;
};

export const walkPath = (obj, path, value) => {
    const keys = path.split('.');

    let result = obj;

    let i = 0;

    for (var key of keys) {
        i++;

        const parsedKey = !isNaN(parseInt(key)) ? parseInt(key) : key;

        if (i == keys.length && value !== undefined) {
            result[parsedKey] = value;
        }

        result = result[parsedKey];

        if (!result) {
            break;
        }
    }

    return result;
};

// const setPath = (obj, path, value) => {
//     const ''
// }

const robot = {
    run,
    spawn,
    createMilestone,
    startMilestone,
    endMilestone,
    runAction,
    walkPath,
    createAttempt,
    finishAttempt,
    INVALID_MILESTONE,
    MILESTONE_NOT_FOUND,
    ACTION_NOT_READY
};

export default robot;