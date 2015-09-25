var RedRpc = require('..');

describe('RedRpc', function() {
    it('executes the example', function(done) {
        function require() {
            return RedRpc;
        }

        var console = {
            log: function(v) {
                if (!/number = \d+/.test(v)) {
                    throw new TypeError('unexpected value');
                }
            }
        };

        (function() {
            var RedRpc = require('red.rpc');
            var red = new RedRpc({
                namespace: 'my.app'
            });
            // Declare a handler for numbers() method
            red.handle({
                numbers: function(count) {
                    var numbers = [];
                    for (var i = 0; i < count; i++) {
                        numbers.push(Math.random());
                    }
                    return numbers;
                },
                // Async procedures are possible with Promises
                format: function(number) {
                    return new Promise(function(resolve) {
                        setTimeout(function() {
                            resolve('number = ' + number);
                        }, 200);
                    });
                }
            });
        })();

        (function() {
            var RedRpc = require('red.rpc');
            var red = new RedRpc({
                namespace: 'my.app'
            });
            // Declare a handler for sum() method
            red.handle({
                sum: function(numbers) {
                    return numbers.reduce(function(s, n) {
                        return s + n;
                    }, 0);
                }
            });
        })();

        (function() {
            var RedRpc = require('red.rpc');
            var red = new RedRpc({
                namespace: 'my.app'
            });
            // Obtain the API object
            var api = red.define('sum', 'numbers', 'format');
            api.numbers(100)
                .then(api.sum)
                .then(api.format)
                // Will log the formatted sum of 100 random numbers
                .then(function(string) {
                    console.log(string);
                    done();
                });
        })();

    });
});
