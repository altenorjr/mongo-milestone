export const TYPE_REQUIRED = 'The Event type is required';

export default class Event {
    constructor(type, parameters) {
        if (!type) {
            throw new Error(TYPE_REQUIRED);
        }

        this.type = type;
        this.parameters = parameters;
    }
}