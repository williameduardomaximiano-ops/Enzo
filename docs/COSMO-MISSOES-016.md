# COSMO — autonomia supervisionada (pacote experimental 0.1.6)

## O que está implementado neste branch

- **Central de Missões** na interface, dados reais e persistentes em `userData/cosmo-missions/index.json`.
- O usuário pede: "Cosmo, crie um CRM para a minha empresa", "Cosmo, crie uma missão para fazer uma landing page" ou usa a aba **Missões**.
- A missão cria uma pasta exclusiva com `BRIEFING.md` e `opencode.json` (permissões restritas).
- Botão **Executar no OpenCode** pede aprovação visual no Windows; só então tenta a CLI instalada `opencode.exe`. Não executa bash nem shell por padrão no agente do projeto; bloqueia acesso externo e leitura de `.env`.
- Cada resultado retorna **em revisão**, não 'concluído' sem verificar. `execucao.log` registra retorno textual limitado a 200 KB.
- **Parar tudo** interrompe a missão ativa, sem apagar projetos existentes.
- Botão **Prévia HTML** abre `index.html` ou `dist/index.html` apenas quando o arquivo existe.
- Botão **Publicar prévia Vercel** requer CLI Vercel logada e aprovação separada; faz `vercel deploy --yes` (sem `--prod`), valida o endereço do preview e o abre na tela.
- Formulário de primeiro contato cria um rascunho personalizado para `wa.me`, mostra o texto na aprovação e **não envia mensagem**.
- Com confirmação visual, consulta até 30 títulos de janelas pelo Windows UI Automation; **não captura a tela, não clica e não envia nomes para Groq/Gemini**.
- Cofre Groq/Gemini/GitHub, Android, voz, calendário, modos e identidade COSMO existentes permanecem.

## O que precisa estar instalado na máquina

- Windows 10/11 x64 e o COSMO experimental.
- OpenCode CLI `opencode.exe` acessível em PATH ou via variável `COSMO_OPENCODE_CLI` com caminho completo; a versão desktop sem CLI não basta.
- Provedor/modelo configurado dentro do OpenCode; não presumir que as chaves do cofre COSMO estejam disponíveis no OpenCode.
- Para publicação: Vercel CLI instalada e autenticada; pode definir `COSMO_VERCEL_CLI` para o executável real `.exe` ou `.cmd`.

## Testes antes de afirmar que está completo

1. `npm test` e `npm run bundle` no GitHub Windows.
2. Compilar e gerar instalador Windows com `npm run build:win`.
3. Em máquina real, instalar em cima de 0.1.4/0.1.5 com backup e validar preservação do cofre, configurações e modos.
4. Criar missão site/CRM, autorizar OpenCode, verificar arquivos e logs reais, interromper e tentar de novo.
5. Conectar Vercel CLI, publicar uma prévia, confirmar que o endereço funciona e revisar segurança da aplicação.
6. Verificar que WhatsApp só abre rascunho, nunca dispara automaticamente, e que a consulta UIA só ocorre mediante consentimento.

## Pendente — NÃO anunciar como implementado

- Motor de wake-word local de baixíssimo consumo que escute "Ei, Cosmo" com a interface fechada.
- Navegação visual por árvore de acessibilidade para clicar e operar qualquer aplicativo autorizado, com pausa se o usuário tocar no mouse.
- Holograma 3D com cabeça preta e circuitos dourados **idêntico à referência**, movimentos de cabeça e visemas fonéticos sincronizados.
- Motor de pesquisa e classificação independente de 5 empresas com dados públicos conferidos.
- Criação/autenticação automáticas de repositório GitHub, produção Vercel, envs, bancos e migrações sem consentimento individual.
- Testes E2E dos CRMs/e-commerce, pagamentos, acesso, LGPD, backups e rollback.
- Envio automatizado em WhatsApp pela API oficial com opt-in e políticas da plataforma; neste pacote somente rascunho.
- Operação Android remota fora da LAN com autenticação forte e TLS.
- Catálogo inteiro de vozes neurais com pesos e runtime comprovadamente instalados.

**Estado:** código em branch de desenvolvimento. Não é release estável nem funcionamento validado na máquina pessoal do usuário. Evitar mesclar no main sem teste end-to-end.
