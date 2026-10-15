# Validação — ENZO 0.1.0

## Resultado e escopo

Esta é uma aplicação inicial executável, com módulos reais de voz, controle supervisionado e companion. Não foi validada como produto final. Nenhum teste executado em Linux deve ser interpretado como teste em Windows 10 ou Android físico.

| Área | Evidência executada | Limite |
|---|---|---|
| Política de ações | Bloqueio de shell/aplicativo não permitido, protocolos perigosos, limite de texto, autorizações de uso único, expiração, recusa e pausa | Executor Windows não foi acionado |
| Atualizações | Assinatura Ed25519 válida/inválida, metadados, HTTPS e bloqueio de downgrade | Sem canal hospedado; instalação real não testada |
| Android | Servidor HTTP real, código correto/incorreto, aprovação, token, origem, rate limit e revogação | Cliente físico, Wi-Fi e firewall não testados |
| IA | Requisição HTTP para servidor Ollama controlado, resposta, proposta de ação e erro | Sem inferência de Qwen/Ollama real neste ambiente |
| Processo de voz | JSON-lines, saúde, operação recusada e reinício | Processo Python Linux |
| Síntese e reconhecimento | Piper gerou WAV; Whisper transcreveu PCM real do WAV | Entrada sintética, sem microfone físico; reconhecimento do nome não confiável |
| UI | Chromium Linux, WebGL e formulário, resposta e configuração, tamanhos 1240 e 440 px | IPC simulado; não Electron Windows |
| Código | Verificação sintática Node e compilação Python | Não substitui execução de cada ramo |
| Dependências npm de produção | 0 vulnerabilidades reportadas | Auditoria por banco de avisos, não prova de segurança |
| Ferramentas npm de desenvolvimento | 8 avisos moderados transitivos, 0 altos/críticos na consulta | Cadeia electron-builder → sprintf-js; sem correção segura aplicada |

Os 16 testes automáticos estão em `docs/test-results.txt`. Resultados de áudio em `docs/voice-test.json`, e o WAV em `docs/voz-enzo.wav`. Auditorias em `docs/npm-audit*.json`.

Última medição neste servidor Linux: síntese fria ~1,53 s; síntese aquecida ~0,09 s; reconhecimento frio ~0,93 s. Variações entre execuções ocorreram. Não são promessas para o i3/GTX 1650. A frase “abra a calculadora” foi reconhecida; o nome William foi inicialmente reconhecido incorretamente e depois omitido. A revisão de comandos antes de executar continua necessária.

## Correções decorrentes dos testes

- Inclusão explícita de requests e colorama no runtime Windows.
- Novo download do Whisper Base: arquivo inicial tinha tamanho esperado, mas hash incorreto. Substituído e comparado com SHA-256 publicado pelo repositório.
- Reconhecimento passou a receber PCM NumPy validado, evitando incompatibilidade do decodificador PyAV.
- Proteção contra evento de saída de um processo antigo derrubar um worker de voz reiniciado.
- Tratamento de falha de enumeração de interfaces de rede.
- Bundle frontend clássico para evitar restrições de módulos em file://.
- Script NSIS próprio, com desinstalação limitada aos arquivos empacotados, sem Wine.

## Critérios obrigatórios ainda pendentes no PC

1. Instalar em Windows 10 x64 limpo; validar Visual C++, importação Python e inicialização sem terminal.
2. Testar microfone real por 20 ciclos seguidos; silêncio, ruído, perda de dispositivo e cancelamento durante cada estado.
3. Ouvir português, números, nomes próprios e frases longas. Medir tempo até a primeira fala e percentis de latência.
4. Autorizar e recusar cada aplicativo/link; testar pausa durante a espera e antes da entrada de teclado. Não usar contas sensíveis.
5. Parear o Android real, recusar outro aparelho, expirar o código, revogar sessão e desligar a conexão.
6. Verificar UI em 100/125/150% DPI, monitores diferentes, GPU do usuário e modo compacto.
7. Validar desinstalação, reinstalação, retenção e exclusão manual opcional de histórico.
8. Publicar canal de teste separado, instalar atualização A→B, testar falhas e assinatura adulterada; somente então publicar canal estável.

Não foram executados testes de intrusão completos, controle de Windows real, APK Android, atualização instalada, rollback, assinatura Authenticode ou benchmark do hardware do usuário. Funções ausentes são listadas no README; não foram silenciosamente consideradas concluídas.
