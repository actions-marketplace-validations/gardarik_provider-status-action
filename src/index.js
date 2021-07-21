process.env.FORCE_COLOR = '2';

const core = require('@actions/core');
const status = require('./const');
const chalk = require('chalk');

const dispatcher = require('./dispatcher');

const provs = '';

const dispatch = async (providers) => {
  const providerObj = dispatcher.dispatchProviders(providers);
  const calls = [];
  for (const [prov, pIdentifiers] of Object.entries(providerObj)) {
    calls.push(dispatcher.runProviderStatusCheck(prov, pIdentifiers));
  }
  const results = await Promise.allSettled(calls);
  return results;
};

(async () => {
  try {
    const failwarn_input = core.getInput('fail_on_warning') || 'false';
    const FAIL_ON_WARNING = failwarn_input.toLowerCase() == 'true';
    let providers = core.getInput('providers')
      ? core.getInput('providers').split('\n')
      : provs.split('\n');
    providers = providers.map((el) => el.trim()).filter((el) => el.length);

    if (providers.length) {
      const result = await dispatch(providers);
      const res1 = result
        .filter((x) => x.status === 'fulfilled')
        .map((x) => x.value);
      const res2 = [].concat.apply([], res1);
      const allResult = res2.map((x) => x.value);
      let SUCCESS = true;
      let MSG = '';
      allResult.forEach((stat) => {
        const message = ` [${stat.provider.toUpperCase()} ${stat.service}] `;
        switch (stat.status) {
          default:
          case status.STATUS_OK:
            core.info(
              chalk.green(
                chalk.bold(status.ICON_OK) + message + chalk.bold(stat.message)
              )
            );
            break;

          case status.STATUS_WARNING:
            core.warning(
              chalk.yellow(
                chalk.bold(status.ICON_WARNING) +
                  message +
                  chalk.bold(stat.message)
              )
            );
            if (FAIL_ON_WARNING && SUCCESS) {
              SUCCESS = false;
              MSG = message + stat.message;
            }
            break;

          case status.STATUS_ERROR:
            core.error(
              chalk.red(
                chalk.bold(status.ICON_ERROR) +
                  message +
                  chalk.bold(stat.message)
              )
            );
            if (SUCCESS) {
              SUCCESS = false;
              MSG = message + stat.message;
            }
            break;
        }
      });
      if (!SUCCESS) {
        throw new Error(MSG);
      }
    } else {
      core.warning(
        chalk.yellow(
          chalk.bold(status.ICON_WARNING) +
            chalk.bold(`Invaid or empty "providers" parameter`)
        )
      );
    }
  } catch (error) {
    core.setFailed(error.message);
  }
})();