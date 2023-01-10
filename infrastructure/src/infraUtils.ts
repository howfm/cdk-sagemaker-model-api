import * as AWS from "aws-sdk";
import { AWSError } from "aws-sdk";

const MAX_IMAGE_COUNT_RULE = {
    rules: [
        {
            rulePriority: 1,
            description: "Keep only one untagged image, expire all others",
            selection: {
                tagStatus: "untagged",
                countType: "imageCountMoreThan",
                countNumber: 1,
            },
            action: {
                type: "expire",
            },
        },
        {
            rulePriority: 2,
            description: "Expire dev images after 30 days.",
            selection: {
                tagStatus: "tagged",
                tagPrefixList: ["dev"],
                countType: "sinceImagePushed",
                countUnit: "days",
                countNumber: 30,
            },
            action: {
                type: "expire",
            },
        },
    ],
};

const isAWSError = (e: unknown): e is AWSError => {
    return (e as AWSError).code !== undefined;
};

const prepareEcrRepository = async (repositoryName: string): Promise<string> => {
    const ecrClient = new AWS.ECR();

    // check if repo already exists
    try {
        console.log(`${repositoryName}: checking if ECR repository already exists`);
        const describeResponse = await ecrClient.describeRepositories({ repositoryNames: [repositoryName] }).promise();
        const existingRepositoryUri = describeResponse.repositories![0]?.repositoryUri;
        if (existingRepositoryUri) {
            console.log(`${repositoryName}: ECR repository already exists. Done.`);
            return existingRepositoryUri;
        }
    } catch (e) {
        if (isAWSError(e)) {
            if (e.code !== "RepositoryNotFoundException") {
                throw e;
            }
        }
    }

    // create the repo (tag it so it will be easier to garbage collect in the future)
    console.log(`${repositoryName}: creating ECR repository`);
    const response = await ecrClient.createRepository({ repositoryName }).promise();
    const repositoryUri = response.repository?.repositoryUri;
    if (!repositoryUri) {
        const error = `CreateRepository did not return a repository URI for ${repositoryUri}`;
        console.log(error);
        throw new Error(error);
    }

    // configure image scanning on push (helps in identifying software vulnerabilities, no additional charge)
    console.log(`${repositoryName}: enable image scanning`);
    await ecrClient
        .putImageScanningConfiguration({ repositoryName, imageScanningConfiguration: { scanOnPush: true } })
        .promise();

    await ecrClient
        .putLifecyclePolicy({ repositoryName, lifecyclePolicyText: JSON.stringify(MAX_IMAGE_COUNT_RULE) })
        .promise();
    return repositoryUri;
};

export { prepareEcrRepository };
