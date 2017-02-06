/* eslint-env node, mocha */
'use strict';

const Promise = require('bluebird');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const expect = chai.expect;

const Storage = require('../classes/storage');
const Context = require('../classes/context');

describe('Context', () => {
  let storage;
  let temporary = {};

  let regularUser1;
  let regularUser2;
  let adminUser;

  before(() => {
    storage = new Storage({
      modelsDir: 'test/models',
      databases: {
        internal: {
          engine: 'redis',
          host: 'localhost',
          port: 6379,
          prefix: ''
        },
        rethink: {
          engine: 'RethinkDB',
          host: 'localhost',
          port: 28015,
          name: 'test'
        }
      }
    });
    const promises = [];
    let query;
    let promise;
    query = `{user:createUser(name: "Alice", mail: "alice@example.com") { id }}`;
    promise = storage.query(query).then(result => {
      regularUser1 = result.user.id;
    });
    promises.push(promise);
    query = `{user:createUser(name: "Bob", mail: "bob@example.com") { id }}`;
    promise = storage.query(query).then(result => {
      regularUser2 = result.user.id;
    });
    promises.push(promise);
    query = `{user:createUser(name: "Chris", mail: "chris@example.com", admin: {}) { id }}`;
    promise = storage.query(query).then(result => {
      adminUser = result.user.id;
    });
    promises.push(promise);
    return Promise.all(promises);
  });

  after(() => {
    return Promise.all([
      storage.query('{deleteUser(id:$id)}', {id: regularUser1}),
      storage.query('{deleteUser(id:$id)}', {id: regularUser2}),
      storage.query('{deleteUser(id:$id)}', {id: adminUser})
    ]);
  });

  it('can get current user profile', () => {
    const context = new Context();
    context.setUser({id: regularUser1});
    const query = `{
      User {
        id
        name
      }
    }`;
    return storage.query(query, context).then(result => {
      expect(result.User).to.have.property('id', regularUser1);
      expect(result.User).to.have.property('name', 'Alice');
    });
  });

  it('can create post as user', () => {
    const context = new Context();
    context.setUser({id: regularUser1});
    const query = `{
      createPost(owner:$userId) {
        id
      }
    }`;
    const args = {userId: regularUser1};
    return storage.query(query, context, args).then(result => {
      expect(result.createPost).to.have.property('id');
      temporary = {id: result.createPost.id};
    });
  });

  it('can read post as owner', () => {
    const context = new Context();
    context.setUser({id: regularUser1});
    const query = `{
      Post(id:$id) {
        id
      }
    }`;
    const args = {id: temporary.id};
    return storage.query(query, context, args).then(result => {
      expect(result.Post).to.have.property('id');
    });
  });

  it('accepts reads of public items by other users', () => {
    const context = new Context();
    context.setUser({id: regularUser2});
    const query = `{
      Post(id:$id) {
        id
      }
    }`;
    const args = {id: temporary.id};
    return storage.query(query, context, args).then(result => {
      expect(result.Post).to.have.property('id');
    });
  });

  it('accepts update post as owner', () => {
    const context = new Context();
    context.setUser({id: regularUser1});
    const query = `{
      updatePost(id:$id,title:"Test") {
        id
      }
    }`;
    const args = {id: temporary.id};
    return storage.query(query, context, args).then(result => {
      expect(result.updatePost).to.have.property('id');
    });
  });

  it('denies update post as other user', () => {
    const context = new Context();
    context.setUser({id: regularUser2});
    const query = `{
      updatePost(id:$id,title:"Test") {
        id
      }
    }`;
    const args = {id: temporary.id};
    return Promise.resolve().then(() => {
      return storage.query(query, context, args);
    }).then(() => {
      throw new Error('should be rejected');
    }).catch(err => {
      expect(err.message).to.contain('Permission denied');
      expect(err.message).to.contain('updatePost');
    }).done();
  });

  it('denies update post as anonymous user', () => {
    const context = new Context();
    const query = `{
      updatePost(id:$id,title:"Test") {
        id
      }
    }`;
    const args = {id: temporary.id};
    return Promise.resolve().then(() => {
      return storage.query(query, context, args);
    }).then(() => {
      throw new Error('should be rejected');
    }).catch(err => {
      expect(err.message).to.contain('Permission denied');
      expect(err.message).to.contain('updatePost');
    }).done();
  });

  it('accepts update post as admin', () => {
    const context = new Context();
    context.setUser({id: adminUser, admin: true});
    const query = `{
      updatePost(id:$id,title:"Admin edit") {
        id
      }
    }`;
    const args = {id: temporary.id};
    return storage.query(query, context, args).then(result => {
      expect(result.updatePost).to.have.property('id');
    });
  });
});
