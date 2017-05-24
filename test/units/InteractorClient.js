/* eslint-env mocha */

'use strict';

process.env.NODE_ENV = 'test';
const InteractorClient = require('../../');
const assert = require('assert');
const cst = require('../../constants');

describe('Unit - InteractorClient', () => {
  describe('ping', () => {
    before((done) => {
      InteractorClient.killInteractorDaemon(cst, () => done());
    });

    it('should throw an error when no callback', (done) => {
      try {
        InteractorClient.ping(cst);
      } catch (err) {
        assert(err !== null);
        assert(err instanceof Error);
        done();
      }
    });

    it('should handle when no options are given', (done) => {
      InteractorClient.ping(null, (err, state) => {
        assert(err !== null);
        assert(state === undefined);
        done();
      });
    });

    it('should handle when no options are given', (done) => {
      InteractorClient.ping({}, (err, state) => {
        assert(err !== null);
        assert(state === undefined);
        done();
      });
    });

    it('should try to ping but fail', (done) => {
      InteractorClient.ping(cst, (err, state) => {
        assert(err === null);
        assert(state === false);
        done();
      });
    });
  });
});
