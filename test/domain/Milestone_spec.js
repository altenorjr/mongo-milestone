import { expect } from 'chai';
import { ObjectId } from 'mongodb';

import Milestone, { ACTION_REQUIRED, TYPE_REQUIRED } from '../../src/domain/Milestone';
import Action from '../../src/domain/Action';

describe('Milestone', () => {
    it("Can't be instantiated without a proper type parameter", () => {
        const fn1 = () => { return new Milestone() };
        const fn2 = () => { return new Milestone({}) };

        expect(fn1).to.throw(Error);
        expect(fn2).to.throw(Error, TYPE_REQUIRED);
    });

    it("Can't be instantiated with a type parameter but without an Action", () => {
        const fn = () => { return new Milestone({ type: 'a' }) };

        expect(fn).to.throw(Error, ACTION_REQUIRED);
    });

    it("Can't be instantiated with a type parameter and with an invalid action", () => {
        const action1 = { name: 'action-name', method: 'method-name' };
        const action2 = {};
        const action3 = null;
        const action4 = undefined;
        const action5 = NaN;
        const action6 = Infinity;

        const fn1 = () => { return new Milestone({ type: 'a', action: action1 }) };
        const fn2 = () => { return new Milestone({ type: 'a', action: action2 }) };
        const fn3 = () => { return new Milestone({ type: 'a', action: action3 }) };
        const fn4 = () => { return new Milestone({ type: 'a', action: action4 }) };
        const fn5 = () => { return new Milestone({ type: 'a', action: action5 }) };
        const fn6 = () => { return new Milestone({ type: 'a', action: action6 }) };

        expect(fn1).to.throw(Error, ACTION_REQUIRED);
        expect(fn2).to.throw(Error, ACTION_REQUIRED);
        expect(fn3).to.throw(Error, ACTION_REQUIRED);
        expect(fn4).to.throw(Error, ACTION_REQUIRED);
        expect(fn5).to.throw(Error, ACTION_REQUIRED);
        expect(fn6).to.throw(Error, ACTION_REQUIRED);
    });

    it("Can be instantiated with a type parameter, a valid root Action and no parameters", () => {
        let milestone;

        const action = new Action({ type: 'a' });

        const fn = () => { milestone = new Milestone({ type: 'a', action }) };

        expect(fn).to.not.throw();

        milestone.save();

        expect(milestone).not.to.be.null;
        expect(ObjectId.isValid(milestone._id)).to.be.equal(true);
        expect(milestone.beginDate instanceof Date).to.be.equal(true);
        expect(milestone.endDate).to.be.null;
        milestone.should.have.property('type', 'a');
        milestone.should.have.property('parameters', undefined);
        expect(milestone.action).to.be.deep.equal(action);
    });

    it("Can be instantiated with a type parameter, a valid root Action and random parameters", () => {
        let milestone;

        const action = new Action({ type: 'a' });

        const fn = () => { milestone = new Milestone({ type: 'a', action, parameters: 'asd' }) };

        expect(fn).to.not.throw();

        expect(milestone).not.to.be.null;
        expect(ObjectId.isValid(milestone._id)).to.be.equal(true);
        expect(milestone.beginDate instanceof Date).to.be.equal(true);
        expect(milestone.endDate).to.be.null;
        milestone.should.have.property('type', 'a');
        milestone.should.have.property('parameters', 'asd');
        expect(milestone.action).to.be.deep.equal(action);
    });
});