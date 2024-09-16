import { Knex } from "knex";
import { NextFunction, Request, Response } from "express";
import { transaction } from "./knex";
import { Middleware } from "./express-base";

type TransactionRequestHandler =
    (request: Request, response: Response, transaction: Knex.Transaction) => Promise<void>;

export function transactionMiddleware(handler: TransactionRequestHandler): Middleware {
    return function (request: Request, response: Response, next: NextFunction) {
        transaction(transaction => handler(request, response, transaction))
            .then(() => next())
            .catch(error => next(error));
    }
}