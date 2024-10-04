"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWebsite = startWebsite;
exports.toView = toView;
exports.validRender = validRender;
const express_1 = __importDefault(require("express"));
const express_2 = require("./express");
const express_handlebars_1 = require("express-handlebars");
const joi_1 = __importDefault(require("joi"));
function startWebsite(routers, options) {
    return (0, express_2.startup)(routers, {
        ...options,
        expandMiddlewares: [
            (0, express_2.asyncMiddleware)(async function (_request, response) {
                response.status(404).render("404");
            }),
        ],
        preSetting(app) {
            app.engine("handlebars", (0, express_handlebars_1.engine)());
            app.set("view engine", "handlebars");
            app.set("views", "./views");
            app.use(express_1.default.static("public"));
        },
        exceptionHandler(error, response) {
            if (options?.apiPrefix) {
                const isApiRequest = response.req.originalUrl.startsWith(options.apiPrefix) ||
                    response.req.originalUrl.startsWith(options.apiPrefix.replace("/", ""));
                if (isApiRequest) {
                    (0, express_2.defaultExceptionHandler)(error, response);
                    return;
                }
            }
            if (error instanceof express_2.HttpServerException) {
                response
                    .status(error.getHttpResponseStatusCode())
                    .render(error.getHttpResponseStatusCode().toString());
            }
            else {
                response
                    .status(500)
                    .render("500");
            }
        },
    });
}
function toView(view, layout) {
    return (0, express_2.asyncMiddleware)(async function (request, response) {
        response.render(view, { user: request.user, layout });
    });
}
function validRender(schema) {
    return (0, express_2.asyncMiddleware)(async function (request, response) {
        try {
            response.data = joi_1.default.attempt(response.data, joi_1.default.object(schema));
            response.view = joi_1.default.attempt(response.view, joi_1.default.string().required());
            response.layout = joi_1.default.attempt(response.layout, joi_1.default.string());
            response.render(response.view, { user: request.user, data: response.data, layout: response.layout });
        }
        catch (error) {
            throw new express_2.ServerErrorException(`RenderViewError: ${error.details}`);
        }
    });
}
