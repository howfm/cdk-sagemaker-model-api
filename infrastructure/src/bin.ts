#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import "source-map-support/register";
import { buildLambdas } from "./build";
import { API_LAMBDA, DemoAPIStack } from "./demo-api-stack";
import { prepareEcrRepository } from "./infraUtils";
import { ModelBuildingStack } from "./model-building-stack";
import { ModelServingStack } from "./model-serving-stack";
import { getStage } from "./stages";

const main = async () => {
    const app = new App();
    const {
        config: { env, ...sagemakerOptions },
    } = getStage(app);

    buildLambdas([API_LAMBDA].map(lambda => lambda.filePath));

    const modelDockerImage = `${sagemakerOptions.modelName.toLowerCase()}-docker-image`;
    const endpointName = `${sagemakerOptions.modelName}-Endpoint`;

    await prepareEcrRepository(modelDockerImage);
    new ModelBuildingStack(app, "DemoModelBuildingStack", {
        env,
        modelDockerImage: modelDockerImage,
    });

    new ModelServingStack(app, "DemoModelServingStack", {
        env,
        endpointName: endpointName,
        modelDockerImage: modelDockerImage,
        sagemakerOptions: sagemakerOptions,
    });

    new DemoAPIStack(app, "DemoAPIStack", {
        env,
        sagemakerEndpointName: endpointName,
    });
};

main();
