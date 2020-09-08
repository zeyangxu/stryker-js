const path = require('path');
const settings = require('../../stryker.parent.conf');
const moduleName = __dirname.split(path.sep).pop();
settings.dashboard.module = moduleName;
settings.checkers = [];
settings.plugins = settings.plugins.map(plugin => path.resolve(plugin));
settings.mochaOptions = {
  spec: ['test/helpers/**/*.js', 'test/unit/**/*.js']
}
module.exports = settings;
