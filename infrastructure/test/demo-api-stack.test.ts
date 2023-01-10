import * as cdk from "@aws-cdk/core";
import "jest-cdk-snapshot";
import * as Infrastructure from "../src/demo-api-stack";

test("DemoAPIStack", () => {
    const app = new cdk.App();
    // WHEN
    const stack = new Infrastructure.DemoAPIStack(app, "demo-api-testing", {
        env: { region: "eu-west-1", account: "123123123123" },
        memorySize: 1024,
        sagemakerEndpointName: "Test",
        hostedZoneDomainName: "test.example.com",
    });
    // THEN
    expect(stack).toMatchCdkSnapshot({
        ignoreAssets: true,
    });
});
