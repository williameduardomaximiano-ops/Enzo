## Preparação da versão 0.2.2 (24/10/2026)

Antes de compilar a release oficial, o GitHub agora valida se o segredo `ENZO_SIGNING_KEY` contém uma chave privada Ed25519 íntegra **e se corresponde à chave pública já instalada nos PCs**. O teste falha imediatamente se a chave estiver ausente, truncada ou trocada, sem imprimir o segredo. O instalador de teste gerado pela branch não é atualização oficial.

**Para remover o bloqueio:** recupere o arquivo privado original `enzo-signing-private.pem` no computador que o gerou. Entre em GitHub → repositório Enzo → Settings → Secrets and variables → Actions → `ENZO_SIGNING_KEY` e substitua pelo PEM privado integral (BEGIN até END). Não coloque esse arquivo no repositório, no chat ou no instalador. Sem a chave original, é necessário planejar a migração de confiança e **instalação manual** de uma versão com chave pública nova; uma atualização automática instalada anteriormente não poderá aceitar outra chave pública.

Publicar só após o CI e a validação real no Windows. A assinatura do manifesto Ed25519 não equivale à assinatura Authenticode do executável.

---

# Publicar uma versão do COSMO (automático)

**Regra:** toda vez que chega na `main` uma versão nova no `package.json` (ex.: `0.2.0` → `0.2.1`), o GitHub publica sozinho e o COSMO instalado oferece a atualização. Sem versão nova, nada é publicado.

1. **Uma vez:** em GitHub → Settings → Secrets and variables → Actions, crie o segredo `ENZO_SIGNING_KEY` com o conteúdo completo de `enzo-signing-private.pem` (a chave privada que combina com a pública em `core/update-channel.cjs`). Se perdeu a chave, gere outra com `node scripts/generate-signing-key.cjs C:\pasta\segura`, troque a chave pública em `core/update-channel.cjs` e instale manualmente a próxima versão uma vez.
2. **Uma vez, no PC:** crie um token de leitura do GitHub (github.com/settings/personal-access-tokens/new → só o repositório Enzo → Contents: Read-only) e cole em COSMO → Configuração → Cofre → GitHub.
3. **A cada mudança:** suba a versão em `package.json`, escreva as novidades em `release-notes/vX.Y.Z.md` (opcional; sem ele usa a mensagem do commit) e junte na `main`.
4. O workflow **Publicar versão COSMO** testa, gera o instalador no Windows, assina (`scripts/sign-github-release.cjs`) e publica o release `vX.Y.Z` com `ENZO-X.Y.Z-Windows-x64.exe` e `enzo-update.json`. Também aceita a tag `vX.Y.Z` enviada manualmente.
5. O COSMO verifica ao abrir, a cada 6 horas ou quando você diz “buscar atualizações”, e só instala com sua confirmação.

O instalador não tem assinatura Authenticode; o Windows SmartScreen pode avisar na instalação.

---

# Distribuição de atualizações — implementação e pendências

O aplicativo só aceita um manifesto com assinatura Ed25519 verificada contra a chave pública incluída na compilação. O JSON externo contém `payload` (string JSON exata) e `signature` (base64). O payload descreve versão, URL HTTPS do .exe, tamanho em bytes, SHA-256 e notas. Versões iguais/anteriores e conteúdo alterado são recusados.

1. O responsável pela distribuição gera um par Ed25519 em local privado. Nunca inclua a chave privada no aplicativo, código público, conversa ou arquivo entregue ao usuário.
2. Escolha um canal HTTPS estável (por exemplo um repositório GitHub dedicado com Releases). O canal ainda não foi criado nesta entrega.
3. `node scripts/configure-channel.cjs URL_HTTPS_DO_MANIFESTO ARQUIVO_CHAVE_PUBLICA` grava apenas URL e chave pública em `resources/channel.json`.
4. Compile a primeira versão com esse canal incorporado. Esta versão inicial sem canal não descobre automaticamente um canal novo.
5. Para versões futuras, incremente a versão no package.json, teste, compile e publique o instalador. Execute `node scripts/sign-release.cjs CHAVE_PRIVADA INSTALADOR VERSAO URL_HTTPS NOTAS ARQUIVO_MANIFESTO`.
6. Publique o manifesto no canal estável, somente após a disponibilização do instalador.

O ENZO consulta após iniciar e a cada seis horas quando o canal estiver configurado. “Buscar atualizações” faz a mesma consulta. “Ler novidades” lê as notas verificadas. “Instalar atualização” abre a confirmação visual e só executa o instalador depois da verificação de hash/tamanho. A aprovação falada sozinha não substitui a confirmação visual e o UAC do Windows.

A assinatura Ed25519 do canal não substitui assinatura Authenticode do executável. Esta entrega não possui certificado Authenticode. A atualização fecha o aplicativo depois de abrir o instalador; ainda não existe rollback automático nem comprovação de instalação bem-sucedida após reinício.

Teste necessário em Windows: instalar versão A; configurar um canal de teste com chave separada; publicar versão B; verificar consulta, notas, recusa, cancelamento e instalação; testar manifesto adulterado, arquivo truncado, hash errado, downgrade, falha de rede e preservação de dados. Não publicar como estável sem esse ciclo.
