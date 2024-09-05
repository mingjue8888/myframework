import { Response } from "express";
import {
    asyncMiddleware, defaultExceptionHandler,
    ExpressRouter, HttpServerException,
    Middleware,
    ServerErrorException,
    startup,
    StartupOptions,
} from "./express-base";
import { engine } from "express-handlebars";
import joi from "joi";

declare global {
    namespace Express {
        interface Response {
            view: string;
            layout?: string;
        }
    }
}

interface WebsiteStartupOptions extends StartupOptions {
    apiPrefix?: string;
}

export function startWebsite(routers: ExpressRouter[], options?: WebsiteStartupOptions) {
    return startup(routers, {
        ...options,
        expandMiddlewares: [
            asyncMiddleware(async function (_request, response) {
                response.status(404).render("404");
            }),
        ],
        preSetting(app) {
            app.engine("handlebars", engine());
            app.set("view engine", "handlebars");
        },
        exceptionHandler(error: Error, response: Response) {
            if (options?.apiPrefix) {
                const isApiRequest =
                    response.req.originalUrl.startsWith(options.apiPrefix) ||
                    response.req.originalUrl.startsWith(options.apiPrefix.replace("/", ""));

                if (isApiRequest) {
                    defaultExceptionHandler(error, response);
                    return;
                }
            }

            if (error instanceof HttpServerException) {
                response
                    .status(error.getHttpResponseStatusCode())
                    .render(error.getHttpResponseStatusCode().toString());
            } else {
                response
                    .status(500)
                    .render("500");
            }
        },
    });
}

export function toView(view: string, layout?: string) {
    return asyncMiddleware(async function (_request, response) {
        response.render(view, { layout });
    });
}

export function validRender(schema: Record<string, joi.AnySchema>): Middleware {
    return asyncMiddleware(async function (_request, response) {
        try {
            response.data = joi.attempt(response.data, joi.object(schema));
            response.view = joi.attempt(response.view, joi.string().required());
            response.layout = joi.attempt(response.layout, joi.string());
            response.render(response.view, { data: response.data, layout: response.layout });
        } catch (error) {
            throw new ServerErrorException(`RenderViewError: ${error.details}`);
        }
    });
}