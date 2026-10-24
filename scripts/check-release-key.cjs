'use strict';
// Confere ANTES de compilar se o segredo de assinatura corresponde à chave
// pública já distribuída nos aplicativos instalados. Não registra a chave.
const crypto = require('node:crypto');
const {normalizeKey} = require('./sign-github-release.cjs');
const {PUBLIC_KEY_PEM} = require('../core/update-channel.cjs');

function validateSigningKey(raw, publicKeyPem = PUBLIC_KEY_PEM) {
  if (!raw || !String(raw).trim()) {
    throw Error('ENZO_SIGNING_KEY ausente. Cadastre o PEM privado original em Settings > Secrets and variables > Actions.');
  }
  const privateKey = normalizeKey(raw);
  const actual = crypto.createPublicKey(privateKey).export({format:'der',type:'spki'});
  const expected = crypto.createPublicKey(publicKeyPem).export({format:'der',type:'spki'});
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw Error('A chave privada não corresponde à chave pública do COSMO já instalado. Recupere a chave original; não substitua a chave pública sem plano de instalação manual.');
  }
  return true;
}

if (require.main === module) {
  try {
    validateSigningKey(process.env.ENZO_SIGNING_KEY);
    console.log('Chave Ed25519 válida e compatível com os aplicativos já instalados.');
  } catch (error) {
    console.error('Publicação bloqueada antes da compilação:', error.message);
    process.exitCode = 1;
  }
}

module.exports = {validateSigningKey};
