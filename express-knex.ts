import { Knex } from "knex";
import { NextFunction, Request, Response } from "express";
import { autoCommitTransaction } from "./knex";
import { Middleware } from "./express-base";

type TransactionMiddleware =
    (request: Request, response: Response, transaction: Knex.Transaction) => Promise<void>;

export function transaction(handler: TransactionMiddleware): Middleware {
    return function (request: Request, response: Response, next: NextFunction) {
        autoCommitTransaction(transaction => handler(request, response, transaction))
            .then(() => next())
            .catch(error => next(error));
    }
}