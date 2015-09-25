var Promise = require('bluebird');
var has = require('lodash/object/has');
var each = require('lodash/collection/each');
var delay = require('lodash/function/delay');
var invoke = require('lodash/collection/invoke');
var takeWhile = require('lodash/array/takeWhile');
var last = require('lodash/array/last');
var toArray = require('lodash/lang/toarray');
var isString = require('lodash/lang/isstring');
var isUndefined = require('lodash/lang/isundefined');
var inherits = require('util').inherits;
var Emitter = require('events').EventEmitter;
var bind = require('lodash/function/bind');
var bindAll = require('lodash/function/bindall');
var CallHandler = require('./callhandler');
var CallbackReceiver = require('./callbackreceiver');
var shared = require('./shared');
var Setup = require('./setup');

module.exports = RedRpc;

function RedRpc(options) {
    if (!options) {
        options = {};
    }
    Emitter.call(this);
    bindAll(this, 'receiveCallback', 'handleCall', '__emitError');
    this.setup = new Setup(options);
    this.timeout = options.timeout || 10000;
    this.serializer = options.serializer || JSON;
    this.callbacks = createStorageObject();
    this.handlers = [];
    this.doesOwnClient = !options.client;
    this.setupCallbackReceiver();
}

inherits(RedRpc, Emitter);

var r = RedRpc.prototype;

r.namespace = 'redrpc';

r.call = function(method, args, options) {
    if (!options) {
        options = {};
    }
    var queue = this.setup.getCallQueueName(method);
    do {
        var callId = this.getCallID();
    } while (this.callbacks[callId]);
    var message = {
        arguments: args,
        sender: this.setup.id,
        id: callId
    };
    message = this.serializer.stringify(message);
    var timeout = options.timeout || this.timeout;
    var _this = this;
    var callTime = +new Date();
    var deferred;
    return new Promise(function(resolve, reject) {
            _this.setup.client.lpush(queue, message, function(error) {
                if (error) {
                    reject(error);
                    return;
                }
                deferred = {
                    id: callId,
                    resolve: resolve,
                    reject: reject,
                    timeoutID: null
                };
                _this.callbacks[callId] = deferred;
                var adjustedTimeout = timeout + callTime - new Date();
                if (adjustedTimeout < 0) {
                    adjustedTimeout = 0;
                }
                deferred.timeoutID = delay(function() {
                    deferred.timeoutID = null;
                    var elapsed = new Date() - callTime;
                    reject(callTimeoutError(method, elapsed));
                }, adjustedTimeout);
            });
        }).finally(function() {
            if (deferred) {
                if (deferred.timeoutId !== null) {
                    clearTimeout(deferred.timeoutID);
                }
                delete _this.callbacks[callId];
            }
        });
};

r.define = function(methods, options) {
    var methods = takeWhile(arguments, isString);
    var options;
    if (methods.length < arguments.length) {
        options = last(arguments);
    }
    var rpc = this;
    var sugar = {};
    each(methods, function(method) {
        sugar[method] = function() {
            var args = toArray(arguments);
            return rpc.call(method, args, options);
        };
    });
    return sugar;
};

r.getCallID = function() {
    return this.setup.randomString();
};

r.receiveCallback = function(message) {
    try {
        message = this.serializer.parse(message);
        var callback = this.callbacks[message.id];
        if (!callback) {
            throw new Error('no callback registered with the id ' + message.id);
        }
        if (has(message, 'result')) {
            callback.resolve(message.result);
        } else {
            callback.reject(remoteError(message.error));
        }
    } catch (error) {
        this.emitError(error);
    }
};

r.setupCallbackReceiver = function() {
    var receiver = new CallbackReceiver(this.setup);
    var receiveCallback = this.receiveCallback;
    receiver.on('message', receiveCallback);
    receiver.once('quit', function() {
        receiver.removeListener('message', receiveCallback);
    });
    this.callbackReceiver = receiver;
    receiver.awaitMessage();
};

r.handle = function(handler) {
    handler = new CallHandler(handler, this.setup);
    var handleCall = this.handleCall;
    handler.on('message', handleCall);
    handler.once('quit', function() {
        handler.removeListener('message', handleCall);
    });
    this.handlers.push(handler);
    handler.awaitMessage();
    return handler;
};

r.handleCall = function(message, queue, handler) {
    try {
        var method = this.getMethodName(queue);
        var call = this.serializer.parse(message);
        validateCall(call);
        Promise.resolve()
            .then(function() {
                return handler[method].apply(handler, call.arguments);
            })
            .then(function(result) {
                if (isUndefined(result)) {
                    throw noReturnValueError(method);
                } else {
                    return result;
                }
            })
            .then(
                bind(this.sendSuccessCallback, this, call),
                bind(this.sendErrorCallback, this, call)
            );
    } catch (error) {
        this.emitError(error);
    }
};

r.sendSuccessCallback = function(call, value) {
    var callbackMessage = {
        result: value,
        id: call.id
    };
    this.sendCallback(callbackMessage, call);
};

r.emitError = shared.emitError;

r.sendErrorCallback = function(call, error) {
    error = {
        message: error.message
    };
    if (this.exposeErrorStack && error.stack) {
        error.data = error.stack;
    }
    var callbackMessage = {
        error: error,
        id: call.id
    };
    this.sendCallback(callbackMessage, call);
};

r.sendCallback = function(callbackMessage, call) {
    var queueName = this.setup.getCallbackQueueName(call.sender);
    callbackMessage = this.serializer.stringify(callbackMessage);
    this.setup.client.lpush(queueName, callbackMessage, this.__emitError);
};

r.getMethodName = function(queueName) {
    var prefix = this.namespace + '-method-';
    return queueName.slice(prefix.length);
};

r.quit = function() {
    var allQuit = invoke(this.handlers, 'quit');
    allQuit.push(this.callbackReceiver.quit());
    if (this.setup.doesOwnClient) {
        this.setup.client.quit();
    }
    return Promise.all(allQuit);
};

/**
 * Node-style callback which emits error if encounters one
 * @param error
 * @private
 */
r.__emitError = function(error) {
    if (error) {
        this.emitError(error);
    }
};

function createStorageObject() {
    return Object.create(null);
}

function validateCall(call) {
    // TODO call object validity check
}

function callTimeoutError(method, timeElapsed) {
    return new Error(
        'remote procedure ' + method + '() execution timeout: callback not received in ' + timeElapsed + 'ms'
    );
}

function noReturnValueError(method) {
    return new Error(
        'remote procedure ' + method + '() has not provided a return value'
    );
}

function remoteError(error) {
    return new Error(error.message);
}
