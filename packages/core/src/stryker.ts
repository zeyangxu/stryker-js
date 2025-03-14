import { PartialStrykerOptions } from '@stryker-mutator/api/core';
import { MutantResult } from '@stryker-mutator/api/report';
import { createInjector } from 'typed-inject';

import { commonTokens } from '@stryker-mutator/api/plugin';

import { LogConfigurator } from './logging';
import { PrepareExecutor, MutantInstrumenterExecutor, DryRunExecutor, MutationTestExecutor } from './process';
import { coreTokens, provideLogger } from './di';
import { retrieveCause, ConfigError } from './errors';

/**
 * The main Stryker class.
 * It provides a single `runMutationTest()` function which runs mutation testing:
 */
export class Stryker {
  /**
   * @constructor
   * @param cliOptions The cli options.
   * @param injectorFactory The injector factory, for testing purposes only
   */
  constructor(private readonly cliOptions: PartialStrykerOptions, private readonly injectorFactory = createInjector) {}

  public async runMutationTest(): Promise<MutantResult[]> {
    const rootInjector = this.injectorFactory();
    const loggerProvider = provideLogger(rootInjector);

    try {
      // 1. Prepare. Load Stryker configuration, load the input files and starts the logging server
      const prepareExecutor = loggerProvider.provideValue(coreTokens.cliOptions, this.cliOptions).injectClass(PrepareExecutor);
      const mutantInstrumenterInjector = await prepareExecutor.execute();

      try {
        // 2. Mutate and instrument the files and write to the sandbox.
        const mutantInstrumenter = mutantInstrumenterInjector.injectClass(MutantInstrumenterExecutor);
        const dryRunExecutorInjector = await mutantInstrumenter.execute();

        // 3. Perform a 'dry run' (initial test run). Runs the tests without active mutants and collects coverage.
        const dryRunExecutor = dryRunExecutorInjector.injectClass(DryRunExecutor);
        const mutationRunExecutorInjector = await dryRunExecutor.execute();

        // 4. Actual mutation testing. Will check every mutant and if valid run it in an available test runner.
        const mutationRunExecutor = mutationRunExecutorInjector.injectClass(MutationTestExecutor);
        const mutantResults = await mutationRunExecutor.execute();

        return mutantResults;
      } catch (error) {
        const log = loggerProvider.resolve(commonTokens.getLogger)(Stryker.name);
        log.debug('Not removing the temp dir because an error occurred');
        mutantInstrumenterInjector.resolve(coreTokens.temporaryDirectory).removeDuringDisposal = false;
        throw error;
      }
    } catch (error) {
      const log = loggerProvider.resolve(commonTokens.getLogger)(Stryker.name);
      const cause = retrieveCause(error);
      if (cause instanceof ConfigError) {
        log.error(cause.message);
      } else {
        log.error('Unexpected error occurred while running Stryker', error);
        if (!log.isTraceEnabled()) {
          log.info('Trouble figuring out what went wrong? Try `npx stryker run --fileLogLevel trace --logLevel debug` to get some more info.');
        }
      }
      throw cause;
    } finally {
      await rootInjector.dispose();
      await LogConfigurator.shutdown();
    }
  }
}
