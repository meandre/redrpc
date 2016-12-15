red.rpc
=======
is a library which implements remote/inter-process procedure call using Redis as a transport.

# A Detailed Example

## process1.js

```javascript
const RedRpc = require('red.rpc');
const red = new RedRpc({namespace: 'my.app'});

// Declare a handler for numbers() method
red.handle({
    numbers: (count) => {
        const numbers = [];
        for (var i = 0; i < count; i++) {
            numbers.push(Math.random());
        }
        return numbers;
    },
    // Async procedures are possible with Promises
    format: (number) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve('number = ' + number);
            }, 200);
        });
    }
});
```

## process2.js

```javascript
const RedRpc = require('red.rpc');
const red = new RedRpc({namespace: 'my.app'});

// Declare a handler for sum() method
red.handle({
    sum: (numbers) => {
        return numbers.reduce(function(s, n) {
            return s + n;
        }, 0);
    }
});
```
        
## process3.js

```javascript
const RedRpc = require('red.rpc');
const red = new RedRpc({namespace: 'my.app'});

// Obtain the API object
const api = red.define('sum', 'numbers', 'format');

api.numbers(100)
    .then(api.sum)
    .then(api.format)
    // Will log the formatted sum of 100 random numbers
    .then((string) => {
        console.log(string);
    });
```
