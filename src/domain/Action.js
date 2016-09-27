export const TYPE_REQUIRED = 'The action type is required';
export const METHOD_OR_NEXT_REQUIRED = 'You must pass either a registered Method Name or an Action Array with more than one item';
export const NEXT_ACTIONS_REQUIRED = 'All items in "next" must be Actions';
export const DONE_REQUIRED = 'The "done" action must be an Action if not empty';

export default class Action {
    constructor({ type, method = type, next = [], done = null }) {
        if (!type) {
            throw new Error(TYPE_REQUIRED);
        }

        if (next instanceof Action) {
            next = [next];
        }

        if (!method && (!Array.isArray(next) || next.length === 0)) {
            throw new Error(METHOD_OR_NEXT_REQUIRED);
        }

        if (next.filter(t => !(t instanceof Action)).length) {
            throw new Error(NEXT_ACTIONS_REQUIRED);
        }

        if (!!done && !(done instanceof Action)) {
            throw new Error(DONE_REQUIRED);
        }

        this.type = type;
        this.method = method;
        this.state = method ? false : true;
        this.next = Array.isArray(next) ? next : (typeof next == 'Action' ? [next] : []);
        this.done = done || null;
        this.report = [];
    }
}