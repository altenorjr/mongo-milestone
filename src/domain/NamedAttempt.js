import Attempt from './Attempt';

export const NAME_REQUIRED = 'A Named Attempt must have a name';

export default class NamedAttempt extends Attempt {
    constructor(actionName, parameters) {
        super(parameters);
        
        this.actionName = actionName;

        if (!actionName) {
            throw new Error(NAME_REQUIRED);
        }
    }

    toAttempt() {
        return new Attempt(this.parameters);
    }
}