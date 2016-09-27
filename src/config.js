import Q from 'q';

export const MONGO_CONNECTION_STRING = 'mongoConnectionString';
export const RETRY_TIMESPAN = 'retryTimespan';
export const JOBS_COLLECTION_NAME = 'jobsCollectionName';

export const resetDefaults = () => {
    Object.assign(config, {
        mongoConnectionString: null,
        retryTimespan: 30,
        jobsCollectionName: '__milestones__'
    });
}

const config = {};

resetDefaults();

export const getConfig = (path) => {
    return config[path];
};

export const setup = (mongoConnectionString, retryTimespan, jobsCollectionName) => {
    config.mongoConnectionString = mongoConnectionString || config.mongoConnectionString;
    config.retryTimespan = retryTimespan || config.retryTimespan;
    config.jobsCollectionName = jobsCollectionName || config.jobsCollectionName;

    return config;
};