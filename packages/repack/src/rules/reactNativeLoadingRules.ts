import type { RuleSetRule } from '@rspack/core';
import { REACT_NATIVE_LAZY_IMPORTS } from './lazyImports';

export const REACT_NATIVE_LOADING_RULES: RuleSetRule = {
  test: /\.jsx?$/,
  include: [
    // classic paths
    /node_modules(.*[/\\])+react-native[/\\]/,
    /node_modules(.*[/\\])+@react-native[/\\]/,
    // classic paths for OOT
    /node_modules(.*[/\\])+react-native-macos[/\\]/,
    /node_modules(.*[/\\])+react-native-windows[/\\]/,
    /node_modules(.*[/\\])+react-native-tvos[/\\]/,
    /node_modules(.*[/\\])+@callstack[/\\]react-native-visionos[/\\]/,
    // exotic paths (e.g. pnpm)
    /node_modules(.*[/\\])+react-native@/,
    /node_modules(.*[/\\])+@react-native\+/,
    // exotic paths for OOT
    /node_modules(.*[/\\])+react-native-macos@/,
    /node_modules(.*[/\\])+react-native-windows@/,
    /node_modules(.*[/\\])+react-native-tvos@/,
    /node_modules(.*[/\\])+@callstack\+react-native-visionos@/,
  ],
  use: [
    {
      loader: 'builtin:swc-loader',
      options: {
        env: {
          targets: { 'react-native': '0.74' },
        },
        jsc: {
          parser: {
            syntax: 'ecmascript',
            jsx: true,
            exportDefaultFrom: true,
          },
          externalHelpers: true,
        },
        module: {
          type: 'commonjs',
          strict: false,
          strictMode: false,
          lazy: REACT_NATIVE_LAZY_IMPORTS,
        },
      },
    },
    {
      loader: '@callstack/repack/flow-loader',
      options: {
        /**
         *  Transforming React-Native requires us to use the `all` option, which
         *  removes all Flow annotations, as not all files are marked with `@flow`
         *  pragma.
         */
        all: true,
        /*
         *  IgnoreUninitializedFields is required to avoid errors (most notably in
         *  places where event-target-shim is used) that occur when Flow types are
         *  stripped from uninitialized fields. This flag removes the uninitialized
         *  fields from the output. This can be fixed by using `declare` in front of them.
         */
        ignoreUninitializedFields: true,
      },
    },
  ],
  type: 'javascript/auto',
};
