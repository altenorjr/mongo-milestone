import { expect } from 'chai';

import Event, { TYPE_REQUIRED } from '../../src/domain/Event';

describe('Event', () => {
    it("Can't be instantiated without a proper type parameter", () => {
        const fn = () => { return new Event() };
        
        expect(fn).to.throw(Error, TYPE_REQUIRED);
    });
    
    it("Can be instantiated with a type parameter and no additional parameters", () => {
        let event;
        
        const fn = () => { event = new Event('event-type') };
        
        expect(fn).to.not.throw();
        
        expect(event).not.to.be.null;
        event.should.have.property('type', 'event-type');
        event.should.have.property('parameters', undefined);
    });
    
    it("Can be instantiated with a type parameter and additional parameters", () => {
        let event;
        
        const fn = () => { event = new Event('event-type', 'asd') };
        
        expect(fn).to.not.throw();
        
        expect(event).not.to.be.null;
        event.should.have.property('type', 'event-type');
        event.should.have.property('parameters', 'asd');
    });    
});