/// <reference types="@types/jest" />
/* eslint-disable no-control-regex */

import path from 'path';
import fs from 'fs-extra';
import memfs from 'memfs';
import jwt from 'jsonwebtoken';
import { rspack } from '@rspack/core';
import {
  CodeSigningPlugin,
  CodeSigningPluginConfig,
} from '../CodeSigningPlugin';

jest.mock('fs-extra', () => ({
  ...jest.requireActual('fs-extra'),
  writeFile: jest.fn(),
}));

const BUNDLE_WITH_JWT_REGEX =
  /^(.+)?\/\* RCSSB \*\/(?:[\w-]*\.){2}[\w-]*(\x00)*$/m;

async function compileBundle(
  outputFilename: string,
  virtualModules: Record<string, string>,
  codeSigningConfig: CodeSigningPluginConfig
) {
  const fileSystem = memfs.createFsFromVolume(new memfs.Volume());

  for (const [name, content] of Object.entries(virtualModules)) {
    await fileSystem.promises.writeFile(`/${name}`, content);
  }

  const compiler = rspack({
    context: __dirname,
    mode: 'production',
    devtool: false,
    entry: './index.js',
    output: {
      filename: outputFilename,
      path: '/out',
      library: 'Export',
      chunkFilename: '[name].chunk.bundle',
    },
    plugins: [new CodeSigningPlugin(codeSigningConfig)],
  });

  // @ts-ignore
  fs.writeFile.mockImplementation(fileSystem.promises.writeFile);

  // @ts-expect-error memfs is compatible enough
  compiler.outputFileSystem = fileSystem;
  /**
   * Replacing inputFileSystem is not supported yet
   * Tracked here: https://github.com/web-infra-dev/rspack/issues/5091
   */
  compiler.inputFileSystem = fileSystem;

  return await new Promise<{
    fileSystem: typeof memfs.fs;
    getBundle: (name: string) => Buffer;
  }>((resolve, reject) =>
    compiler.run((error) => {
      if (error) {
        reject(error);
      } else {
        resolve({
          fileSystem,
          getBundle: (name: string) =>
            fileSystem.readFileSync(`/out/${name}`) as Buffer,
        });
      }
    })
  );
}

// TODO Fix when input filesystem is supported
describe.skip('CodeSigningPlugin', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('adds code-signing signatures to chunk files', async () => {
    const { getBundle } = await compileBundle(
      'index.bundle',
      {
        'index.js': `
          const chunk = import(/* webpackChunkName: "myChunk" */'./myChunk'); 
          chunk.then(console.log);
        `,
        'myChunk.js': `
          export default 'myChunk';
        `,
      },
      { enabled: true, privateKeyPath: '__fixtures__/testRS256.pem' }
    );

    const chunkBundle = getBundle('myChunk.chunk.bundle');
    expect(chunkBundle.toString().match(BUNDLE_WITH_JWT_REGEX)).toBeTruthy();
    expect(chunkBundle.length).toBeGreaterThan(1280);
  });

  it('produces code-signed bundles with valid JWTs', async () => {
    const publicKey = fs.readFileSync(
      path.join(__dirname, '__fixtures__/testRS256.pem.pub')
    );

    const { getBundle } = await compileBundle(
      'index.bundle',
      {
        'index.js': `
          const signed1 = import(/* webpackChunkName: "firstSignedChunk" */'./firstSignedChunk'); 
          signed1.then(console.log);

          const signed2 = import(/* webpackChunkName: "secondSignedChunk" */'./secondSignedChunk'); 
          signed2.then(console.log);
        `,
        'firstSignedChunk.js': `
          export default 'firstSignedChunk';
        `,
        'secondSignedChunk.js': `
          export default 'secondSignedChunk';
        `,
      },
      { enabled: true, privateKeyPath: '__fixtures__/testRS256.pem' }
    );

    const bundles = [
      getBundle('firstSignedChunk.chunk.bundle'),
      getBundle('secondSignedChunk.chunk.bundle'),
    ];

    const jwts = bundles.map((content) =>
      content.toString().split('/* RCSSB */')[1].replace(/\0/g, '')
    );

    let payload: jwt.JwtPayload;
    jwts.forEach((bundleJWT) => {
      expect(() => {
        payload = jwt.verify(bundleJWT, publicKey) as jwt.JwtPayload;
      }).not.toThrow();
      expect(payload).toHaveProperty('hash');
    });
  });

  it('skips applying plugin when enabled flag is explicitly set to false', async () => {
    const { getBundle } = await compileBundle(
      'index.bundle',
      {
        'index.js': `
          const chunk = import(/* webpackChunkName: "myChunk" */'./myChunk'); 
          chunk.then(console.log);
        `,
        'myChunk.js': `
          export default 'myChunk';
        `,
      },
      { enabled: false, privateKeyPath: '__fixtures__/testRS256.pem' }
    );

    const chunkBundle = getBundle('myChunk.chunk.bundle');
    expect(chunkBundle.toString().match(BUNDLE_WITH_JWT_REGEX)).toBeNull();
  });

  it('excludes main output bundle from code-signing', async () => {
    const { getBundle } = await compileBundle(
      'index.bundle',
      {
        'index.js': `
          const chunk = import(/* webpackChunkName: "myChunk" */'./myChunk'); 
          chunk.then(console.log);
        `,
        'myChunk.js': `
          export default 'myChunk';
        `,
      },
      { enabled: true, privateKeyPath: '__fixtures__/testRS256.pem' }
    );

    const mainBundle = getBundle('index.bundle');
    expect(mainBundle.toString().match(BUNDLE_WITH_JWT_REGEX)).toBeNull();
  });

  it('excludes additional chunks specified in config from code-signing', async () => {
    const { getBundle } = await compileBundle(
      'index.bundle',
      {
        'index.js': `
          const chunk = import(/* webpackChunkName: "myChunk" */'./myChunk'); 
          chunk.then(console.log);

          const noSign = import(/* webpackChunkName: "noSign" */'./noSign');
          noSign.then(console.log);
        `,
        'myChunk.js': `
          export default 'myChunk';
        `,
        'noSign.js': `
          export default 'noSign';
        `,
      },
      {
        enabled: true,
        privateKeyPath: '__fixtures__/testRS256.pem',
        excludeChunks: /noSign/,
      }
    );

    const signedChunk = getBundle('myChunk.chunk.bundle');
    expect(signedChunk.toString().match(BUNDLE_WITH_JWT_REGEX)).toBeTruthy();
    const unsignedChunk = getBundle('noSign.chunk.bundle');
    expect(unsignedChunk.toString().match(BUNDLE_WITH_JWT_REGEX)).toBeNull();
  });

  it('throws an error when privateKey is not found in the filesystem', async () => {
    await expect(
      compileBundle(
        'index.bundle',
        { 'index.js': `var a = 'test';` },
        { enabled: true, privateKeyPath: '__fixtures__/missing.key' }
      )
    ).rejects.toThrow(/ENOENT.*missing\.key/);
  });

  it('throws an error when schema is invalid', async () => {
    await expect(
      compileBundle(
        'index.bundle',
        { 'index.js': `var a = 'test';` },
        // @ts-expect-error invalid config on purpose
        { enabled: true }
      )
    ).rejects.toThrow(/Invalid configuration object/);
  });
});
