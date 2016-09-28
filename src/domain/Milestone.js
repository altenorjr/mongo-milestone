import Q from 'q';
import { ObjectId } from 'mongodb';

import Action from './Action';
import robot from '../robot';

export const TYPE_REQUIRED = 'The Milestone type is required';
export const ACTION_REQUIRED = 'The Miletone root Action must be an Action';
export const PARAMETERS_EXPECTED = 'A configuration object { type, action, parameters } is expected';

class Milestone {
    constructor(...params) {
        const setup = ({ type, action, parameters }) => {
            if (!type) {
                throw new Error(TYPE_REQUIRED);
            }

            if (!(action instanceof Action)) {
                throw new Error(ACTION_REQUIRED);
            }

            this._id = new ObjectId();
            this.type = type;
            this.action = action;
            this.beginDate = new Date();
            this.endDate = null;
            this.parameters = parameters;
            this.state = false;
            this.report = [];
            this.output = null;
        };

        switch (params.length) {
            case 0:
                throw new Error(PARAMETERS_EXPECTED);
            case 1:
                setup.apply(null, params);
                break;
            default:
                const [type, action, parameters] = params;

                setup({ type, action, parameters });
        }
    }

    save() {
        return robot.createMilestone(this).then((milestone) => (robot.startMilestone(milestone._id)));
    }

    static spawn(...params) {
        const run = ({ type, action, parameters }) => {
            const milestone = new Milestone({ type, action, parameters });

            return milestone.save();
        };
        
        switch (params.length) {
            case 0:
                throw new Error(PARAMETERS_EXPECTED);
            case 1:
                return run.apply(null, params);
            default:
                const [type, action, parameters] = params;

                return run({ type, action, parameters });
        }        
    }
}

export default Milestone;