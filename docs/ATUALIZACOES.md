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
