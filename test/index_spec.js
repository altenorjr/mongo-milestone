import Q from 'q';
import { expect } from 'chai';
import { stub } from 'sinon';

import { MongoClient } from 'mongodb';

import * as db from '../src/db';
import * as config from '../src/config';
import { configure } from '../index';

const close = () => { };
const collection = () => ({});

describe("Main Module export", () => {
    beforeEach(() => {
        stub(MongoClient, 'connect').resolves({ close, collection });
    });

    afterEach(() => {
        db.close();

        if (MongoClient.connect.restore) {
            MongoClient.connect.restore();
        }
    });

    it('Can be configured with just a connection string', (done) => {
        Q.spawn(function* () {
            const cs = 'mongo-connection-string';

            const result = yield configure(cs);

            result.should.not.be.null;

            expect(config.getConfig(config.MONGO_CONNECTION_STRING)).to.be.equal(cs);

            done();
        });
    });


    it('Can be configured with a connection string and a custom retry timespan', (done) => {
        Q.spawn(function* () {
            const cs = 'mongo-connection-string';
            const timespan = 15;

            const result = yield configure(cs, timespan);

            result.should.not.be.null;

            expect(config.getConfig(config.MONGO_CONNECTION_STRING)).to.be.equal(cs);
            expect(config.getConfig(config.RETRY_TIMESPAN)).to.be.equal(timespan);

            done();
        });
    });

    it('Can be configured with a connection string, retry timespan and a custom collection name', (done) => {
        Q.spawn(function* () {
            const cs = 'mongo-connection-string';
            const timespan = 15;
            const collection = 'MongoMilestone';

            const result = yield configure(cs, timespan, collection);

            result.should.not.be.null;

            expect(config.getConfig(config.MONGO_CONNECTION_STRING)).to.be.equal(cs);
            expect(config.getConfig(config.RETRY_TIMESPAN)).to.be.equal(timespan);
            expect(config.getConfig(config.JOBS_COLLECTION_NAME)).to.be.equal(collection);

            done();
        });
    });
})