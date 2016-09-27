import Q from 'q';
import moment from 'moment';
import { expect } from 'chai';
import { stub } from 'sinon';
import serializeError from 'serialize-error';
import { ObjectId } from 'mongodb';

import Milestone from '../src/domain/Milestone';
import Action from '../src/domain/Action';
import Attempt from '../src/domain/Attempt';
import NamedAttempt from '../src/domain/NamedAttempt';
import * as db from '../src/db';
import robot from '../src/robot';
import { register } from '../src/dispatcher';
import { getConfig, RETRY_TIMESPAN } from '../src/config';

const milestoneFactory = () => {
    const rootAction = new Action({
        type: 'do-debit',
        next: [
            new Action({ type: 'do-credit' }),
            new Action({ type: 'confirm-transfer' }),
        ],
        done: new Action({ type: 'update-balances' })
    });

    return new Milestone({
        type: 'bank-transfer',
        action: rootAction,
        parameters: {
            from: 'a',
            to: 'b',
            amount: 1000
        }
    });
};

describe("Robot", () => {
    let milestone, bank;

    beforeEach(() => {
        db.milestones = (() => {
            return {
                stub: {
                    aggregate: (result) => {
                        let fn = () => (result);

                        fn = typeof result === 'function' ? result : fn;

                        const defaultFn = (() => ({ toArray: () => (Q.fcall(fn)) }));

                        stub(db.milestones, 'aggregate', defaultFn);
                    },
                    findOne: (result) => {
                        let fn = () => (result);

                        fn = typeof result === 'function' ? result : fn;
                        
                        const defaultFn = (() => (Q.fcall(fn)));

                        stub(db.milestones, 'findOne', defaultFn);
                    }
                },
                insertOne: (obj) => (Q.fcall(() => (obj))),
                findOne: (id) => (Q.fcall(() => (milestone))),
                aggregate: (pipeline) => ({ toArray: () => (Q.fcall(() => [])) }),
                findOneAndUpdate: (query, update) => {
                    return Q.fcall(() => {
                        if (Object.keys(query).length > 1) {
                            let correctIndex = 0;

                            const attemptId = query['report._id'].toString();

                            milestone.report.forEach((attempt, index) => {
                                if (attempt._id.toString() == attemptId) {
                                    correctIndex = index;

                                    return false;
                                }
                            });

                            for (var key in update.$set) {
                                if (key.indexOf('$') == -1) {
                                    continue;
                                }

                                const newKey = key.replace('$', correctIndex.toString());

                                update.$set[newKey] = update.$set[key];

                                delete update.$set[key];
                            }
                        }

                        if (update.$set) {
                            for (let key in update.$set) {
                                robot.walkPath(milestone, key, update.$set[key]);
                            }
                        }

                        if (update.$push) {
                            for (let key in update.$push) {
                                const arr = robot.walkPath(milestone, key);

                                arr.unshift(update.$push[key].$each[0]);
                            }
                        }

                        return { value: milestone };
                    });
                }
            };
        })();
    });
    
    afterEach(() => {
        if (db.milestones.findOne.restore) {
            db.milestones.findOne.restore();
        }
        
        if (db.milestones.aggregate.restore) {
            db.milestones.aggregate.restore();
        }        
    });

    describe("Utility", () => {
        describe('Walk path', () => {
            it('Can traverse a deeply nested object, without including arrays', () => {
                const obj = { a: { b: { c: { d: { e: 1 } } } } };

                const result = robot.walkPath(obj, 'a.b.c.d.e');

                result.should.be.equal(1);
            });

            it('Can traverse a deeply nested object, including arrays', () => {
                const obj = { a: { b: { c: [{ a: { a: 1, b: 2 } }, { a: { a: 2, b: 4 } }, { a: { a: 4, b: 16 } }] } } };

                const result = robot.walkPath(obj, 'a.b.c.2.a.b');

                result.should.be.equal(16);
            });

            it('Can set a value within the nested object', () => {
                const obj = { a: { b: { c: [{ a: { a: 1, b: 2 } }, { a: { a: 2, b: 4 } }, { a: { a: 4, b: 16 } }] } } };

                const result = robot.walkPath(obj, 'a.b.c.2.a.b', 'TESTE');

                result.should.be.equal('TESTE');
                expect(obj.a.b.c[2].a.b).to.be.equal('TESTE');
            });
        });
    });

    describe("DAL", () => {
        describe("Create Milestone", () => {
            it("Can't create a stored milestone from a random object", (done) => {
                let counter = 0;

                const validate = (e) => {
                    expect(e).not.to.be.null;
                    expect(e.message).to.be.equal(robot.INVALID_MILESTONE);

                    expect(counter).to.be.equal(1);

                    done();
                };

                Q.spawn(function* () {
                    try {
                        yield robot.createMilestone({ a: 1 });
                    }
                    catch (e) {
                        counter++;

                        validate(e);
                    }
                });
            });

            it("Can create a stored milestone from a Milestone object", (done) => {
                const milestone = milestoneFactory();

                Q.spawn(function* () {
                    const result = yield robot.createMilestone(milestone);

                    expect(result).to.have.property('type', 'bank-transfer');
                    expect(result.action).to.have.property('type', 'do-debit');
                    expect(result.action).to.have.property('method', 'do-debit');

                    done();
                });
            });
        });

        describe("Start Milestone", () => {//
            it("Can start a milestone using a valid milestone id", (done) => {
                milestone = milestoneFactory();

                stub(robot, 'runAction', () => (Q.fcall(() => ({ ok: true }))));

                stub(robot, 'endMilestone', () => (Q.fcall(() => (milestone))));

                db.milestones.stub.findOne(() => (milestone));

                Q.spawn(function* () {
                    const milestone = yield robot.startMilestone('valid-milestone-id');

                    expect(milestone).to.be.deep.equal(milestone);

                    robot.runAction.restore();
                    robot.endMilestone.restore();

                    done();
                });
            });

            it("Can't start a milestone using an invalid milestone id", (done) => {
                milestone = milestoneFactory();

                let counter = 0;

                db.milestones.stub.findOne(() => (null));

                const validate = (e) => {
                    expect(counter).to.be.equal(1);
                    expect(e instanceof Error).to.be.true;
                    expect(e.message).to.be.equal(robot.MILESTONE_NOT_FOUND);

                    done();
                };

                Q.spawn(function* () {
                    try {
                        const milestone = yield robot.startMilestone('invalid-milestone-id');
                    }
                    catch (e) {
                        counter++;

                        validate(e);
                    }
                });
            });
        });

        describe("End Milestone", () => {
            it("Should send finish update to the database", (done) => {
                milestone = milestoneFactory();

                milestone.state = true;
                milestone.endDate = new Date();

                Q.spawn(function* () {
                    const result = yield robot.endMilestone(milestone._id, true);

                    expect(result).to.be.deep.equal(milestone);

                    done();
                });
            });
        });
    });

    describe("Milestone lifecycle", () => {
        beforeEach(() => {
            bank = {
                a: {
                    balance: 10000,
                    account: [{ desc: 'initial value', amount: 10000 }]
                },
                b: {
                    balance: 10000,
                    account: [{ desc: 'initial value', amount: 10000 }]
                }
            }

            register({
                name: 'do-debit',
                fn: (parameters) => {
                    return Q.fcall(() => {
                        bank[parameters.milestone.from].account.push({ desc: `Transfer to ${parameters.milestone.to}`, amount: parameters.milestone.amount * -1 });

                        return { ok: true, unsavedNewBalance: bank[parameters.milestone.from].balance - parameters.milestone.amount };
                    });
                }
            });

            register({
                name: 'do-credit',
                fn: (parameters) => {
                    return Q.fcall(() => {
                        bank[parameters.milestone.to].account.push({ desc: `Transfer from ${parameters.milestone.from}`, amount: parameters.milestone.amount });

                        return { ok: true, unsavedNewBalance: bank[parameters.milestone.to].balance + parameters.milestone.amount };
                    });
                }
            });

            register({
                name: 'confirm-transfer',
                fn: (parameters) => {
                    return Q.fcall(() => {
                        bank[parameters.milestone.from].confirmed = true;

                        return { ok: true, unsavedNewBalance: parameters['do-debit'].unsavedNewBalance };
                    });
                }
            });

            register({
                name: 'update-balances',
                fn: (parameters) => {
                    return Q.fcall(() => {
                        bank[parameters.milestone.to].balance = bank[parameters.milestone.to].account.reduce((total, item) => (total + item.amount), 0);
                        bank[parameters.milestone.from].balance = bank[parameters.milestone.from].account.reduce((total, item) => (total + item.amount), 0);

                        return { ok: true, savedBalances: { from: bank[parameters.milestone.from].balance, to: bank[parameters.milestone.to].balance } };
                    });
                }
            });
        });

        const milestoneParams = { milestone: { from: 'a', to: 'b', amount: 1000 } };
        const doDebitInput = milestoneParams;
        const doDebitOutput = { ok: true, unsavedNewBalance: 9000 };
        const doCreditInput = Object.assign({}, milestoneParams, { 'do-debit': doDebitOutput });
        const doCreditOutput = { ok: true, unsavedNewBalance: 11000 };
        const confirmTransferInput = doCreditInput;
        const confirmTransferOutput = { ok: true, unsavedNewBalance: 9000 };
        const updateBalancesInput = Object.assign({}, milestoneParams, { 'do-debit': doDebitOutput, 'do-credit': doCreditOutput, 'confirm-transfer': confirmTransferOutput });
        const updateBalancesOutput = { ok: true, savedBalances: { from: 9000, to: 11000 } };

        const validateStructure = (result) => {
            expect(result).not.to.be.null;
            expect(result.state).to.be.true;
            expect(result.beginDate).to.be.a('date');
            expect(result.endDate).to.be.a('date');

            expect(result.action.state).to.be.equal(true);
            expect(result.action.report[0].input).to.be.deep.equal(doDebitInput);
            expect(result.action.report[0].output).to.be.deep.equal(doDebitOutput);

            expect(result.action.next.length).to.be.equal(2);
            expect(result.action.next.filter(t => t.state == true).length).to.be.equal(2);

            expect(result.action.next[0].state).to.be.equal(true);
            expect(result.action.next[0].report[0].input).to.be.deep.equal(doCreditInput);
            expect(result.action.next[0].report[0].output).to.be.deep.equal(doCreditOutput);
            expect(result.action.next[1].state).to.be.equal(true);
            expect(result.action.next[1].report[0].input).to.be.deep.equal(confirmTransferInput);
            expect(result.action.next[1].report[0].output).to.be.deep.equal(confirmTransferOutput);

            expect(result.action.done.state).to.be.equal(true);
            expect(result.action.done.report[0].input).to.be.deep.equal(updateBalancesInput);
            expect(result.action.done.report[0].output).to.be.deep.equal(updateBalancesOutput);

            expect(bank.a.balance).to.be.equal(9000);
            expect(bank.a.account.length).to.be.equal(2);
            expect(bank.a.account.reduce((a, b) => (a + b.amount), 0)).to.be.equal(9000);
            expect(bank.b.balance).to.be.equal(11000);
            expect(bank.b.account.length).to.be.equal(2);
            expect(bank.b.account.reduce((a, b) => (a + b.amount), 0)).to.be.equal(11000);
        };

        it("Can run a Milestone from beggining to end", (done) => {
            Q.spawn(function* () {
                milestone = milestoneFactory();

                yield robot.createMilestone(milestone);

                const result = yield robot.startMilestone(milestone._id);

                validateStructure(result);

                expect(result.report.length).to.be.equal(4);
                expect(result.report.filter(t => t.success).length).to.be.equal(4);
                expect(result.action.report.length).to.be.equal(1);

                expect(result.action.next.filter(t => t.report.filter(u => u.success).length == 1).length).to.be.equal(2);

                expect(result.action.done.report.length).to.be.equal(1);

                done();
            });
        });

        it("Can pick up a Milestone with an explicitly failed root action and run it to the end", (done) => {
            Q.spawn(function* () {
                milestone = milestoneFactory();

                const attempt = {
                    _id: new ObjectId(),
                    success: false,
                    beginDate: new Date(),
                    endDate: new Date(),
                    input: doDebitInput,
                    output: serializeError(new Error('Something went wrong'))
                };

                milestone.action.report.push(attempt);
                milestone.report.push(Object.assign({ name: 'do-debit' }, attempt));

                yield robot.createMilestone(milestone);

                const result = yield robot.startMilestone(milestone._id);

                validateStructure(result);

                expect(result.report.length).to.be.equal(5);
                expect(result.report.filter(t => t.success).length).to.be.equal(4);
                expect(result.action.report.length).to.be.equal(2);
                expect(result.action.report[0].success).to.be.equal(true);
                expect(result.action.report[1].success).to.be.equal(false);

                expect(result.action.next.filter(t => t.report.filter(u => u.success).length == 1).length).to.be.equal(2);

                expect(result.action.done.report.length).to.be.equal(1);

                done();
            });
        });

        it("Can pick up a Milestone with an abandoned root action and run it to the end", (done) => {
            Q.spawn(function* () {
                milestone = milestoneFactory();

                const attempt = {
                    _id: new ObjectId(),
                    success: null,
                    beginDate: moment().subtract(getConfig(RETRY_TIMESPAN) + 1, 'minutes').toDate(),
                    endDate: null,
                    input: doDebitInput,
                    output: null
                };

                milestone.action.report.push(attempt);
                milestone.report.push(Object.assign({ name: 'do-debit' }, attempt));

                yield robot.createMilestone(milestone);

                const result = yield robot.startMilestone(milestone._id);

                validateStructure(result);

                expect(result.report.length).to.be.equal(5);
                expect(result.report.filter(t => t.success).length).to.be.equal(4);
                expect(result.action.report.length).to.be.equal(2);
                expect(result.action.report[0].success).to.be.equal(true);
                expect(result.action.report[1].success).to.be.equal(null);

                expect(result.action.next.filter(t => t.report.filter(u => u.success).length == 1).length).to.be.equal(2);

                expect(result.action.done.report.length).to.be.equal(1);

                done();
            });
        });

        it("Can pick up a Milestone with an explicitly failed  middle action and run it to the end", (done) => {
            milestone = milestoneFactory();

            Q.spawn(function* () {
                const doDebitAttempt = {
                    _id: new ObjectId(),
                    success: true,
                    beginDate: new Date(),
                    endDate: new Date(),
                    input: doDebitInput,
                    output: doDebitOutput
                };

                const doCreditAtempt = {
                    _id: new ObjectId(),
                    success: false,
                    beginDate: new Date(),
                    endDate: new Date(),
                    input: doCreditInput,
                    output: serializeError(new Error('Something went wrong'))
                };

                const confirmTransferAttempt = {
                    _id: new ObjectId(),
                    success: true,
                    beginDate: new Date(),
                    endDate: new Date(),
                    input: confirmTransferInput,
                    output: confirmTransferOutput
                };

                milestone.action.state = true;
                milestone.beginDate = new Date();
                milestone.action.report.push(doDebitAttempt);

                milestone.action.next[0].report.push(doCreditAtempt);
                milestone.action.next[1].state = true;
                milestone.action.next[1].report.push(confirmTransferAttempt);

                milestone.report.unshift(Object.assign({ name: 'do-debit' }, doDebitAttempt));
                milestone.report.unshift(Object.assign({ name: 'do-credit' }, doCreditAtempt));
                milestone.report.unshift(Object.assign({ name: 'confirm-transfer' }, confirmTransferAttempt));

                bank.a.account.push({ desc: `Transfer to b`, amount: -1000 });
                bank.a.balance = 9000;

                yield robot.createMilestone(milestone);

                const result = yield robot.startMilestone(milestone._id);

                validateStructure(result);

                expect(result.report.length).to.be.equal(5);
                expect(result.report.filter(t => t.success).length).to.be.equal(4);
                expect(result.action.report.length).to.be.equal(1);
                expect(result.action.report[0].success).to.be.equal(true);

                expect(result.action.next[0].report.length).to.be.equal(2);
                expect(result.action.next[0].report[0].success).to.be.equal(true);
                expect(result.action.next[0].report[1].success).to.be.equal(false);

                expect(result.action.next.filter(t => !!t.report.find(u => u.success)).length).to.be.equal(2);

                expect(result.action.done.report.length).to.be.equal(1);

                done();
            });
        });

        it("Can pick up a Milestone with an abandoned middle action and run it to the end", (done) => {
            milestone = milestoneFactory();

            Q.spawn(function* () {
                const doDebitAttempt = {
                    _id: new ObjectId(),
                    success: true,
                    beginDate: new Date(),
                    endDate: new Date(),
                    input: doDebitInput,
                    output: doDebitOutput
                };

                const doCreditAtempt = {
                    _id: new ObjectId(),
                    success: null,
                    beginDate: moment().subtract(getConfig(RETRY_TIMESPAN) + 1, 'minutes').toDate(),
                    endDate: null,
                    input: doCreditInput,
                    output: null
                };

                const confirmTransferAttempt = {
                    _id: new ObjectId(),
                    success: true,
                    beginDate: new Date(),
                    endDate: new Date(),
                    input: confirmTransferInput,
                    output: confirmTransferOutput
                };

                milestone.action.state = true;
                milestone.beginDate = new Date();
                milestone.action.report.push(doDebitAttempt);

                milestone.action.next[0].report.push(doCreditAtempt);
                milestone.action.next[1].state = true;
                milestone.action.next[1].report.push(confirmTransferAttempt);

                milestone.report.unshift(Object.assign({ name: 'do-debit' }, doDebitAttempt));
                milestone.report.unshift(Object.assign({ name: 'do-credit' }, doCreditAtempt));
                milestone.report.unshift(Object.assign({ name: 'confirm-transfer' }, confirmTransferAttempt));

                bank.a.account.push({ desc: `Transfer to b`, amount: -1000 });
                bank.a.balance = 9000;

                yield robot.createMilestone(milestone);

                const result = yield robot.startMilestone(milestone._id);

                validateStructure(result);

                expect(result.report.length).to.be.equal(5);
                expect(result.report.filter(t => t.success).length).to.be.equal(4);
                expect(result.action.report.length).to.be.equal(1);
                expect(result.action.report[0].success).to.be.equal(true);

                expect(result.action.next[0].report.length).to.be.equal(2);
                expect(result.action.next[0].report[0].success).to.be.equal(true);
                expect(result.action.next[0].report[1].success).to.be.equal(null);

                expect(result.action.next.filter(t => !!t.report.find(u => u.success)).length).to.be.equal(2);

                expect(result.action.done.report.length).to.be.equal(1);

                done();
            });
        });

        it("Can pick up a Milestone with an abandoned middle action and prevent further actions from running before the retry timespan is passed", (done) => {
            milestone = milestoneFactory();

            Q.spawn(function* () {
                const doDebitAttempt = {
                    _id: new ObjectId(),
                    success: true,
                    beginDate: new Date(),
                    endDate: new Date(),
                    input: doDebitInput,
                    output: doDebitOutput
                };

                const doCreditAtempt = {
                    _id: new ObjectId(),
                    success: null,
                    beginDate: moment().subtract(getConfig(RETRY_TIMESPAN) - 1, 'minutes').toDate(),
                    endDate: null,
                    input: doCreditInput,
                    output: null
                };

                const confirmTransferAttempt = {
                    _id: new ObjectId(),
                    success: true,
                    beginDate: new Date(),
                    endDate: new Date(),
                    input: confirmTransferInput,
                    output: confirmTransferOutput
                };

                milestone.action.state = true;
                milestone.beginDate = new Date();
                milestone.action.report.push(doDebitAttempt);

                milestone.action.next[0].report.push(doCreditAtempt);
                milestone.action.next[1].state = true;
                milestone.action.next[1].report.push(confirmTransferAttempt);

                milestone.report.unshift(Object.assign({ name: 'do-debit' }, doDebitAttempt));
                milestone.report.unshift(Object.assign({ name: 'do-credit' }, doCreditAtempt));
                milestone.report.unshift(Object.assign({ name: 'confirm-transfer' }, confirmTransferAttempt));

                bank.a.account.push({ desc: `Transfer to b`, amount: -1000 });
                bank.a.balance = 9000;

                yield robot.createMilestone(milestone);

                const validate = (e) => {
                    expect(e instanceof Error).to.be.equal(true);
                    expect(e.message).to.be.equal(robot.ACTION_NOT_READY('do-credit'));

                    expect(milestone.action.next[0].report.length).to.be.equal(1);
                    expect(milestone.action.next[0].report[0].beginDate instanceof Date).to.be.equal(true);
                    expect(milestone.action.next[0].report[0].endDate).to.be.null;
                    expect(milestone.action.next[0].report[0].input).to.be.deep.equal(doCreditInput);
                    expect(milestone.action.next[0].report[0].output).to.be.null;
                    expect(milestone.action.next[0].state).to.be.equal(false);

                    expect(milestone.action.done.state).to.be.equal(false);
                    expect(milestone.action.done.report.length).to.be.equal(0);

                    done();
                };

                try {
                    const result = yield robot.startMilestone(milestone._id);
                }
                catch (e) {
                    validate(e);
                }
            });
        });
    });

    describe("Run", () => {
        let allMilestones;

        const milestonesFactory = () => {
            const f = () => { return new Milestone({ type: 'a', action: new Action({ type: 'b', method: 'c' }) }) };

            return [f(), f(), f(), f(), f()];
        };

        beforeEach(() => {
            allMilestones = milestonesFactory();

            db.milestones.stub.aggregate(allMilestones);

            stub(robot, 'startMilestone', (id) => {
                if (id.shouldReject) {
                    return Q.fcall(() => { throw new Error('Something went wrong') });
                }
                else {
                    return Q.fcall(() => ({ ok: true }));
                }
            });
        });

        afterEach(() => {
            robot.startMilestone.restore();
            db.milestones.aggregate.restore();
        });

        it('Can react to all of the Milestones being resolved', (done) => {
            allMilestones.forEach(milestone => { milestone._id = { shouldReject: false } });

            Q.spawn(function* () {
                const result = yield robot.run();

                expect(result.found.length).to.be.equal(5);
                expect(result.resolved.length).to.be.equal(5);
                expect(result.rejected.length).to.be.equal(0);

                done();
            });
        });

        it('Can react to all of the Milestones being rejected', (done) => {
            allMilestones.forEach(milestone => { milestone._id = { shouldReject: true } });

            Q.spawn(function* () {
                const result = yield robot.run();

                expect(result.found.length).to.be.equal(5);
                expect(result.resolved.length).to.be.equal(0);
                expect(result.rejected.length).to.be.equal(5);

                done();
            });
        });

        it('Can react to some of the Milestones being rejected', (done) => {
            allMilestones.forEach((milestone, index) => { milestone._id = { shouldReject: index < 3 } });

            Q.spawn(function* () {
                const result = yield robot.run();

                expect(result.found.length).to.be.equal(5);
                expect(result.resolved.length).to.be.equal(2);
                expect(result.rejected.length).to.be.equal(3);

                done();
            });
        });

        it(`Can work event if there are no pending Milestones`, (done) => {
            Q.spawn(function* () {
                allMilestones = [];
                
                db.milestones.aggregate.restore();
                
                db.milestones.stub.aggregate(() => ([]));
                
                const result = yield robot.run();

                expect(result.found.length).to.be.equal(0);
                expect(result.resolved.length).to.be.equal(0);
                expect(result.rejected.length).to.be.equal(0);

                done();
            });
        });
    });
});