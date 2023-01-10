import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2, Context } from "aws-lambda";
import { SageMakerRuntimeClient } from "@aws-sdk/client-sagemaker-runtime";
import { Logger, injectLambdaContext } from "@aws-lambda-powertools/logger";
import middy from "@middy/core";
import { jsonResponse } from "../../shared/response";
import { getSagemakerPredictions } from "./utils/sagemaker";

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const endpointName = process.env["SAGEMAKER_ENDPOINT_NAME"]!;
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const region = process.env["AWS_REGION"]!;
const logger = new Logger({ serviceName: "sagemakerDemo" });
// Create Sagemaker client
logger.info("Connecting to Sagemaker client...");
const sagemakerClient = new SageMakerRuntimeClient({ region: region });
logger.info("...connected to Sagemaker client!");

const lambdaHandler = async (
    event: APIGatewayProxyEventV2,
    _context: Context,
): Promise<APIGatewayProxyStructuredResultV2> => {
    try {
        if (!event.body || (typeof event.body === "string") === false) {
            logger.error("missing body");
            return jsonResponse(400);
        }
        const requestBody = JSON.parse(event.body);
        const inputs = requestBody.inputs;
        if (inputs === undefined) {
            logger.error("request body needs to have inputs set");
            return jsonResponse(400);
        }
        if (inputs.length === 0) {
            logger.error("inputs needs to have at least one element");
            return jsonResponse(400);
        }
        const predictions = await getSagemakerPredictions(inputs, endpointName, sagemakerClient);
        const response = {
            msg: "Request successful.",
            body: { predictions: predictions },
        };
        return jsonResponse(200, response);
    } catch (error) {
        logger.error("Internal Server Error", { serverError: error as Error });
        return jsonResponse(500, error);
    }
};

export const handler = middy(lambdaHandler).use(injectLambdaContext(logger, { logEvent: true }));
