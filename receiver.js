var Emitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var bindAll = require('lodash/function/bindall');
var emitError = require('./shared').emitError;

module.exports = Receiver;

function Receiver(setup) {
    Emitter.call(this);
    bindAll(this, 'receiveMessage');
    this.setup = setup;
    this.receiver = setup.createClient();
    this.alive = true;
    this.id = setup.randomString();
}

inherits(Receiver, Emitter);

var r = Receiver.prototype;

r.quit = function() {
    if (!this.alive) return Promise.resolve();
    this.alive = false;
    var queue = this.getUnblockQueueName();
    this.setup.client.lpush(queue, '');
    var _this = this;
    return new Promise(function(resolve) {
        _this.once('quit', resolve);
    });
};

r.awaitMessage = function() {
    var args = this.getQueueNames().slice();
    args.push(this.getUnblockQueueName(), 0);
    this.receiver.brpop(args, this.receiveMessage);
};

r.receiveMessage = function(error, reply) {
    if (error) {
        this.emitError(error);
        return;
    }
    var queue = reply[0];
    if (queue !== this.getUnblockQueueName()) {
        var item = reply[1];
        this.emitMessage(item, queue);
    }
    if (this.alive) {
        this.awaitMessage();
    } else {
        this.emit('quit');
        this.receiver.quit();
    }
};

r.emitMessage = function(item, queue) {
    this.emit('message', item, queue);
};

r.getQueueNames = function() {
    throw new Error('must be defined in sub-class');
};

r.getUnblockQueueName = function() {
    return this.setup.nsQueueName('unblock-' + this.setup.id + '-' + this.id);
};

r.emitError = emitError;
