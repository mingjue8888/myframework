"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onceChannel = onceChannel;
exports.aliveChannel = aliveChannel;
exports.bindQueue = bindQueue;
exports.publish = publish;
exports.consume = consume;
exports.mapMessage = mapMessage;
exports.attemptMessage = attemptMessage;
const joi_1 = __importDefault(require("joi"));
const amqplib_1 = __importDefault(require("amqplib"));
const rxjs_1 = require("rxjs");
const MQ_URL = joi_1.default.attempt(process.env.MQ_URL, joi_1.default.string().required());
async function onceChannel(handler) {
    const connection = await amqplib_1.default.connect(MQ_URL);
    const channel = await connection.createChannel();
    try {
        await handler(channel);
    }
    finally {
        await channel.close();
        await connection.close();
    }
}
async function aliveChannel(prefetch) {
    return amqplib_1.default.connect(MQ_URL)
        .then(connection => connection.createChannel())
        .then(channel => channel.prefetch(prefetch).then(() => channel));
}
async function bindQueue(exchange, routingKey, queue) {
    await onceChannel(async function (channel) {
        await channel.assertExchange(exchange, "topic", { durable: true });
        await channel.assertQueue(queue, { durable: true });
        await channel.bindQueue(queue, exchange, routingKey);
    });
}
async function publish(exchange, routingKey, data, priority) {
    await onceChannel(async function (channel) {
        channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(data), "utf-8"), { priority });
    });
}
function consume(queue, prefetch) {
    return new rxjs_1.Observable(function (observer) {
        !async function () {
            const channel = await aliveChannel(prefetch);
            await channel.consume(queue, async function (message) {
                if (!message)
                    return;
                const exchange = message.fields.exchange;
                const routingKey = message.fields.routingKey;
                const data = JSON.parse(message.content.toString("utf-8"));
                const ackMessage = () => channel.ack(message);
                observer.next({ exchange, routingKey, data, ackMessage });
            });
        }();
    });
}
function mapMessage(mapping) {
    return function (source) {
        return {
            exchange: source.exchange,
            routingKey: source.routingKey,
            data: mapping(source.data),
            ackMessage: source.ackMessage,
        };
    };
}
function attemptMessage(errorHandler, schema) {
    return function (message) {
        try {
            message.data = joi_1.default.attempt(message.data, schema, { allowUnknown: true });
            return true;
        }
        catch (error) {
            errorHandler(message).then(() => message.ackMessage());
            return false;
        }
    };
}
