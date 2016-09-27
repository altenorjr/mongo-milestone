import { ObjectId } from 'mongodb';

import Action from './Action';
import robot from '../robot';

export const TYPE_REQUIRED = 'The Milestone type is required';
export const ACTION_REQUIRED = 'The Miletone root Action must be an Action';

export default class Milestone {
    constructor({ type, action, parameters }) {
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
    }

    save() {
        return robot.createMilestone(this);
    }
}