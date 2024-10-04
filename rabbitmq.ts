import joi from "joi";
import amqp, { Channel } from "amqplib";
import { Observable } from "rxjs";

const MQ_URL = joi.attempt(process.env.MQ_URL, joi.string().required());

type SubscriberMessage<T> = {
    exchange: string;
    routingKey: string;
    data: T;
    ackMessage: () => void;
}

export async function onceChannel(handler: (channel: Channel) => Promise<void>) {
    const connection = await amqp.connect(MQ_URL);
    const channel = await connection.createChannel();
    try {
        await handler(channel);
    } finally {
        await channel.close();
        await connection.close();
    }
}

export async function aliveChannel(prefetch: number) {
    return amqp.connect(MQ_URL)
        .then(connection => connection.createChannel())
        .then(channel => channel.prefetch(prefetch).then(() => channel));
}

export async function bindQueue(exchange: string, routingKey: string, queue: string) {
    await onceChannel(async function (channel) {
        await channel.assertExchange(exchange, "topic", { durable: true });
        await channel.assertQueue(queue, { durable: true });
        await channel.bindQueue(queue, exchange, routingKey);
    });
}

export async function publish(exchange: string, routingKey: string, data: object, priority?: number) {
    await onceChannel(async function (channel) {
        channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(data), "utf-8"), { priority });
    });
}

export function consume(queue: string, prefetch: number): Observable<SubscriberMessage<unknown>> {
    return new Observable(function (observer) {
        !async function () {
            const channel = await aliveChannel(prefetch);
            await channel.consume(queue, async function (message) {
                if (!message) return;
                const exchange = message.fields.exchange;
                const routingKey = message.fields.routingKey;
                const data = JSON.parse(message.content.toString("utf-8"));
                const ackMessage = () => channel.ack(message);
                observer.next({ exchange, routingKey, data, ackMessage });
            });
        }();
    });
}

export function mapMessage<T, E>(mapping: (data: T) => E) {
    return function (source: SubscriberMessage<T>): SubscriberMessage<E> {
        return {
            exchange: source.exchange,
            routingKey: source.routingKey,
            data: mapping(source.data),
            ackMessage: source.ackMessage,
        }
    }
}

export function attemptMessage<T>(errorHandler: (message: SubscriberMessage<T>) => Promise<void>, schema: joi.ObjectSchema) {
    return function (message: SubscriberMessage<T>): boolean {
        try {
            message.data = joi.attempt(message.data, schema, { allowUnknown: true });
            return true;
        } catch (error) {
            errorHandler(message).then(() => message.ackMessage());
            return false;
        }
    }
}