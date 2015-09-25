var _ = require('lodash');
var chai = require('chai');
chai.use(require('chai-as-promised'));
var expect = chai.expect;
var Promise = require('bluebird');
var RedRpc = require('..');

describe('RedRpc', function() {
    var red;
    var rpc;
    var handler;

    beforeEach(function() {
        red = new RedRpc({
            timeout: 500
        });
        handler = red.handle({
            echo: function(value) {
                return 'red ' + value;
            },
            sum: function() {
                return _.reduce(arguments, function(s, n) {
                    return s + n;
                }, 0);
            },
            reject: function(message) {
                throw new Error(message);
            },
            async: function(value) {
                return Promise.delay(value, 100);
            },
            noRetVal: function() {}
        });
        rpc = red.define('echo', 'sum', 'reject', 'async', 'noRetVal');
    });

    afterEach(function() {
        if (this.currentTest.title === 'quits promptly') return;
        return red.quit();
    });

    it('quits promptly', function() {
        return expect(red.quit()).to.be.fulfilled;
    });

    it('handler quits promptly', function() {
        return expect(handler.quit()).to.be.fulfilled;
    });

    it('can issue a remote call', function() {
        return red.call('echo', [0, '1', {two: 2}])
            .catch(function() {});
    });

    it('can handle a remote call', function() {
        return expect(red.call('sum', [1, 2, 3])).to.become(6);
    });

    it('does have sugar', function() {
        var rpc = red.define('sum');
        return expect(rpc.sum(1, 2, 3)).to.become(6);
    });

    it('can properly route multiple simultaneous calls', function() {
        var sums = Promise.all([
            red.call('sum', [10, 9, 8]),
            red.call('sum', [100, 1]),
            red.call('echo', ['rpc']),
            red.call('sum', [1, 2, 3])
        ]);

        return expect(sums).to.become([27, 101, 'red rpc', 6]);
    });

    it('rejects if an error occurs', function() {
        return expect(red.call('reject', ['whatever'])).be.rejected;
    });

    it('rejects if a handler has not provided a return value', function() {
        return expect(red.call('noRetVal', [])).be.rejectedWith(/has not provided a return value/);
    });

    it('can handle async methods', function() {
        return expect(red.call('async', ['value'])).to.become('value');
    });

    it('does not interfere with instances in another namespace', function() {
        var another = new RedRpc({
            namespace: 'white'
        });

        another.handle({
            echo: function(value) {
                return 'white ' + value;
            }
        });

        var many = Promise.all(_.times(100, function() {
            return red.call('echo', ['rpc']);
        }));

        return expect(many).to.eventually.satisfy(function(values) {
            return _.every(values, _.matches('red rpc'));
        });
    });

});
