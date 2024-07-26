const path = require('path');
const { createRequire } = require('module');

function getCommands() {
  let cliPath;

  try {
    cliPath = path.dirname(require.resolve('@react-native-community/cli'));
  } catch {
    // NOOP
  }

  try {
    cliPath = path.dirname(
      require.resolve('react-native/node_modules/@react-native-community/cli')
    );
  } catch {
    // NOOP
  }

  try {
    const rnRequire = createRequire(require.resolve('react-native'));
    cliPath = path.dirname(rnRequire.resolve('@react-native-community/cli'));
  } catch {
    // NOOP
  }

  const { projectCommands } = require(`${cliPath}/commands`);
  const commandNames = Object.values(projectCommands).map(({ name }) => name);

  if (commandNames.includes('bundle') && commandNames.includes('start')) {
    return projectCommands;
  }

  // RN >= 0.73
  let commands;

  try {
    commands = require(
      require.resolve('react-native/react-native.config.js')
    ).commands;
  } catch (e) {
    // NOOP
  }

  if (!commands) {
    throw new Error('Cannot resolve path to react-native package');
  }

  return commands;
}

const startCommandOptions = [
  {
    name: '--cert <path>',
    description: 'Path to custom SSL cert',
  },
  {
    name: '--host <string>',
    description: 'Set the server host',
    default: '',
  },
  {
    name: '--https',
    description: 'Enables https connections to the server',
  },
  {
    name: '--key <path>',
    description: 'Path to custom SSL key',
  },
  {
    name: '--port <number>',
    description: 'The port number that runs the server on',
  },
  {
    name: '--no-interactive',
    description: 'Disables interactive mode',
  },
  {
    name: '--silent',
    description: 'Silents all logs to the console/stdout',
  },
  {
    name: '--experimental-debugger',
    description:
      '[Experimental] Enable the new debugger experience. Connection reliability and some basic features are unstable in this release.',
  },
  {
    name: '--silent',
    description: 'Silents all logs to the console/stdout',
  },
  {
    name: '--json',
    description: 'Log all messages to the console/stdout in JSON format',
  },
  {
    name: '--reverse-port',
    description: 'ADB reverse port on starting devServers only for Android',
  },
  {
    name: '--log-file <path>',
    description: 'Enables file logging to specified file',
  },
];

const bundleCommandOptions = [
  {
    name: '--assets-dest <path>',
    description:
      'Directory name where to store assets referenced in the bundle',
  },
  {
    name: '--entry-file <path>',
    description:
      'Path to the root JS file, either absolute or relative to JS root',
  },
  {
    name: '--minify',
    description:
      'Allows overriding whether bundle is minified. This defaults to false if dev is true, and true if dev is false. Disabling minification can be useful for speeding up production builds for testing purposes.',
  },
  {
    name: '--dev [boolean]',
    description:
      'Enables development warnings and disables production optimisations',
    default: true,
  },
  {
    name: '--bundle-output <path>',
    description:
      'File name where to store the resulting bundle, ex. /tmp/groups.bundle',
  },

  {
    name: '--sourcemap-output <path>',
    description:
      'File name where to store the sourcemap file for resulting bundle, ex. /tmp/groups.map',
  },
  {
    name: '--platform <path>',
    description: 'Either "ios" or "android" (default: "ios")',
  },
  {
    name: '--reset-cache',
    description: 'Removes cached files (default: false)',
  },
  {
    name: '--json <statsFile>',
    description: 'Stores stats in a file.',
    parse: (val) => path.resolve(val),
  },
  {
    name: '--stats <preset>',
    description:
      'It instructs Webpack on how to treat the stats:\n' +
      "'errors-only'  - only output when errors happen\n" +
      "'errors-warnings' - only output errors and warnings happen\n" +
      "'minimal' - only output when errors or new compilation happen\n" +
      "'none' - output nothing\n" +
      "'normal' - standard output\n" +
      "'verbose' - output everything\n" +
      "'detailed' - output everything except chunkModules and chunkRootModules\n" +
      "'summary' - output webpack version, warnings count and errors count",
  },
];

const cliCommands = Object.values(getCommands());

const startCommand = cliCommands.find(({ name }) => name === 'start');
const bundleCommand = cliCommands.find(({ name }) => name === 'bundle');

const webpackConfigOption = {
  name: '--webpackConfig <path>',
  description: 'Path to a Webpack config',
  parse: (val) => path.resolve(val),
  default: (config) => {
    const {
      getConfigFilePath,
    } = require('./dist/commands/utils/getConfigFilePath');

    try {
      return getConfigFilePath(config.root);
    } catch {
      return '';
    }
  },
};

const commands = [
  {
    name: 'bundle',
    description: bundleCommand.description,
    options: bundleCommandOptions.concat(webpackConfigOption),
    func: require('./dist/commands/bundle').bundle,
  },
  {
    name: 'start',
    options: startCommandOptions.concat(webpackConfigOption),
    description: startCommand.description,
    func: require('./dist/commands/start').start,
  },
];

const webpackCommands = commands.map((command) => ({
  ...command,
  name: `webpack-${command.name}`,
}));

module.exports = [...commands, ...webpackCommands];
