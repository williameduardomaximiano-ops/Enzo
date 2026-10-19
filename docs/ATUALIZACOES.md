# Publicar uma versão do COSMO (automático)

1. **Uma vez:** em GitHub → Settings → Secrets and variables → Actions, crie o segredo `ENZO_SIGNING_KEY` com o conteúdo completo do arquivo `enzo-signing-private.pem` (a chave privada que combina com a pública em `core/update-channel.cjs`). Se perdeu a chave, gere outra com `node scripts/generate-signing-key.cjs C:\pasta\segura`, troque a chave pública em `core/update-channel.cjs` e reinstale manualmente a próxima versão uma vez.
2. Suba a versão em `package.json` (ex.: `0.2.0`) e escreva as novidades em `release-notes/v0.2.0.md` — o COSMO lê esse texto em voz alta quando você pede “ler novidades”.
3. Na `main`, crie e envie a tag: `git tag v0.2.0 && git push origin v0.2.0`.
4. O workflow **Publicar versão COSMO** (`.github/workflows/publicar-versao.yml`) roda no Windows: testes, runtime, instalador, assinatura (`scripts/sign-github-release.cjs`, que confere a chave antes) e release `v0.2.0` com `ENZO-0.2.0-Windows-x64.exe` e `enzo-update.json`.
5. No PC, o COSMO precisa do token de leitura do GitHub no cofre (Configuração → Cofre → GitHub). Ele verifica ao abrir, a cada 6 horas ou quando você diz “buscar atualizações”, e só instala com sua confirmação.

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
