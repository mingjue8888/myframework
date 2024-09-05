import { Knex } from "knex";
import { NextFunction, Request, Response } from "express";
import { safeTransaction } from "./knex";

type TransactionHandler =
    (request: Request, response: Response, transaction: Knex.Transaction) => Promise<void>;

export function transactionMiddleware(handler: TransactionHandler) {
    return function (request: Request, response: Response, next: NextFunction) {
        safeTransaction(transaction => handler(request, response, transaction))
            .then(() => next())
            .catch(error => next(error));
    }
}