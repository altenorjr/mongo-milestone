import 'babel-polyfill';
import sinonAsPromised from 'sinon-as-promised';
import Q from 'q';
import chai from 'chai';
const chaiAsPromised = require('chai-as-promised');

chai.should();
chai.use(chaiAsPromised);