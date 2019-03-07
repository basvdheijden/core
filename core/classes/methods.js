'use strict';

const {resolve} = require('path');
const {camelCase} = require('lodash');
const globby = require('globby');
const Watch = require('watch');
const {Unauthorized, Forbidden} = require('http-errors');
const reload = require('require-reload')(require);

class Methods {
  constructor({Config, MethodTester, Container, Graphql, Encrypt, Log}) {
    this.config = Config;
    this.methodTester = MethodTester;
    this.container = Container;
    this.graphql = Graphql;
    this.encrypt = Encrypt;
    this.log = Log;
    this.methods = {};
    this.methodsDir = Config.get('/methodsDir', 'methods');
  }

  async readFiles(changedFile) {
    const files = (await globby(['core/methods/**/*.js', this.methodsDir + '/**/*.js'])).filter(filename => {
      return !filename.endsWith('.test.js');
    });
    const output = {};
    const promises = [];
    files.forEach(file => {
      const filename = resolve(file);
      const name = filename.match(/\/([^/]+)\.js$/)[1];
      try {
        const loaded = reload(filename);
        const id = loaded.id || camelCase(name);
        this.methods[id] = loaded;
        if (file === changedFile) {
          promises.push(this.methodTester.test(this.methods[id], filename, false));
        }
      } catch (err) {
        this.log.error(`Unable to load ${name}: ${err.message}`);
      }
    });
    await Promise.all(promises);
    return output;
  }

  async startup() {
    await this.readFiles();
    if (this.config.get('/reload', false)) {
      const callback = changedFile => {
        if (typeof changedFile !== 'string') {
          return;
        }
        changedFile = changedFile = changedFile.replace(/\.test\.js$/, '.js');
        this.log.info('Reloading methods');
        this.readFiles(changedFile);
      };
      Watch.watchTree('core/methods', callback);
      Watch.watchTree('methods', callback);
    }
  }

  async shutdown() {
    if (this.config.get('/reload', false)) {
      Watch.unwatchTree('core/methods');
      Watch.unwatchTree('methods');
    }
  }

  getNames() {
    return Object.keys(this.methods);
  }

  async get(name) {
    if (typeof this.methods[name] === 'undefined') {
      throw new TypeError(`No method found with name "${name}"`);
    }
    return this.methods[name];
  }

  getBinaryMethod(name) {
    const method = this.methods[name];
    if (typeof method === 'undefined') {
      throw new TypeError(`No method found with name "${name}"`);
    }
    if (typeof method.binary !== 'function') {
      throw new TypeError(`Method "${name}" cannot be used as binary operator`);
    }
    const callback = async (left, right, context) => {
      const dependencies = await this.loadDependencies(method);
      return method.binary(left, right, dependencies, context);
    };
    callback.lazy = method.lazy || false;
    return callback;
  }

  getUnaryMethod(name) {
    const method = this.methods[name];
    if (typeof method === 'undefined') {
      throw new TypeError(`No method found with name "${name}"`);
    }
    if (typeof method.unary !== 'function') {
      throw new TypeError(`Method "${name}" cannot be used as unary operator`);
    }
    const callback = async (operand, context) => {
      const dependencies = await this.loadDependencies(method);
      return method.unary(operand, dependencies, context);
    };
    callback.lazy = method.lazy || false;
    return callback;
  }

  async loadDependencies(method) {
    const dependencies = {};
    const promises = (method.requires || []).map(name => {
      return this.container.get(name);
    });
    (await Promise.all(promises)).forEach((item, index) => {
      dependencies[method.requires[index]] = item;
    });
    return dependencies;
  }
}

Methods.singleton = true;
Methods.require = ['Config', 'MethodTester', 'Container', 'Graphql', 'Encrypt', 'Log'];

module.exports = Methods;
