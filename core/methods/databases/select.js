'use strict';

const {get, union, intersection} = require('lodash');
const {Op, fn, col} = require('sequelize');

module.exports = {
  title: 'Select',
  description: 'Select objects from the database',

  inputSchema: {
    type: 'object',
    properties: {
      model: {
        title: 'modelname',
        type: 'string'
      },
      filters: {
        title: 'Selection criteria',
        type: 'object'
      },
      offset: {
        title: 'Offset',
        type: 'integer',
        minimum: 0
      },
      limit: {
        title: 'Limit',
        type: 'integer',
        minimum: 1
      },
      order: {
        title: 'Order',
        type: 'array',
        items: {
          title: 'Order',
          type: 'object',
          properties: {
            field: {
              title: 'Field',
              type: 'string',
              maxLength: 255
            },
            direction: {
              title: 'Direction',
              type: 'string',
              enum: ['ASC', 'DESC']
            }
          },
          required: ['field']
        }
      },
      selections: {
        title: 'Selected fields',
        type: 'object'
      }
    },
    required: ['model'],
    additionalProperties: false
  },

  requires: ['Database', 'Models', 'Immutable'],

  unary: async (left, {Database, Models, Immutable}) => {
    const {filters, model, offset, limit, order, selections} = left.toJS();
    const where = Object.keys(filters || {}).reduce((prev, name) => {
      const match = name.match(/^(.+)_(ne|gt|gte|lt|lte|like|notLike|in|notIn)$/);
      let field = name;
      let operator = 'eq';
      if (match) {
        field = match[1];
        operator = match[2];
      }
      return {
        ...prev,
        [field]: {
          [Op[operator]]: filters[name]
        }
      };
    }, {});

    const modelInstance = await Models.get(model);
    const db = Database.get(model);
    const output = {};

    // Get attributes that we need to fetch from the database.
    let attributes = union(Object.keys(modelInstance.properties), ['id']);
    if (selections) {
      // If a selections object was provided, select only fields that appear in both the
      // model and the selections, but do always include "id".
      const selectedFields = union(Object.keys(get(selections, 'items', {}) || {}), ['id']);
      attributes = intersection(attributes, selectedFields);
    }

    output.items = (await db.findAll({
      attributes,
      where,
      limit: limit || 10,
      offset: offset || 0,
      order: (order || []).map(({field, direction}) => [field, direction || 'ASC'])
    })).map(item => item.dataValues);

    if (Object.keys(selections || {}).indexOf('count') >= 0) {
      output.count = (await db.findAll({
        attributes: [[fn('COUNT', col('id')), 'count']],
        where
      }))[0].dataValues.count;
    }

    // Parse JSON fields.
    output.items.forEach(item => {
      attributes.forEach(field => {
        if (item[field] && typeof modelInstance.properties[field] === 'object' && ['object', 'array'].indexOf(modelInstance.properties[field].type) >= 0) {
          item[field] = JSON.parse(item[field]);
        }
      });
    });

    return Immutable.fromJS(output);
  }
};
