import { App, StackProps } from "aws-cdk-lib";

export type InstanceType = "serverless" | "instance";

interface StageEnvironment extends StackProps {
    // The name of the sagemaker endpoint.
    readonly modelName: string;
    readonly endpointType: InstanceType;
    readonly instanceType?: string;
    readonly instanceCount?: number;
    // The memory size for the Sagemaker serverless endpoint (default 4096), see https://docs.aws.amazon.com/sagemaker/latest/dg/serverless-endpoints.html#serverless-endpoints-how-it-works-memory
    // 1024 MB, 2048 MB, 3072 MB, 4096 MB, 5120 MB, or 6144 MB
    readonly endpointMemorySize?: number;
    // The maximal number of concurrent invocations of the Sagemaker endpoint (default 2), see https://docs.aws.amazon.com/sagemaker/latest/dg/serverless-endpoints.html#serverless-endpoints-how-it-works-concurrency.
    readonly endpointMaxConcurrency?: number;
    readonly modelS3Path?: string;
    readonly huggingFaceTokenizer?: string;
    readonly huggingFaceModel?: string;
}

function getStage(app: App): { config: StageEnvironment } {
    const stage: string = app.node.tryGetContext("stage");
    if (!stage) {
        throw new Error("Context variable missing on CDK command. Pass in as `--context stage=XXX`");
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require(`./${stage}.json`);
    if (!config) {
        throw new Error(`Could not load config for '${stage}'`);
    }

    return { config };
}

export { StageEnvironment, getStage };
