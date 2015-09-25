var randomBytes = require('crypto').randomBytes;
var pick = require('lodash/object/pick');

module.exports = Setup;

function Setup(options) {
    if (!options) {
        options = {};
    }
    this.id = options.id || this.randomString();
    this.namespace = options.namespace || 'redrpc';
    this.redis = options.redis || require('redis');
    this.redisOptions = pick(options, 'port', 'host', 'auth');
    this.client = options.client || this.createClient();
    this.doesOwnClient = !options.client;
}

var s = Setup.prototype;

s.randomString = function() {
    return randomBytes(32).toString('base64');
};

s.nsQueueName = function(queueName) {
    return this.namespace + '-' + queueName;
};

s.getCallQueueName = function(method) {
    return this.nsQueueName('method-' + method);
};

s.getCallbackQueueName = function(caller) {
    return this.nsQueueName('callback-' + caller);
};

s.createClient = function() {
    return this.redis.createClient(this.redisOptions);
};
