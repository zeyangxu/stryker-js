require('source-map-support/register');
const log4js = require('log4js');
const { createMochaTestRunner } = require('../mocha-runner');
const { createInjector } = require('typed-inject');

const logger = log4js.getLogger();
const mochaRunner = createInjector().provideValue('logger', logger).provideValue('options', {
  mochaOptions: {
    spec: ['test/helpers/**/*.js', 'test/unit/**/*.js']
  }
}).injectFunction(createMochaTestRunner);

async function main() {
  await mochaRunner.init();
  await infinyRun(0);
}

async function infinyRun(n) {
  console.time(++n);
  await mochaRunner.dryRun({ coverageAnalysis: 'off', timeout: 30000 });
  console.timeEnd(n);
  await infinyRun(n);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
