# ENZO 0.1.0 — aplicação inicial, validação Windows pendente

Construído do zero para Windows 10/11 x64. Este pacote contém código executável e um instalador NSIS, não apenas uma página demonstrativa. **Não é a conclusão de todo o planejamento nem uma versão validada em um computador Windows real.**

## Instalação e primeiro uso

1. Execute `ENZO-0.1.0-Windows-x64.exe` em Windows 10 de 64 bits, versão 1809 ou posterior. O instalador é de desenvolvimento e não possui assinatura Authenticode. Verifique o SHA-256 fornecido. Não desative proteções do Windows.
2. Abra ENZO → Configuração → Verificar componentes. Python, Piper, Whisper Base e modelos de voz já estão no pacote.
3. Se a voz apontar DLL Microsoft ausente, use **Componente Microsoft**. Ele abre o redistribuível oficial Visual C++ x64 incluído. A instalação desse componente pode exigir autorização administrativa.
4. Para conversa livre, abra ENZO → Configuração → Cofre Criptografado, cole as chaves grátis de Groq (console.groq.com) e/ou Gemini (aistudio.google.com) e salve. O ENZO usa Groq e Gemini com fallback automático entre eles. Sem chave, só os comandos locais funcionam.
5. Ouça a voz de teste. Ative o microfone e diga “ENZO, que horas são?” ou “ENZO, abra a calculadora”. Autorize a abertura na janela nativa.
6. Teste conversa livre. Se o modelo não estiver disponível, o ENZO informa o problema, sem simular uma resposta de IA.

Microfone desligado ao iniciar. Ctrl+Alt+Espaço alterna a captura. Ctrl+Alt+Esc interrompe e pausa. **Retomar** libera novas ações. O botão Flutuante abre uma janela compacta sempre no topo; nesta versão ela ainda tem moldura e fundo, não é uma sobreposição transparente sem bordas.

## O que está implementado

- Desktop Electron com contexto isolado, sandbox do renderer, CSP e ponte IPC limitada.
- Rosto procedural WebGL tridimensional: rotação, piscadas, sobrancelhas, respiração e abertura de boca baseada na amplitude real do áudio. Não é um avatar humano fotorrealista e não tem sincronização fonética/visemas.
- Voz neural local Piper pt-BR Faber. Reconhecimento Whisper Base int8 em CPU. Nenhum fallback SAPI/voz Windows.
- Conversa contínua opcional. A captura não é processada durante a própria resposta, evitando eco. Interrupção por botão/atalho funciona; interrupção falada durante a própria fala ainda não está implementada.
- IA por Groq e Gemini (nuvem) com fallback automático e histórico curto. Histórico persistente é opt-in, em texto simples local, e pode ser apagado.
- Abertura de calculadora, bloco de notas, explorador, Paint e links HTTP/HTTPS. Colagem de texto e cinco atalhos de teclado por proposta da IA. Nenhum shell arbitrário.
- Confirmação visual por ação, escopo explícito, expiração de 60 s, token consumido uma vez e pausa que revoga autorizações.
- Companion Android pelo navegador, por texto ou ditado do teclado Android, na mesma rede. Pareamento com código temporário, confirmação no PC, sessão de 1 h, limitação de tentativas e revogação. Não é um APK nem controla aplicativos Android.
- Central de atualizações, comandos falados, verificação Ed25519, SHA-256 e tamanho antes de abrir instalador. Canal ausente é mostrado como ausente, nunca como “atualizado”.
- Instalador/desinstalador por usuário, atalhos e preservação de dados locais. Diagnóstico em `scripts/windows-selftest.ps1`.

## Limitações que impedem chamar o projeto de concluído

- Instalador compilado em Linux, não executado em Windows. Voz no microfone real, reprodução, DPI, GPU, UAC, entrada de teclado, desinstalação e atualização ainda exigem teste em Windows 10 x64.
- Groq e Gemini são configuráveis por chaves no cofre criptografado; não vêm embutidos. Os adaptadores foram testados com servidores HTTP controlados, incluindo fallback entre provedores.
- Android foi testado no protocolo local; não houve validação física no aparelho do usuário. O transporte atual usa HTTP: apenas rede privada confiável, sem conteúdo sensível. TLS e aplicativo Android nativo ainda faltam.
- Não há canal de atualização hospedado, chave de produção ou certificado de assinatura Windows. Logo, futuras versões ainda não aparecem automaticamente no programa. O mecanismo está implementado, mas a distribuição não está operacional.
- Ainda não há UI Automation com seletores, visão de tela, OCR, controle geral de mouse, integração OpenCode/Claude, aprendizado de rotinas, scheduler de agentes, memória semântica, rollback automático nem acesso remoto fora da LAN.
- Avatar original procedural. A imagem de referência do planejamento não foi disponibilizada como imagem nesta execução; não foi possível validar fidelidade visual à referência.
- Não foi possível recuperar uma especificação completa do novo ENZO; os requisitos explícitos da conversa orientaram esta versão. O arquivo legado JARVIS foi tratado como referência, não como especificação integral do ENZO.

## Desenvolvimento

Node.js LTS, npm e Python 3.11+ com pip. Instale dependências:

```text
npm ci
python scripts/prepare-runtime.py
npm test
npm run build:win
```

No Windows, `npm start` usa o Python embutido preparado. No Linux, instale `voice/requirements-linux.txt` e use `ENZO_PYTHON` se necessário. Os scripts não precisam de chaves de API.

O runtime Windows é obtido de fontes oficiais com hashes em `resources-lock.json` e `voice/requirements-windows.txt`. Downloads que mudarem de conteúdo são recusados. O link Microsoft pode passar a servir outra versão; atualize a trava após verificar a origem e a assinatura, nunca ignore falha de hash.

`npm test` executa testes de política, atualização, HTTP Android, adaptadores Groq/Gemini controlados (com fallback) e processo de voz. O teste de voz localiza o Python via `ENZO_PYTHON`, `python3` ou `python`, sem exigir PATH configurado. `python scripts/test-voice.py` executa síntese e reconhecimento reais em Linux; requer scipy apenas para o teste. Os testes de UI usam IPC simulado; isso está registrado em `docs/ui-test.json`.

## Atualizações futuras

Leia `docs/ATUALIZACOES.md`. Nenhuma chave privada está incluída. Não basta alterar a conversa do ChatGPT para o aplicativo se atualizar: é preciso compilar, assinar o manifesto e publicar uma nova versão no canal configurado.

## Dados e licenças

Dados ficam no diretório Electron `userData` do usuário, normalmente `%APPDATA%\enzo-assistente`. Logs guardam tipo de evento, sem áudio ou texto de conversa. Histórico é opcional e sem criptografia; não dite senhas. Desinstalar preserva os dados.

Código ENZO sob GPL-3.0-or-later. Consulte `LICENSE` e `third-party/NOTICE.md`. O pacote não cobra por APIs; internet, eletricidade e eventuais serviços escolhidos pelo usuário têm custos próprios.

## Protocolo JARVIS

- **Palavra de ativação** (Configuração → Protocolo JARVIS, desligada por padrão): o microfone fica aberto e o ENZO só responde a frases que começam com “Enzo” (ou “Jarvis”). Dizer só “Enzo” faz ele responder “Pois não, senhor?” e ouvir o próximo pedido por 8 segundos. Tudo é reconhecido localmente; o resto é descartado.
- **Personalidade**: trata você por “senhor”, responde curto para a voz e com ironia leve.
- **Memória**: “Enzo, lembre que…”, “o que você lembra de mim?”, “esqueça …”, “esqueça tudo”. Guardada com a criptografia do sistema (`memory.enc`) e editável na Configuração.
- **Lembretes, timers e alarmes**: “me lembre de … em 10 minutos / às 15h30”, “timer de 5 minutos”, “alarme para as 7h”, “quais são meus lembretes?”. Avisam por voz, na conversa e com notificação do Windows.
- **Clima**: “como está o tempo (em Curitiba)?”, usando a cidade salva e o Open-Meteo (sem chave).
- **Mídia**: aumentar/diminuir volume, silenciar, tocar/pausar, próxima/anterior (teclas multimídia do Windows).
- **Status do sistema**: CPU, memória e tempo ligado, por voz e no HUD em tempo real.
- **Proatividade**: saudação ao iniciar, lembretes e aviso de bateria abaixo de 20%.
