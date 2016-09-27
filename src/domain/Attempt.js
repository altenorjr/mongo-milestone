import { ObjectId } from 'mongodb';

export default class Attempt {
    constructor(parameters, _id) {
        this._id = _id || new ObjectId();
        this.success = null;
        this.beginDate = new Date();
        this.endDate = null;
        this.input = parameters;
        this.output = null;
    }
}