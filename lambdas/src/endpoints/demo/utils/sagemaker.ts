import { InvokeEndpointCommand, SageMakerRuntimeClient } from "@aws-sdk/client-sagemaker-runtime";

const getSagemakerPredictions = async (
    inputs: string[],
    endpointName: string,
    sagemakerClient: SageMakerRuntimeClient,
): Promise<number[][]> => {
    const sagemakerBodySource = {
        inputs: inputs,
    };
    const params = {
        Body: new TextEncoder().encode(JSON.stringify(sagemakerBodySource)),
        EndpointName: endpointName,
    };
    const command = new InvokeEndpointCommand(params);
    const sagemakerData = await sagemakerClient.send(command);
    const sagemakerResponse = JSON.parse(new TextDecoder().decode(sagemakerData.Body));
    return sagemakerResponse["predictions"];
};

export { getSagemakerPredictions };
