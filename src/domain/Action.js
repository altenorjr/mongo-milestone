export const TYPE_REQUIRED = 'The action type is required';
export const METHOD_OR_NEXT_REQUIRED = 'You must pass either a registered Method Name or an Action Array with more than one item';
export const NEXT_ACTIONS_REQUIRED = 'All items in "next" must be Actions';
export const DONE_REQUIRED = 'The "done" action must be an Action if not empty';
export const PARAMETERS_EXPECTED = 'A configuration object { type, method = type, next = [], done = null } is expected'

export default class Action {
    constructor(...params) {
        const setup = ({ type, method = type, next = [], done = null }) => {
            if (!type) {
                throw new Error(TYPE_REQUIRED);
            }

            if (next instanceof Action) {
                next = [next];
            }

            if (!method && (!Array.isArray(next) || next.length === 0)) {
                throw new Error(METHOD_OR_NEXT_REQUIRED);
            }

            next = next.map((action) => (typeof action === 'string' ? new Action(action) : action));

            if (next.filter(t => !(t instanceof Action)).length) {
                throw new Error(NEXT_ACTIONS_REQUIRED);
            }

            if (typeof done === 'string') {
                done = new Action(done);
            }

            if (!!done && !(done instanceof Action)) {
                throw new Error(DONE_REQUIRED);
            }

            if (typeof next === 'function') {
                next = next();

                if (!Array.isArray(next)) {
                    next = []
                }
                else {
                    next = next.map(t => typeof t === 'string' ? new Action(t) : t).filter(t => t instanceof Action);
                }
            }
            else {
                if (Array.isArray(next)) {
                    next = next.map(t => typeof t === 'string' ? new Action(t) : t).filter(t => t instanceof Action);
                }
                else {
                    next = (next instanceof Action) ? [next] : []
                }
            }

            this.type = type;
            this.method = method;
            this.state = method ? false : true;
            this.next = next;
            this.done = done || null;
            this.report = [];
        };

        switch (params.length) {
            case 0: {
                throw new Error(PARAMETERS_EXPECTED);
            }
            case 1: {
                const [param] = params;

                if (typeof param === 'object') {
                    setup.apply(null, params);
                }
                else if (typeof param === 'string') {
                    setup({ type: param });
                }
                break;
            }
            case 2: {
                let [type, next] = params;
                setup({ type, next });
            }
            case 3: {
                const [type, next, done] = params;

                setup({ type, next, done });
                break;
            }
            default: {
                const [{ type, method, next, done }] = params;

                setup({ type, method, next, done });
            }
        }
    }
}