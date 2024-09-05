import knex from "knex";
import joi from "joi";
import { logger } from "./logger";

const schema = joi.object({
    NODE_ENV: joi.string().allow("development", "production", "test").default("development"),
    DB_HOST: joi.string().required(),
    DB_USER: joi.string().required(),
    DB_PASSWORD: joi.string().required(),
    DB_DATABASE: joi.string().required(),
})

const env = joi.attempt(process.env, schema, { allowUnknown: true });
const database = knex({
    client: "pg",
    connection: {
        host: env.DB_HOST,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        database: env.DB_DATABASE,
        charset: "utf8",
    },
    pool: {
        max: 20,
        min: 5,
        idleTimeoutMillis: 10000,
        acquireTimeoutMillis: 30000,
    },
    debug: env.NODE_ENV == "development",
    log: {
        debug: logger.debug,
        error: logger.error,
    },
});

export async function safeTransaction(handler: (transaction: knex.Knex.Transaction) => Promise<void>) {
    const transaction = await database.transaction();
    await handler(transaction)
        .then(() => transaction.commit())
        .catch(error => (transaction.rollback(), error));
}
