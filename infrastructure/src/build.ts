import { BuildOptions, buildSync } from "esbuild";
import * as path from "path";

const buildLambdas = (lambdas: string[]): void => {
    for (const lambdaDir of lambdas) {
        const lambdaPathAbs = path.join(__dirname, `../../lambdas/src/${lambdaDir}`);
        const buildOptions: BuildOptions = {
            platform: "node",
            target: "node14",
            bundle: true,
            define: { "process.env.NODE_ENV": `"production"` }, // must be double-quoted
            entryPoints: [`${lambdaPathAbs}/handler.ts`],
            logLevel: "warning",
            minify: true,
            outdir: `${lambdaPathAbs}/build`,
            sourcemap: true,
            metafile: true,
        };
        const buildResult = buildSync(buildOptions);
        if (buildResult.errors.length > 0) {
            throw new Error(buildResult.errors[0].detail);
        }

        const bundleSizeMB =
            // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
            buildResult.metafile?.outputs[`../lambdas/src/${lambdaDir}/build/handler.js`].bytes! / 1048576;
        console.log(`${lambdaDir}: BundleSize (MB) :>> `, (Math.round(bundleSizeMB * 100) / 100).toFixed(2));
    }
};

export { buildLambdas };
