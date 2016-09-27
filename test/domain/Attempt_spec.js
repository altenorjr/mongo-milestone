import { expect } from 'chai';
import { ObjectId } from 'mongodb';

import Attempt from '../../src/domain/Attempt';
import NamedAttempt, { NAME_REQUIRED } from '../../src/domain/NamedAttempt';

describe('Attempt', () => {
    it('Can be instantiated without parameters', () => {
        const attempt = new Attempt();

        expect(ObjectId.isValid(attempt._id)).to.be.equal(true);
        expect(attempt.beginDate).not.to.be.null;
        expect(attempt.endDate).to.be.null;
        expect(attempt.input).to.be.undefined;
        expect(attempt.success).to.be.null;
        expect(attempt.output).to.be.null;
    });

    it('Can be instantiated with parameters', () => {
        const attempt = new Attempt('asd');

        expect(ObjectId.isValid(attempt._id)).to.be.equal(true);
        expect(attempt.beginDate).not.to.be.null;
        expect(attempt.endDate).to.be.null;
        expect(attempt.input).to.be.equal('asd');
        expect(attempt.success).to.be.null;
        expect(attempt.output).to.be.null;
    });
});

describe('Named Attempt', () => {
    it("Can't be instantiated without parameters", () => {
        const fn = () => { return new NamedAttempt() };

        expect(fn).to.throw(Error, NAME_REQUIRED);
    });

    it("Can be instantiated with only a name", () => {
        let attempt;

        const fn = () => { attempt = new NamedAttempt('action-name') };

        // console.log(attempt);

        expect(fn).to.not.throw(Error);

        expect(attempt).not.to.be.null;

        expect(ObjectId.isValid(attempt._id)).to.be.equal(true);
        expect(attempt.actionName).to.be.equal('action-name');
        expect(attempt.beginDate).not.to.be.null;
        expect(attempt.endDate).to.be.null;
        expect(attempt.input).to.be.undefined;
        expect(attempt.success).to.be.null;
        expect(attempt.output).to.be.null;
    });

    it("Can be instantiated with a name and random parameters", () => {
        let attempt;

        const fn = () => { attempt = new NamedAttempt('action-name', 'asd') };

        // console.log(attempt);

        expect(fn).to.not.throw(Error);

        expect(attempt).not.to.be.null;

        expect(ObjectId.isValid(attempt._id)).to.be.equal(true);
        expect(attempt.actionName).to.be.equal('action-name');
        expect(attempt.beginDate).not.to.be.null;
        expect(attempt.endDate).to.be.null;
        expect(attempt.input).to.be.equal('asd');
        expect(attempt.success).to.be.null;
        expect(attempt.output).to.be.null;
    });
});