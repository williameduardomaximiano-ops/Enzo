'use strict';
/** Canal oficial de atualizações: repositório privado + chave PÚBLICA Ed25519.
 * A chave privada correspondente fica fora do repositório, em diretório seguro
 * do Windows. Nunca coloque segredos neste arquivo. */
const OWNER='williameduardomaximiano-ops';
const REPO='Enzo';
const PUBLIC_KEY_PEM=`-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAY/LSu6ak0AZRhLhHNIhRCstG+2JLSzL9bW/weBByjg4=
-----END PUBLIC KEY-----
`;
module.exports={OWNER,REPO,PUBLIC_KEY_PEM};
