<!-- TODO -->

# how.fm Translation Matching API

This repository combines all necessary infrastructure for the Translation Matching API. This API gets two sets of sentences as input and returns the pair-wise similarity between those sentences.

## Table of Content

1. [API Overview](#api-overview)
1. [Usual Workflow](#usual-workflow)
1. [Infrastructure](#infrastructure)
1. [Model Hosting](#model-hosting)
1. [Local Development](#local-development)
1. [Deployment](#deployment)
1. [Types](#types)
1. [The Model](#the-model)

## API Overview

The API is reachable for production via https://translation-matching-api.production.howfm.io and it offers one POST endpoint (`/similarity`). This endpoint expects two sets of sentences in its body:

```
{
  "source_sentences": ["Ich habe Lust auf Popcorn.", "Ich mag kein Popcorn."],
  "target_sentences": ["I am craving for popcorn.", "Je voudrais de popcorn."]
}
```

The response contains the pairwise similarity between these sentences and the optimal threshold when two sentences can be considered the same:

```
{
  "msg": "Request successful.",
  "body": {
    "similarity_matrix": [
      [
        0.9461252093315125, // similarity between "Ich habe Lust auf Popcorn."
                            // and "I am craving for popcorn."
        0.9548366665840149  // similarity between "Ich habe Lust auf Popcorn."
                            // and "Je voudrais de popcorn."
      ],
      [
        0.8342239856719971, // similarity between "Ich mag kein Popcorn."
                            // and "I am craving for popcorn."
        0.8813467621803284  // similarity between "Ich mag kein Popcorn."
                            // and "Je voudrais de popcorn."
      ]
    ],
    "optimal_threshold": 0.9
  }
}
```

To call the endpoint you need to supply IAM authorization. In the [api.rest](./docs/api.rest) file this can be done by storing the credentials for the respective account in a `.env` file with the following command `env | grep AWS > docs/.env` (given that you are in a `aws-vault` shell or similar). You can also write your AWS credentials manually into the file. See [TranslationMatchingStack](#translationmatchingstack) for more details.

For further documentation, refer to either the [HTML](./docs/translationMatchingApi.html) or [yaml](./docs/translationMatchingApi.yaml) file.

## Usual Workflow

In any case, once you are done with the new feature and merged a corresponding merge request on GitLAB, you should trigger a release to production. This sets up everything in the production environment.

### Changing the API

When you make changes concerning the API itself (i.e. the `TranslationMatchingStack`) you can then test these changes locally (see [Local Development](#local-development)) or deploy the current state to one of the Hobbits or Develop (see [Deployment](#deployment)). You can then test these changes using the [api.rest](./docs/api.rest) file.

### Changing the model

Changes in the model mean that you changed the `Dockerfile.serve` file or some code in the `model` folder. To test these changes, you have to deploy the model to Develop via `make deploy_develop`. A new Docker image is created and the Sagemaker Endpoint in the Develop environment updated. You can then test the outcome using the [api.rest](./docs/api.rest) file.

## Infrastructure

The infrastructure of this repository consists of four stacks, of which not all of them are always deployed.

### Stage configuration

The different stages are configured in `infrastructure/src/stages`. The configuration is as follows:

```ts
interface SagemakerOptions {
  // The name of the sagemaker endpoint.
  readonly endpointName: string;
  // The name of the ECR repository to store the model serving Docker image.
  readonly modelDockerImage?: string;
  // The location of the model weights in S3, e.g. s3://labsedata/model/labse.tar.gz
  readonly modelDataLocation?: string;
  // The AWS account with the Sagemaker endpoint the API should call. If not set, the current account is used.
  readonly hostingAccount?: string;
  // The memory size for the Sagemaker serverless endpoint (default 4096), see https://docs.aws.amazon.com/sagemaker/latest/dg/serverless-endpoints.html#serverless-endpoints-how-it-works-memory
  // 1024 MB, 2048 MB, 3072 MB, 4096 MB, 5120 MB, or 6144 MB
  readonly endpointMemorySize?: number;
  // The maximal number of concurrent invocations of the Sagemaker endpoint (default 2), see https://docs.aws.amazon.com/sagemaker/latest/dg/serverless-endpoints.html#serverless-endpoints-how-it-works-concurrency.
  readonly endpointMaxConcurrency?: number;
}

interface StageEnvironment extends cdk.StackProps {
  // The memory size of the lambda function(s).
  readonly memorySize?: number;
  // If true a dashboard gets created. Usually false for testing environments.
  readonly needsObservability: boolean;
  // If true a Redis cluster gets created and caching of sentence embeddings is enabled. Usually false for testing environments.
  readonly needsCaching: boolean;
  // Type of Redis node. Default is cache.t3.small.
  // See https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/CacheNodes.SupportedTypes.html
  readonly cacheNodeType?: string;
  // The name of the hosted zone that is already part of the AWS Account, e.g.
  // `samwise.howfm.io` or `production.howfm.io`
  readonly hostedZoneDomainName: string;
  readonly sagemakerOptions: SagemakerOptions;
}
```

### ModelBuildingStack

**Deployed Stages:**

- Production
- Develop

The [ModelBuildingStack](./infrastructure/src/model-building-stack.ts) first checks whether the ECR repository with the name specified in `modelDockerImage` exists in the current account and region and if not creates it. It then builds the [Docker container](./docker/Dockerfile.serve) in `/docker/Dockerfile.serve` that specifies how the model is hosted (see [Model Hosting](#model-hosting)). This docker image is then pushed to the repository where the respective tag is either the version of the Git repository generated by semantic-release in the CI process or the tag is `dev` when making a local deployment (see [Deployment](#deployment)).

The Docker image asset automatically recognizes when the Dockerfile has changed - and so its copied content from the `model` folder as well. So only in that case a new deployment is made.

If `modelDockerImage` is not set or a model version is not given by the `VERSION` environment variable, this stack is ignored.

### ModelServingStack

**Deployed Stages:**

- Production
- Develop

The [ModelServingStack](./infrastructure/src/model-serving-stack.ts) creates the Sagemaker Model, Endpoint Configuration, and Endpoint. The model as well as the Endpoint Configuration are always newly created and have the current timestamp in their name (`${endpointName}-MODEL-${time}` and `${endpointName}-CONFIG-${time}`). This is due to the fact, that these resources can not be updated but merely deleted and newly created. The model is based on the docker image created and pushed in the first step and the weights that are specified in `modelDataLocation`. The endpoint configuration is a [serverless configuration](https://docs.aws.amazon.com/sagemaker/latest/dg/serverless-endpoints.html), which can be configured with the `endpointMemorySize` (default 4096) and `endpointMaxConcurrency` (default 2) properties. Finally, the endpoint is created with the name specified in `endpointName`.

If `modelDockerImage`, a `VERSION` or `modelDataLocation` is not set, this stack is ignored.

This stack is mostly build according to [this template](https://github.com/aws-samples/amazon-sagemaker-model-serving-using-aws-cdk/blob/main/bin/stack/model-serving/model-serving-stack.ts).

### TranslationMatchingVPCStack

**Deployed Stages:**

- Production
- Develop

The [TranslationMatchingVPCStack](./infrastructure/src/vpc-stack.ts) creates a VPC with one private isolated subnet and one availability zone. Three security groups are associated to this VPC:

1. **Lambda Security Group**: For the Lambda. It allos outbound traffice to the Redis security group and the Sagemaker endpoint.
2. **Redis Security Group**: For the Redis cluster. It only allows inbound traffic from the Lambda security group.
3. **VPC Endpoint Security Group**: Security group for the VPC endpoint that enables a connection from the Lambda to the Sagemaker endpoint. It allows incoming traffic from the Lambda on port 443.

### TranslationMatchingRedisStack

**Deployed Stages:**

- Production
- Develop

The [TranslationMatchingRedisStack](./infrastructure/src/redis-stack.ts) is only created when `needsCaching` is set in the stage configuration. It creates a Redis cluster with a single node instance (so actually, it is not really a cluster).

### TranslationMatchingStack

**Deployed Stages:**

- all

The [TranslationMatchingStack](./infrastructure/src/translation-matching-stack.ts) is the actual API Lambda Stack. It creates one HTTP endpoint `/similarity` with the respective [source code](./lambdas/src/endpoints/similarity/similarity.ts). This code calls the respective Sagemaker Endpoint and returns its response. It also returns an optimal threshold to decide whether translations match or not. This threshold is hard-coded in the file and is set to 0.9 (`OPTIMAL_TRESHOLD = 0.9`).

The Hobbit accounts should typically not host their own Sagemaker Endpoint. You can specify the `hostingAccount` in the stage configuration and in this case a Sagemaker Runtime Client is started with respect to that other account (typically the DEV account). All Sagemaker Endpoint calls are then run against this endpoint from the other account.

The API is equipped with an [HttpIamAuthorizer](https://aws.amazon.com/blogs/compute/introducing-iam-and-lambda-authorizers-for-amazon-api-gateway-http-apis/), so it can only be called by other services in this account or with the respective authorization configured in the request (see [API Overview](#api-overview)).

### HowFMTranslationMatchingAPIObservabilityStack

**Deployed Stages:**

- Production
- Develop

The [HowFMTranslationMatchingAPIObservabilityStack](./infrastructure/src/observability.ts) creates an observability dashboard for the API. It is only created if `needsObservability` is set to `true` in the stage configuration.

Future versions might also add observability for the Sagemaker Endpoint.

## Model Hosting

The model is hosted as a Sagemaker Endpoint. The relevant Dockerfile can be found in `docker/Dockerfile.serve`. The entrypoint for the hosting is a [Flask](https://flask.palletsprojects.com/en/2.0.x/) API. Note that constructions using the Sagemaker inference toolkit are not working for the serverless case since the toolkit can only work with multi-model set-ups which are not supported by serverless inference at this moment. The model initialization and inference handling is defined in the [handler service](./model/src/inference/handler_service.py).

## Local Development

To test the API locally, you can run `make run_local_<hobbit>` (e.g. `make run_local_samwise`) or `make run_local_develop`. Local testing does not give any info if the infrastructure is set up correctly: For local testing the routes are configured manually via express, on AWS this happens via configuration of the API Gateway routes.

Remember to start the correct `aws-vault` shell with the respective account before running the local express server.

## Deployment

In order to make a manual manual deployment run `make deploy_develop` or `make deploy_<hobbit>`, e.g. `make deploy_samwise`. As stated above, in case of the develop account, the model serving Docker container is built and pushed to the regisitry with the tag `dev` and the Sagemaker Endpoint is updated accordingly.

## Types

The types from the OpenAPI spec get generated automatically via `make generate_code` into `lambdas/src/shared/types/generated`.

## The Model

The model itself is [LaBSE](https://arxiv.org/abs/2007.01852) (Language-agnostic BERT Sentence Embedding) by Google Research. The model weights are taken from [Hugging Face](https://huggingface.co/sentence-transformers/LaBSE) and uploaded to S3. The model is state of the art and trained on 109 languages. Please refer to the [notion page](https://www.notion.so/howfm/LaBSE-explained-c1e21be8346047f098ee6de0d8f042d0) of the project for a detailed explanation.
