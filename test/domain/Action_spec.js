import { expect } from 'chai';

import Action, * as msg from '../../src/domain/Action';

describe('Action', () => {
    it("Can't be instantiated without an Action name", () => {
        const fn = () => { return new Action() };

        expect(fn).to.throw(Error, msg.NAME_REQUIRED);
    });

    it("Can be instantiated with only an Action name", () => {
        let action;

        const fn = () => { action = new Action({ type: 'a' }) };

        expect(fn).not.to.throw(Error, msg.METHOD_OR_NEXT_REQUIRED);

        expect(action).not.to.be.null;
        action.should.have.property('type', 'a');
        action.should.have.property('method', 'a');
        action.should.have.property('state', false);
        expect(action.next).to.have.property('length', 0);
        expect(action.done).to.be.null;
        expect(action.report).to.have.property('length', 0);
    });

    it("Can be instantiated with only an Action name and a Method name", () => {
        let action;

        const fn = () => { action = new Action({ type: 'a', method: 'b' }) };

        expect(fn).not.to.throw(Error);

        expect(action).not.to.be.null;
        action.should.have.property('type', 'a');
        action.should.have.property('method', 'b');
        action.should.have.property('state', false);
        expect(action.next).to.have.property('length', 0);
        expect(action.done).to.be.null;
        expect(action.report).to.have.property('length', 0);
    });

    it("Can be instantiated with a method name and one next action as a standalone parameter that is an Action prototype", () => {
        let action;

        const nextAction = new Action({ type: 'c' })

        const fn = () => { action = new Action({ type: 'a', method: 'b', next: nextAction }) };

        expect(fn).not.to.throw(Error);

        expect(action).not.to.be.null;
        action.should.have.property('type', 'a');
        action.should.have.property('method', 'b');
        action.should.have.property('state', false);
        expect(action.done).to.be.null;
        expect(action.report).to.have.property('length', 0);
        expect(action.next).to.have.property('length', 1);
        expect(action.next[0]).to.deep.equal(nextAction);
    });

    it("Can be instantiated with a method name and one next action as an array parameter that is an Action prototype", () => {
        let action;

        const nextAction = new Action({ type: 'c' })

        const fn = () => { action = new Action({ type: 'a', method: 'b', next: [nextAction] }) };

        expect(fn).not.to.throw(Error);

        expect(action).not.to.be.null;
        action.should.have.property('type', 'a');
        action.should.have.property('method', 'b');
        action.should.have.property('state', false);
        expect(action.done).to.be.null;
        expect(action.report).to.have.property('length', 0);
        expect(action.next).to.have.property('length', 1);
        expect(action.next[0]).to.deep.equal(nextAction);
    });

    it("Can't be instantiated with no method name and one next action as a standalone parameter that is not an Action prototype", () => {
        const nextAction = { name: 'a', method: 'b', next: [] };

        let action;

        const fn = () => { action = new Action({ type: 'a', method: null, next: nextAction }) };

        expect(fn).to.throw(Error, msg.METHOD_OR_NEXT_REQUIRED);
    });

    it("Can't be instantiated with no method name and one next action as an array parameter that is not an Action prototype", () => {
        const nextAction = { name: 'a', method: 'b', next: [] };

        let action;

        const fn = () => { action = new Action({ type: 'a', method: null, next: nextAction }) };

        expect(fn).to.throw(Error, msg.METHOD_OR_NEXT_REQUIRED);
    });

    it("Can be instantiated with no method name and multiple next actions as an array parameter in which every element is an Action prototype", () => {
        let action;

        const firstAction = new Action({ type: 'a' });
        const secondAction = new Action({ type: 'b' });

        const fn = () => { action = new Action({ type: 'a', method: null, next: [firstAction, secondAction] }) };

        expect(fn).not.to.throw(Error);

        expect(action).not.to.be.null;
        action.should.have.property('type', 'a');
        action.should.have.property('method', null);
        action.should.have.property('state', true);
        expect(action.done).to.be.null;
        expect(action.report).to.have.property('length', 0);
        expect(action.next).to.have.property('length', 2);
        expect(action.next[0]).to.deep.equal(firstAction);
        expect(action.next[1]).to.deep.equal(secondAction);
    });

    it("Can't be instantiated with no method name and multiple next actions as an array parameter in which not every element is an Action prototype", () => {
        const firstAction = new Action({ type: 'a' });
        const secondAction = { name: 'b', method: 'b', next: [] };

        const fn1 = () => { return new Action({ type: 'a', method: null, next: [firstAction, secondAction] }) };
        const fn2 = () => { return new Action({ type: 'a', method: null, next: [firstAction, null] }) };
        const fn3 = () => { return new Action({ type: 'a', method: null, next: [undefined, null] }) };
        const fn4 = () => { return new Action({ type: 'a', method: null, next: [Infinity, NaN] }) };

        expect(fn1).to.throw(Error, msg.NEXT_ACTIONS_REQUIRED);
        expect(fn2).to.throw(Error, msg.NEXT_ACTIONS_REQUIRED);
        expect(fn3).to.throw(Error, msg.NEXT_ACTIONS_REQUIRED);
        expect(fn4).to.throw(Error, msg.NEXT_ACTIONS_REQUIRED);
    });
});