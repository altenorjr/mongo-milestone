import Q from 'q';
import { expect } from 'chai';

import * as config from '../src/config';

describe("Configurations", () => {
    it("Can Configure the Milestone parameters", () => {
        const cs = 'mongodb://localhost:27017/teste';
        const retry = 30;
        const collection = 'MongoMilestone';
        
        const result = config.setup(cs, retry, collection);
        
        expect(result[config.MONGO_CONNECTION_STRING]).to.be.equal(cs);
        expect(result[config.RETRY_TIMESPAN]).to.be.equal(retry);
        expect(result[config.JOBS_COLLECTION_NAME]).to.be.equal(collection);
    });
    
    it("Can read configured parameters", () => {
        const cs = 'mongodb://localhost:27017/teste';
        const retry = 30;
        const collection = 'MongoMilestone';
        
        config.setup(cs, retry, collection);
        
        expect(config.getConfig(config.MONGO_CONNECTION_STRING)).to.be.equal(cs);
        expect(config.getConfig(config.RETRY_TIMESPAN)).to.be.equal(retry);
        expect(config.getConfig(config.JOBS_COLLECTION_NAME)).to.be.equal(collection);
    });    
});