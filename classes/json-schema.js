'use strict';

const {cloneDeep} = require('lodash');
const validator = require('is-my-json-valid');

class JsonSchema {
  constructor() {
    this.schemaSchema = {
      oneOf: [{
        // String.
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['string']
          },
          name: {
            type: 'string'
          },
          minLength: {
            type: 'integer',
            minimum: 0
          },
          maxLength: {
            type: 'integer',
            minimum: 0
          },
          pattern: {
            type: 'string'
          },
          format: {
            type: 'string',
            enum: ['jsonpointer', 'date-time', 'date', 'time', 'email', 'hostname', 'ipv4', 'ipv6', 'uri']
          },
          enum: {
            type: 'array',
            items: {type: 'string'},
            minItems: 1
          }
        },
        additionalProperties: false,
        required: ['name', 'type']
      }, {
        // Number, integer.
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['number', 'integer']
          },
          name: {
            type: 'string'
          },
          minimum: {
            type: 'number'
          },
          maximum: {
            type: 'number'
          }
        },
        additionalProperties: false,
        required: ['type', 'name']
      }, {
        // Boolean.
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['boolean']
          },
          name: {
            type: 'string'
          }
        },
        additionalProperties: false,
        required: ['type', 'name']
      }, {
        // Null.
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['null']
          }
        },
        additionalProperties: false,
        required: ['type']
      }, {
        // Array.
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['array']
          },
          name: {
            type: 'string'
          },
          items: {
            $ref: '#'
          },
          minItems: {
            type: 'integer',
            minimum: 0
          },
          maxItems: {
            type: 'integer',
            minimum: 0
          }
        },
        additionalProperties: false,
        required: ['type']
      }, {
        // Object.
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['object']
          },
          name: {
            type: 'string'
          },
          properties: {
            type: 'object',
            additionalProperties: {
              $ref: '#'
            }
          },
          required: {
            type: 'array',
            items: {type: 'string'}
          },
          additionalProperties: {
            oneOf: [{
              type: 'boolean'
            }, {
              $ref: '#'
            }]
          }
        },
        additionalProperties: false,
        required: ['type']
      }, {
        type: 'object',
        properties: {
          name: {
            type: 'string'
          },
          $ref: {
            type: 'string'
          }
        },
        required: ['name'],
        additionalProperties: false
      }],
      definitions: {
        Script: {
          type: 'array'
        }
      }
    };

    this.plainSchema = {
      oneOf: this.schemaSchema.oneOf.map(schema => {
        const newSchema = cloneDeep(schema);
        if (newSchema.required) {
          newSchema.required = newSchema.required.filter(name => name !== 'name');
        }
        return newSchema;
      })
    };

    this.validatePlainSchema = validator(this.plainSchema);
    this.validateSchema = validator(this.schemaSchema);
  }

  validate(input, includeNames) {
    let valid;
    let error;
    if (includeNames) {
      valid = this.validateSchema(input);
      error = this.validateSchema.error;
    } else {
      valid = this.validatePlainSchema(input);
      error = this.validatePlainSchema.error;
    }
    return valid || error;
  }
}

JsonSchema.singleton = true;
JsonSchema.requires = [];

module.exports = JsonSchema;
