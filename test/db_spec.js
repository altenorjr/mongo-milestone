import Q from 'q';
import { expect } from 'chai';
import { stub } from 'sinon';

import { MongoClient } from 'mongodb';

import * as db from '../src/db';
import * as config from '../src/config';

const close = () => { };
const collection = () => ({});

describe('DB', () => {
    afterEach(() => {
        db.close();

        if (MongoClient.connect.restore) {
            MongoClient.connect.restore();
        }
    });

    it('Can react to successful connection', (done) => {
        stub(MongoClient, 'connect').resolves({ close, collection });

        config.setup('mongodb://localhost:27017/teste');

        Q.spawn(function* () {
            const result = yield db.connect('mongodb://localhost:27017/teste');

            result.should.not.be.null;
            expect(result.milestones).not.to.be.deep.equal(db.milestones);

            done();
        });
    });

    it("Can react to a failed connection", (done) => {
        const err = 'Something went wrong';

        stub(MongoClient, 'connect').rejects(new Error('Something went wrong'));

        let counter = 0;

        Q.spawn(function* () {
            try {
                yield db.connect('mongodb://localhost:27017/teste');
            }
            catch (e) {
                counter++;

                expect(e).not.to.be.null;
                expect(e.message).to.be.equal(err);
                expect(counter).to.be.equal(1);

                done();
            }
            finally {
                MongoClient.connect.restore();
            }
        });
    });

    it("Can't get the collections before the database is initialized", () => {
        expect(db.milestones).to.be.null;
    })
});