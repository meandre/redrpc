var inherits = require('util').inherits;
var Receiver = require('./receiver');

module.exports = CallbackReceiver;

function CallbackReceiver(setup) {
    Receiver.call(this, setup);
}

inherits(CallbackReceiver, Receiver);

CallbackReceiver.prototype.getQueueNames = function() {
    return [this.setup.getCallbackQueueName(this.setup.id)];
};
