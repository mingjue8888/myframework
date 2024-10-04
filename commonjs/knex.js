"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transaction = transaction;
const knex_1 = __importDefault(require("knex"));
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("./logger");
const schema = joi_1.default.object({
    NODE_ENV: joi_1.default.string().allow("development", "production", "test").default("development"),
    DB_HOST: joi_1.default.string().required(),
    DB_USER: joi_1.default.string().required(),
    DB_PASSWORD: joi_1.default.string().required(),
    DB_DATABASE: joi_1.default.string().required(),
});
const env = joi_1.default.attempt(process.env, schema, { allowUnknown: true });
const database = (0, knex_1.default)({
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
        debug: logger_1.logger.debug,
        error: logger_1.logger.error,
    },
});
async function transaction(handler) {
    const transaction = await database.transaction();
    await handler(transaction)
        .then(() => transaction.commit())
        .catch(error => (transaction.rollback(), error));
}
