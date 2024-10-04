"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionMiddleware = transactionMiddleware;
const knex_1 = require("./knex");
function transactionMiddleware(handler) {
    return function (request, response, next) {
        (0, knex_1.transaction)(transaction => handler(request, response, transaction))
            .then(() => next())
            .catch(error => next(error));
    };
}
