import { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

const jsonResponse = <T>(statusCode: number, body?: T): APIGatewayProxyStructuredResultV2 => ({
    headers: { "Content-Type": "application/json; charset=utf-8" },
    statusCode,
    body: body ? JSON.stringify(body) : undefined,
});

export { jsonResponse };
