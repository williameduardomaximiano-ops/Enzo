# COSMO — renomeação segura do assistente

Nome público novo: **COSMO**. O aplicativo exibe COSMO no Windows, na central, no companion Android e nas respostas da IA.

## Comandos

- "Cosmo, que horas são?"
- "Ei, Cosmo, abra a calculadora"
- "Cosmo, inicie o modo trabalho"
- "Cosmo, troque a voz para M2"
- "Cosmo, troque o visual para Humanoide Azul"

O parser aceita os comandos anteriores iniciados com "Enzo" por compatibilidade.

**Nota:** o reconhecimento da palavra de ativação contínua em segundo plano ainda não está implementado nesta base; os comandos acima funcionam quando o microfone está ativo ou o comando é digitado. Não confundir alias de comando com detecção local de wake-word.

## Compatibilidade obrigatória

- Nome interno de npm: `enzo-assistente` — **não alterar**, pois determina o diretório Electron `userData` com configurações, histórico e cofre.
- `studio.agape.enzo` — **não alterar** para manter identidade Windows do app.
- Caminho de instalação e chaves de registro `ENZO` — permanecem durante upgrade, mas o atalho visível e `productName` mudam para COSMO.
- Cofre DPAPI, Groq, Gemini, modos, Android, configurações, calendário e scripts de backup não devem ser reiniciados.
- Canal privado de releases do GitHub permanece no repositório **Enzo**. Não renomear o repositório no GitHub sem migração do atualizador.
- A primeira atualização COSMO usa o nome de arquivo `ENZO-X.Y.Z-Windows-x64.exe` e manifesto `enzo-update.json` para compatibilidade com o atualizador 0.1.4. **O nome do arquivo de distribuição é técnico; após instalar, o aplicativo aparece como COSMO.**
- O gerador de manifesto assinado foi alinhado ao verificador: `asset`, `version`, `size`, `sha256`, `notes`.

## Não lançar antes

1. Validar testes Node e empacotamento Windows, incluindo atalhos e desinstalador legados.
2. Testar upgrade real 0.1.4→0.1.5 preservando `settings.json`, `vault.enc`, modos, calendário e configurações.
3. Assinar o manifesto com chave privada fora de GitHub/app e publicar release de testes com hash/assinatura validada.
4. Verificar comandos de voz, integrações, UI, modo flutuante, vozes opcionais e segurança.
5. Só então publicar release estável; alterações neste branch não se instalam automaticamente.

**Estado:** código de desenvolvimento, sem instalação automática confirmada.
