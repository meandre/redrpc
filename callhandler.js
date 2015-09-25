var inherits = require('util').inherits;
var map = require('lodash/collection/map');
var keys = require('lodash/object/keys');
var Listener = require('./receiver');

module.exports = CallHandler;

function CallHandler(handler, setup) {
    Listener.call(this, setup);
    this.handler = handler;
}

inherits(CallHandler, Listener);

var h = CallHandler.prototype;

h.getQueueNames = function() {
    var setup = this.setup;
    return map(keys(this.handler), function(method) {
        return setup.getCallQueueName(method);
    });
};

h.emitMessage = function(item, queue) {
    this.emit('message', item, queue, this.handler);
};
