'use strict';
/* global supertest, expect */
const bcrypt = require('bcryptjs');
const knex = require('knex');
const app = require('../src/app');
const helpers = require('./test-helpers');

describe('Users Endpoints', function() {
  let db;

  const { testUsers } = helpers.makeThingsFixtures();
  const alreadyTaken = testUsers[0];

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DB_URL,
    });
    app.set('db', db);
  });

  after('disconnect from db', () => db.destroy());

  before('cleanup', () => helpers.cleanTables(db));

  afterEach('cleanup', () => helpers.cleanTables(db));

  describe('POST /api/users', () => {
    context('User Validation', () => {
      beforeEach('insert users', () =>
        helpers.seedUsers(
          db,
          testUsers
        )
      );

      const requiredFields = ['user_name', 'password', 'full_name'];

      requiredFields.forEach(field => {
        const registerAttemptBody = {
          user_name: 'test user_name',
          password: 'test password',
          full_name: 'test full_name',
          nickname: 'test nickname',
        };

        it(`responds with 400 required error when '${field}' is missing`, () => {
          delete registerAttemptBody[field];

          return supertest(app)
            .post('/api/users')
            .send(registerAttemptBody)
            .expect(400, {
              error: `Missing '${field}' in request body`,
            });
        });

        
      });
      it('responds with 400 "Password must be at least 8 characters" when password is less than 8 characters long', () => {
        const attempt = {
          user_name: 'apples',
          password: 'abcdefg',
          full_name: 'Apples Apples'
        };

        return supertest(app)
          .post('/api/users')
          .send(attempt)
          .expect(400,{error: 'Password must be at least 8 characters'});
      });

      it('responds with 400 "Password must be less than 72 characters" when password is more than 71 characters long', () => {
        const attempt = {
          user_name: 'apples',
          password: 'a'.repeat(72),
          full_name: 'Apples Apples'
        };

        return supertest(app)
          .post('/api/users')
          .send(attempt)
          .expect(400,{error: 'Password must be less than 72 characters'});
      });

      it('responds with 400 error when password starts with a space', () => {
        const attempt = {
          user_name: 'apples',
          password: ' aadsi8d!!%%s78dSd',
          full_name: 'Apples Apples'
        };

        return supertest(app)
          .post('/api/users')
          .send(attempt)
          .expect(400,{error: 'Password must not start or end with a space'});
      });

      it('responds with 400 error when password ends with a space', () => {
        const attempt = {
          user_name: 'apples',
          password: 'aadsi8d!!%%s78dSd ',
          full_name: 'Apples Apples'
        };

        return supertest(app)
          .post('/api/users')
          .send(attempt)
          .expect(400, {error: 'Password must not start or end with a space'});
      });

      it('responds with 400 error when password is not complex', () => {
        const attempt = {
          user_name: 'apples',
          password: '123!@#abc',
          full_name: 'Apples Apples'
        };

        return supertest(app)
          .post('/api/users')
          .send(attempt)
          .expect(400, { error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'});
      });
      
      it('responds with 400 "Username already taken" when username is already taken', () => {
        const attempt = {
          user_name: alreadyTaken.user_name,
          password: 'aadsi8d!!%%s78dSd',
          full_name: 'Apples Apples'
        };

        return supertest(app)
          .post('/api/users')
          .send(attempt)
          .expect(400, {error: 'Username already taken'});
      });
      
    });
    context('Happy path', () => {
      it('responds 201, serialized user, storing bcrypted password', () => {
        const newUser = {
          user_name: 'apple',
          password: 'aadsi8d!!%%s78dSd',
          full_name: 'Apples Apples'
        };
        return supertest(app)
          .post('/api/users')
          .send(newUser)
          .expect(201)
          .expect(res => {
            expect(res.body).to.have.property('id');
            expect(res.body.user_name).to.eql(newUser.user_name);
            expect(res.body.full_name).to.eql(newUser.full_name);
            expect(res.body.nickname).to.eql(newUser.nickname);
            expect(res.body).to.not.have.property('password');
            expect(res.headers.location).to.eql(`/api/users/${res.body.id}`);
            expect(res.body).to.have.property('date_created');
          })
          .expect(res => {
            db
              .from('thingful_users')
              .select('*')
              .where({ id: res.body.id })
              .first()
              .then(row => {
                expect(row.user_name).to.eql(newUser.user_name);
                expect(row.full_name).to.eql(newUser.full_name);
                expect(row.nickname).to.eql(null);
                const expectedDate = new Date().toLocaleString('en', { timeZone: 'UTC' });
                const actualDate = new Date(row.date_created).toLocaleString('en', { timeZone: 'UTC' });
                expect(actualDate).to.eql(expectedDate);
                return bcrypt.compare(newUser.password, row.password);
              })
              .then(compareMatch => {
                expect(compareMatch).to.be.true;
              });
          });
      });
    });
  });
});