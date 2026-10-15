# Canal GitHub privado — integração com ENZO instalado

**Repo:** williameduardomaximiano-ops/Enzo, privado.

O repositório foi inicializado, mas o código real da versão instalada e a integração Electron precisam ser realizados no computador Windows, com OpenCode.

1. Fazer backup dos fontes atuais, vault.enc, memórias e configurações **fora do GitHub**.
2. Auditoria de segredos antes de enviar qualquer arquivo. Não restaurar a fonte 0.1.1 antiga por cima do ENZO atual.
3. Integrar atualizador de GitHub Releases ao **processo principal Electron**, com IPC específico para verificar, baixar e instalar somente depois de confirmação visual.
4. Repositório privado requer uma credencial fine-grained GitHub de **somente leitura**, restrita ao repo Enzo. Guardá-la no Windows Credential Manager/DPAPI; nunca no código, renderer, log ou settings.json.
5. Gerar Ed25519 em lugar seguro fora do repositório; embutir somente **chave pública** no instalador. Criar release estável com tag vX.Y.Z e dois arquivos: ENZO-X.Y.Z-Windows-x64.exe e enzo-update.json assinados (SHA-256/tamanho/versão).
6. O ENZO verifica atualizações ao iniciar, periodicamente e por voz; exibe novidades e pede confirmação visual antes de executar instalador. Nunca desabilitar UAC/Defender/SmartScreen.
7. Testar em Windows 10 x64 duas versões reais, falha de rede, hash inválido, manifesto adulterado, downgrade, cancelamento, backup e dados persistidos.

**Ainda não operacional no aplicativo:** sem fonte atual importado, credencial protegida, assinatura de produção, release Windows e teste ponta a ponta.
