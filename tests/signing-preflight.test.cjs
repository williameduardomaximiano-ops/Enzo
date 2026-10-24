'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {validateSigningKey} = require('../scripts/check-release-key.cjs');

test('pré-validação aceita o PEM Ed25519 que corresponde à chave pública', () => {
  const {publicKey,privateKey} = crypto.generateKeyPairSync('ed25519');
  const pub = publicKey.export({format:'pem',type:'spki'});
  const priv = privateKey.export({format:'pem',type:'pkcs8'});
  assert.equal(validateSigningKey(priv,pub),true);
  assert.equal(validateSigningKey(priv.trim().replace(/\n/g,'\\n'),pub),true);
});

test('pré-validação recusa segredo vazio, truncado, público ou não correspondente', () => {
  const a = crypto.generateKeyPairSync('ed25519');
  const b = crypto.generateKeyPairSync('ed25519');
  const publicPem = a.publicKey.export({format:'pem',type:'spki'});
  const privatePem = a.privateKey.export({format:'pem',type:'pkcs8'});
  const wrongPem = b.privateKey.export({format:'pem',type:'pkcs8'});
  assert.throws(() => validateSigningKey('',publicPem),/ausente/);
  assert.throws(() => validateSigningKey(privatePem.slice(0,77),publicPem),/inválida/);
  assert.throws(() => validateSigningKey(publicPem,publicPem),/PÚBLICA/);
  assert.throws(() => validateSigningKey(wrongPem,publicPem),/não corresponde/);
});
