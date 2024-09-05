import joi from "joi";


const MQ_URL = joi.attempt(process.env.MQ_URL, joi.string().required());

export function onceChannel() {

}