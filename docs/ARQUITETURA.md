# Arquitetura implementada

Renderer WebGL → preload com métodos fixos → processo principal Electron → gate de permissões → adaptadores.

- `ui/`: rosto procedural Three.js, áudio Web Audio, PCM mono 16 kHz, VAD por energia/silêncio, estados, formulários.
- `desktop/main.cjs`: orquestração, dialogs nativos, ciclo de vida, bandeja, atalhos, IPC e tarefas.
- `core/policy.cjs`: validação deny-by-default e autorização específica com validade.
- `core/voice.cjs`: processo filho JSON-lines, timeout, cancelamento e reinício.
- `voice/worker.py`: Piper e Faster Whisper, modelos locais carregados sob demanda, CPU int8.
- `core/llm.cjs`: API local Ollama, sem segredos de provedores, timeout e validação da resposta.
- `voice/windows_control.py`: ações explícitas de teclado e área de transferência; sem shell, eval, exec ou instalação arbitrária.
- `core/android.cjs`: companion HTTP opt-in, token, rate limit e aprovação local de pareamento.
- `core/updates.cjs`: manifesto assinado, versão, download limitado por tamanho e SHA-256.

Decisões: Electron usado para gerar pacote x64 e manter UI WebGL independente do motor Python. O projeto novo não reutiliza o código do JARVIS. Piper/Whisper dispensam bloqueios de vozes neurais do Windows. Ollama é escolhido por execução local e ausência de cobrança por token, mas precisa instalação/modelo e recursos do PC. Nenhuma infraestrutura Vercel ou serviço pago é requisito.

O renderer não pode executar comandos livres. O LLM propõe ações que passam por validação e confirmação. Conteúdo remoto não tem acesso ao IPC. Autorizações não são persistidas e não são compartilhadas com Android. O companion nunca instala atualizações. Os executores não têm permissão para elevar privilégios ou aprovar diálogos do ENZO.

Limites atuais: UI/main carregam localmente por file://; dados de histórico opt-in não criptografados; Android HTTP sem TLS; VAD simples, não word-level; sem streaming LLM→TTS; sem sandbox de projetos de código porque execução de código arbitrário não existe nesta versão. Estes pontos não devem ser apresentados como implementação de toda a autonomia pretendida.
