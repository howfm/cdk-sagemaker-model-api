import * as fs from "fs";
import * as inquirer from "inquirer";
import { StageEnvironment } from "../src/stages";

interface Answers {
    stageName: string;
    awsBroaderRegion: string;
    awsAccount: string;
    awsRegion: string;
    modelName: string;
    modelLocation: string;
    modelS3Path?: string;
    huggingFaceTokenizer?: string;
    huggingFaceModel?: string;
    endpointType: "serverless" | "instance";
    instanceType?: string;
    instanceCount?: number;
    endpointMemorySize?: number;
    endpointMaxConcurrency?: number;
}
const questions = [
    {
        type: "input",
        name: "stageName",
        message: "Name of the stage (only alphanumerics and - and _)",
        validate: (value: string) => {
            if (/[^a-z0-9_-]/i.test(value)) {
                return "The name of the stage is only allowed to contain alphanumerics and - and _";
            }
            return true;
        },
    },
    {
        type: "input",
        name: "awsAccount",
        message: "AWS Account Number",
        validate: (value: string) => {
            if (/^\d{12}$/i.test(value)) {
                return true;
            }
            return "Not a valid AWS Account Number.";
        },
    },
    {
        type: "list",
        name: "awsBroaderRegion",
        message: "AWS Broader Region",
        choices: ["eu", "us", "af", "ap", "ca", "me", "sa"],
        default: "eu",
    },
    {
        type: "list",
        name: "awsRegion",
        message: "AWS US Region",
        choices: ["us-east-2", "us-east-1", "us-west-1", "us-west-2"],
        when: (answers: Answers) => answers.awsBroaderRegion === "us",
    },
    {
        type: "list",
        name: "awsRegion",
        message: "AWS AF Region",
        choices: ["af-south-1"],
        when: (answers: Answers) => answers.awsBroaderRegion === "af",
    },
    {
        type: "list",
        name: "awsRegion",
        message: "AWS AP Region",
        choices: [
            "ap-southeast-3",
            "ap-south-1",
            "ap-northeast-3",
            "ap-northeast-2",
            "ap-southeast-1",
            "ap-southeast-2",
            "ap-northeast-1",
        ],
        when: (answers: Answers) => answers.awsBroaderRegion === "ap",
    },
    {
        type: "list",
        name: "awsRegion",
        message: "AWS CA Region",
        choices: ["ca-central-1"],
        when: (answers: Answers) => answers.awsBroaderRegion === "ca",
    },
    {
        type: "list",
        name: "awsRegion",
        message: "AWS EU Region",
        choices: ["eu-central-1", "eu-west-1", "eu-west-2", "eu-south-1", "eu-west-3", "eu-north-1"],
        when: (answers: Answers) => answers.awsBroaderRegion === "eu",
    },
    {
        type: "list",
        name: "awsRegion",
        message: "AWS ME Region",
        choices: ["me-south-1", "me-central-1"],
        when: (answers: Answers) => answers.awsBroaderRegion === "me",
    },
    {
        type: "list",
        name: "awsRegion",
        message: "AWS SA Region",
        choices: ["sa-east-1"],
        when: (answers: Answers) => answers.awsBroaderRegion === "sa",
    },
    {
        type: "input",
        name: "modelName",
        message: "Name of the model (only alphanumerics and - and _)",
        validate: (value: string) => {
            if (/[^a-z0-9_-]/i.test(value)) {
                return "The name of the model is only allowed to contain alphanumerics and - and _";
            }
            return true;
        },
    },
    {
        type: "list",
        name: "modelLocation",
        message: "Is the model stored in S3 or on Hugging Face?",
        choices: ["Hugging Face", "S3"],
        default: "Hugging Face",
    },
    {
        type: "input",
        name: "modelS3Path",
        message: "Model S3 Path (e.g. s3://demo/model/model.tar.gz)",
        when: (answers: Answers) => answers.modelLocation === "S3",
        validate: (value: string) => {
            if (/^s3:\/\/([^/]+)\/([\w\W]+)\.(.*)/i.test(value)) {
                return true;
            }
            return "Not a valid S3 path.";
        },
    },
    {
        type: "input",
        name: "huggingFaceTokenizer",
        message: "Hugging Face Tokenizer",
        when: (answers: Answers) => answers.modelLocation === "Hugging Face",
    },
    {
        type: "input",
        name: "huggingFaceModel",
        message: "Hugging Face Model",
        when: (answers: Answers) => answers.modelLocation === "Hugging Face",
    },
    {
        type: "list",
        name: "endpointType",
        message: "What type of Sagemaker endpoint do you want to create?",
        choices: ["serverless", "instance"],
        default: "serverless",
    },
    {
        type: "list",
        name: "endpointMemorySize",
        message: "Memory size of the Sagemaker endpoint (in MB)",
        choices: [1024, 2048, 3072, 4096, 5120, 6144],
        default: 4096,
        when: (answers: Answers) => answers.endpointType === "serverless",
    },
    {
        type: "number",
        name: "endpointMaxConcurrency",
        message: "Maximal concurrency of the endpoint (1 - 200)",
        default: 5,
        validate: (value: number) => {
            if (value >= 1 && value <= 200) {
                return true;
            }
            return "Enter a value between 1 and 200";
        },
        when: (answers: Answers) => answers.endpointType === "serverless",
    },
    {
        type: "input",
        name: "instanceType",
        message: "Enter the type of instance (e.g. ml.m5.xlarge)",
        default: "ml.m5.xlarge",
        when: (answers: Answers) => answers.endpointType === "instance",
    },
    {
        type: "number",
        name: "instanceCount",
        message: "Number of instances (1 - 20)",
        default: 1,
        validate: (value: number) => {
            if (value >= 1 && value <= 20) {
                return true;
            }
            return "Enter a value between 1 and 20";
        },
        when: (answers: Answers) => answers.endpointType === "instance",
    },
];

inquirer.prompt(questions).then((answers: Answers) => {
    const stageConfig: StageEnvironment = {
        env: { account: answers.awsAccount, region: answers.awsRegion },
        modelName: answers.modelName,
        endpointMemorySize: answers.endpointMemorySize,
        endpointMaxConcurrency: answers.endpointMaxConcurrency,
        modelS3Path: answers.modelS3Path,
        endpointType: answers.endpointType,
        instanceType: answers.instanceType,
        instanceCount: answers.instanceCount,
        huggingFaceTokenizer: answers.huggingFaceTokenizer,
        huggingFaceModel: answers.huggingFaceModel,
    };
    const JSONstring = JSON.stringify(stageConfig, null, "  ");
    fs.writeFileSync(`./src/stages/${answers.stageName}.json`, JSONstring);
    console.log(`\nCreated new stage: ${answers.stageName}`);
    console.log(JSONstring);
});
