// FROM: https://github.com/aws-samples/amazon-sagemaker-model-serving-using-aws-cdk/blob/main/bin/stack/model-serving/model-serving-stack.ts

import { aws_iam as iam, aws_sagemaker as sagemaker, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { StageEnvironment } from "./stages";
interface ModelServingStackPorps extends StackProps {
    readonly endpointName: string;
    readonly modelDockerImage: string;
    sagemakerOptions: StageEnvironment;
}

export class ModelServingStack extends Stack {
    constructor(scope: Construct, id: string, props: ModelServingStackPorps) {
        super(scope, id, props);

        const { env, endpointName, modelDockerImage, sagemakerOptions } = props;

        const accountId = env!.account!;
        const region = env!.region!;
        const modelDockerImagePath = `${accountId}.dkr.ecr.${region}.amazonaws.com/${modelDockerImage}:latest`;

        const role: iam.IRole = this.createIamRole(`DemoModelEndpoint-Role`);

        const time = new Date().toISOString().substr(0, 16).replace(":", "-");
        const modelName = `${endpointName}-MODEL-${time}`;

        const model = this.createModel(
            modelName,
            role,
            modelDockerImagePath,
            sagemakerOptions.modelS3Path,
            sagemakerOptions.huggingFaceTokenizer,
            sagemakerOptions.huggingFaceModel
        );

        const endpointConfigName = `${endpointName}-CONFIG-${time}`;
        // TODO: Enable data logging in S3? -> Future iterations.
        const endpointConfig = this.createEndpointConfig(endpointConfigName, model, sagemakerOptions);

        this.deployEndpoint(endpointName, endpointConfig);
    }

    private createModel(
        modelName: string,
        role: iam.IRole,
        modelDockerImagePath: string,
        modelS3Path?: string,
        huggingFaceTokenizer?: string,
        huggingFaceModel?: string
    ): sagemaker.CfnModel {
        const environment = {
            SAGEMAKER_MODEL_SERVER_WORKERS: 1,
            ...(huggingFaceTokenizer !== undefined && { HUGGING_FACE_TOKENIZER: huggingFaceTokenizer }),
            ...(huggingFaceModel !== undefined && { HUGGING_FACE_MODEL: huggingFaceModel }),
        };
        const container: sagemaker.CfnModel.ContainerDefinitionProperty = {
            image: modelDockerImagePath,
            environment: environment,
            ...(modelS3Path !== undefined && { modelDataUrl: modelS3Path }),
        };

        const model = new sagemaker.CfnModel(this, modelName, {
            modelName: modelName,
            executionRoleArn: role.roleArn,
            containers: [container],
        });
        return model;
    }

    private createEndpointConfig(
        endpointConfigName: string,
        model: sagemaker.CfnModel,
        sagemakerOptions: StageEnvironment
    ): sagemaker.CfnEndpointConfig {
        const modelName = model.modelName;
        const variant = {
            modelName: modelName!,
            variantName: "default-variant",
            initialVariantWeight: 1.0,
            ...(sagemakerOptions.endpointType === "instance" && {
                initialInstanceCount: sagemakerOptions.instanceCount ?? 1,
                instanceType: sagemakerOptions.instanceType ?? "ml.m5.xlarge",
            }),
            ...(sagemakerOptions.endpointType === "serverless" && {
                serverlessConfig: {
                    maxConcurrency: sagemakerOptions.endpointMaxConcurrency ?? 2,
                    memorySizeInMb: sagemakerOptions.endpointMemorySize ?? 4096,
                },
            }),
        };

        const endpointConfig = new sagemaker.CfnEndpointConfig(this, endpointConfigName, {
            endpointConfigName: endpointConfigName,
            productionVariants: [variant],
            // TODO: Data capture (see above) -> Future iterations
            // dataCaptureConfig: {
            //     captureOptions: [{ captureMode: "Input" }, { captureMode: "Output" }],
            //     enableCapture: props.dataLoggingEnable,
            //     destinationS3Uri: `s3://${props.dataLoggingBucketName}/${props.dataLoggingS3Key}`,
            //     initialSamplingPercentage: props.dataLoggingPercentage,
            // },
        });
        endpointConfig.addDependency(model);
        return endpointConfig;
    }

    private deployEndpoint(endpointName: string, endpointConfig: sagemaker.CfnEndpointConfig): void {
        const endpointConfigName = endpointConfig.endpointConfigName!;
        new sagemaker.CfnEndpoint(this, endpointName, {
            endpointName: endpointName,
            endpointConfigName: endpointConfigName,
        }).addDependency(endpointConfig);
    }

    private createIamRole(roleBaseName: string): iam.IRole {
        const role = new iam.Role(this, roleBaseName, {
            roleName: roleBaseName,
            assumedBy: new iam.ServicePrincipal("sagemaker.amazonaws.com"),
            managedPolicies: [{ managedPolicyArn: "arn:aws:iam::aws:policy/AmazonSageMakerFullAccess" }],
        });

        role.addManagedPolicy({ managedPolicyArn: "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess" });

        return role;
    }
}
