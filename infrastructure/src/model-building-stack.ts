import { Stack, StackProps, aws_ecr_assets as ecrAssets } from "aws-cdk-lib";
import * as ecrdeploy from "cdk-ecr-deployment";
import * as path from "path";
import { Construct } from "constructs";

interface ModelBuildingStackProps extends StackProps {
    readonly modelDockerImage: string;
}

class ModelBuildingStack extends Stack {
    constructor(scope: Construct, id: string, props: ModelBuildingStackProps) {
        super(scope, id, props);
        const { env, modelDockerImage } = props;
        const accountId = env!.account!;
        const region = env!.region!;
        // Needed when building from M1 architecture.
        const platform = ecrAssets.Platform.LINUX_AMD64;
        const image = new ecrAssets.DockerImageAsset(this, "ServeDockerImage", {
            directory: path.join(__dirname, "../../model/"),
            file: "docker/Dockerfile.serve",
            platform: platform,
        });
        new ecrdeploy.ECRDeployment(this, "DeployDockerImage", {
            src: new ecrdeploy.DockerImageName(image.imageUri),
            dest: new ecrdeploy.DockerImageName(
                `${accountId}.dkr.ecr.${region}.amazonaws.com/${modelDockerImage}:latest`
            ),
        });
    }
}

export { ModelBuildingStack };
