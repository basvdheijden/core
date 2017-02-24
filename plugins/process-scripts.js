'use strict';

const _ = require('lodash');

const Plugin = require('../classes/plugin');
const Script = require('../classes/script');

class ProcessScripts extends Plugin {
  /**
   * Initialize plugin.
   */
  constructor(models, storage) {
    super(models, storage);
    this.analyseModels();
  }

  /**
   * Loop though models to find cascading fields.
   */
  analyseModels() {
    this.data = {};
    this.postprocessors = [];
    this.preprocessors = [];
    Object.keys(this.models).forEach(modelName => {
      if (this.models[modelName].jsonSchema.preprocess instanceof Array) {
        this.preprocessors.push(modelName);
      }
      if (this.models[modelName].jsonSchema.postprocess instanceof Array) {
        this.postprocessors.push(modelName);
      }
    });
  }

  process(models, model, operation, params, name) {
    return new Script({
      name: `${operation}${model.name}:${name}`,
      steps: this.models[model.name].jsonSchema[name]
    }, this.storage).run({
      operation,
      params
    }).then(response => response.params);
  }

  /**
   * List models that this plugin does Preprocessing for.
   */
  getPreprocessors() {
    return this.preprocessors;
  }

  /**
   * Execute preprocessing.
   */
  preprocess(models, model, operation, params) {
    return this.process(models, model, operation, params, 'preprocess');
  }

  /**
   * List models that this plugin does postprocessing for.
   */
  getPostprocessors() {
    return this.postprocessors;
  }

  /**
   * Execute postprocessing.
   */
  postprocess(models, model, operation, params) {
    return this.process(models, model, operation, params, 'postprocess');
  }
}

module.exports = ProcessScripts;
