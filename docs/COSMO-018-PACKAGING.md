# COSMO 0.1.8 — correção de inicialização

## Defeito diagnosticado em instalação real
Erro exibido pelo Electron:
> Cannot find module '../updater/github-private.cjs'
> Require stack: .../resources/app.asar/desktop/main.cjs

Causa: electron-builder incluía 'desktop/**', 'core/**', 'ui/**', 'android/**' e 'package.json', mas **não incluía 'updater/**'**, importado diretamente em desktop/main.cjs. Portanto o instalador compila sem erro, porém o COSMO não inicia.

## Correção
- Acrescentar a pasta updater/** na lista build.files do app.asar.
- Criar script scripts/verify-packaged.cjs que **lê o app.asar compilado**, verifica arquivos obrigatórios e valida imports require() locais de desktop/core/updater/android.
- Incorporar essa validação obrigatória antes da etapa NSIS e conferir também no workflow Windows.
- Adicionar teste de regressão e incrementar versão para 0.1.8.
- Não trocar appId, nome npm, pasta userData, cofre, token Groq/Gemini, nem nome técnico do canal de updates para evitar perda de dados.
- NÃO afirmar que corrigiu todos os problemas do app até testar abertura no Windows real.

## Como recuperar instalação com erro
1. Não apague o diretório de dados do COSMO/ENZO nem arquivos de cofre.
2. Feche o diálogo de erro e o aplicativo.
3. Execute a versão reparada 0.1.8 na **mesma pasta de instalação** da versão anterior (se foi instalada em E:\ENZO, selecione E:\ENZO).
4. Teste abertura, fala, configurações e backups.
5. Se houver erro, registre texto e captura; evite reinstalações repetidas e não desative antivírus.
6. Este instalador experimental ainda não é uma release estável assinada de atualizações automáticas.

Status: validação automatizada/compilação do Windows a confirmar pelo workflow do GitHub.
