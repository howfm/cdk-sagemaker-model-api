import * as apiGW from "@aws-cdk/aws-apigatewayv2-alpha";
import { HttpMethod, IHttpStage } from "@aws-cdk/aws-apigatewayv2-alpha";
import * as apiGWIntegrations from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import {
    aws_iam as iam,
    aws_lambda as lambda,
    aws_secretsmanager as sm,
    CfnOutput,
    Duration,
    Stack,
    StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

interface DemoAPIStackProps extends StackProps {
    // The name of the Sagemaker Endpoint.
    readonly sagemakerEndpointName: string;
}

type LambdaConfig = {
    name: string;
    filePath: string;
    httpPath: string;
    function?: lambda.Function;
    environment?:
        | {
              [key: string]: string;
          }
        | undefined;
    methods?: HttpMethod[];
    secrets?: sm.ISecret[];
};

const API_LAMBDA: LambdaConfig = {
    name: "DEMO API",
    filePath: "endpoints/demo",
    httpPath: "/demo",
    methods: [apiGW.HttpMethod.POST],
};

class DemoAPIStack extends Stack {
    apiStage: apiGW.IHttpStage;
    lambdasThatNeedObservability: LambdaConfig[] = [];
    private endpointLambdas: LambdaConfig[] = [];

    constructor(scope: Construct, id: string, props: DemoAPIStackProps) {
        super(scope, id, props);

        const { env, sagemakerEndpointName } = props;

        const accountId = env!.account!;
        const region = env!.region!;
        this.endpointLambdas = [
            {
                ...API_LAMBDA,
                environment: {
                    SAGEMAKER_ENDPOINT_NAME: sagemakerEndpointName,
                },
            },
        ];

        this.enrichLambdas(this.endpointLambdas, accountId, region);

        const api = this.addHttpApi("Demo API", this.endpointLambdas);
        this.apiStage = api.defaultStage! as IHttpStage;

        this.lambdasThatNeedObservability = this.endpointLambdas;
    }

    enrichLambdas(lambdas: LambdaConfig[], accountId: string, region: string): void {
        lambdas.forEach(lambdaConfig => {
            const config: lambda.FunctionProps = {
                runtime: lambda.Runtime.NODEJS_14_X,
                handler: "handler.handler",
                memorySize: 512,
                code: lambda.Code.fromAsset(path.join(__dirname, `../../lambdas/src/${lambdaConfig.filePath}/build/`)),
                environment: lambdaConfig.environment,
                timeout: Duration.seconds(30),
            };
            const fn = new lambda.Function(this, lambdaConfig.name, config);
            fn.addToRolePolicy(
                new iam.PolicyStatement({
                    actions: ["sagemaker:InvokeEndpoint"],
                    resources: [`arn:aws:sagemaker:${region}:${accountId}:endpoint/*`],
                    effect: iam.Effect.ALLOW,
                })
            );
            lambdaConfig.secrets?.forEach(secret => secret.grantRead(fn));
            lambdaConfig.function = fn;
        });
    }

    addHttpApi(apiName: string, lambdas: LambdaConfig[]): apiGW.HttpApi {
        const httpApi = new apiGW.HttpApi(this, "Api", {
            apiName,
        });

        new CfnOutput(this, "ApiEndpoint", { value: httpApi.url! });

        lambdas.forEach(lambdaConfig => {
            httpApi.addRoutes({
                path: `${lambdaConfig.httpPath}`,
                methods: lambdaConfig.methods,
                integration: new apiGWIntegrations.HttpLambdaIntegration(
                    `${lambdaConfig.name}-Integration`,
                    lambdaConfig.function!
                ),
            });
        });

        return httpApi;
    }
}

export { DemoAPIStack, API_LAMBDA };
