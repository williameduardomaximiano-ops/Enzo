# Modelo de segurança — ENZO

O ENZO controla aplicativos no Windows, portanto não deve rodar sempre como Administrador nem aceitar comandos arbitrários de páginas, PDFs, e-mails ou modelos de IA.

- Electron: contextIsolation, sandbox renderer, nodeIntegration=false, CSP restritiva e IPC limitado.
- Toda ação sensível (instalar, excluir, enviar dados externos, alterar Windows ou privilégios) exige autorização separada.
- Chaves Gemini, Groq e GitHub, banco e memórias ficam em armazenamento local protegido (DPAPI), nunca no repositório.
- Não expor painel na rede pública; localhost com autenticação de sessão, Origin e CSRF. Android requer canal autenticado.
- Atualização: GitHub Releases privado + autenticação apenas de leitura + assinatura Ed25519 incorporada ao aplicativo + hash/tamanho SHA-256 + confirmação visual.
- Chave de assinatura privada nunca deve ficar no GitHub, no instalador ou nos logs.
- Backup antes de atualizar; plano de rollback e botão de emergência para revogar ações. Nenhuma proteção é 100% infalível.
