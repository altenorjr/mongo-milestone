import Q from 'q';
import { expect } from 'chai';

import * as dispatcher from '../src/dispatcher';

describe("Dispatcher", () => {
    describe("Register", () => {
        it("Can register a method", (done) => {
            let counter = 0;

            dispatcher.register({
                name: 'testMethod',
                fn: (parameters) => {
                    counter++;

                    return Q.fcall(() => ({ a: parameters.a + 10 }));
                }
            });

            Q.spawn(function* () {
                const result = yield dispatcher.dispatch('testMethod', { a: 10 });

                expect(counter).to.be.equal(1);
                expect(result.a).to.be.equal(20);

                done();
            });
        });
    });
}); 