import path from "node:path";
import fs from "node:fs/promises";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

type ServerCompiler = {
  outputPath: string;
  hooks: {
    afterEmit: {
      tapPromise: (name: string, handler: () => Promise<void>) => void;
    };
  };
};

export default function createNextConfig(phase: string): NextConfig {
  const isDevServer = phase === PHASE_DEVELOPMENT_SERVER;

  return {
    typedRoutes: true,
    outputFileTracingRoot: __dirname,
    // Keep development and production outputs separate so switching between
    // `next dev` and `next start` does not leave the browser requesting stale chunks.
    distDir: isDevServer ? ".next-dev" : ".next",
    // Tell Next.js to require() these packages from node_modules at runtime
    // instead of bundling them — pdf-parse/pdfjs-dist break when webpack
    // processes them (Object.defineProperty on frozen exports).
    serverExternalPackages: ["pdf-parse", "canvas"],
    webpack: (config, { isServer }) => {
      if (isServer) {

        config.plugins = config.plugins ?? [];
        config.plugins.push({
          apply(compiler: ServerCompiler) {
            compiler.hooks.afterEmit.tapPromise(
              "MirrorServerChunksPlugin",
              async () => {
                const outputPath = compiler.outputPath;
                const chunksDir = path.join(outputPath, "chunks");

                let chunkFiles: string[] = [];
                try {
                  chunkFiles = await fs.readdir(chunksDir);
                } catch {
                  return;
                }

                await Promise.all(
                  chunkFiles
                    .filter((fileName) => fileName.endsWith(".js"))
                    .map((fileName) =>
                      fs.copyFile(
                        path.join(chunksDir, fileName),
                        path.join(outputPath, fileName)
                      )
                    )
                );
              }
            );
          },
        });
      }

      return config;
    },
  };
}
