# Holograma oficial — atualização visual do ENZO 0.1.3

A referência fornecida pelo usuário em 13/10/2026 é o visual oficial: cabeça frontal de malha branca luminosa, olhos azulados, fundo preto estrelado e onda azul inferior. **Nada no design foi reinterpretado nem trocado por um rosto azul de partículas.** A imagem original está em `ui/assets/holograma-oficial.jpg` (bytes idênticos ao arquivo fornecido) e incorporada em `ui/hologram-image.js` para evitar bloqueios de textura `file://` no Electron com `webSecurity: true`.

`ui/hologram.js` usa WebGL/Three.js para exibir esta imagem com a proporção preservada e uma animação discreta de pálpebras, boca e micro movimento da cabeça orientada pelo áudio. Mantém a interface `createHologram`, `setState`, `setLevel` e `dispose`, usada por `ui/app.js` para estados de fala, escuta e controles. O resto da aplicação não foi refeito.

## Limitação transparente

Essa solução é **2.5D com deformação de imagem**, para ser o mais fiel possível ao desenho aprovado. Não é uma nova cabeça 3D esculpida/rigada e não permite rotação lateral ampla ou visemas fonéticos precisos. Um modelo tridimensional real correspondente à imagem exigirá reconstrução, textura/rig dedicados e validação visual. Não confundir animação de imagem com essa etapa.

## Para o OpenCode atualizar uma instalação existente

1. Faça cópia de segurança do projeto e `userData` do ENZO. Não publique arquivos de credenciais.
2. Confirme a versão do projeto de destino: o ZIP foi derivado de uma cópia-base 0.1.2 **e não necessariamente é mais novo que o repositório do Windows**.
3. Mescle **somente** `ui/hologram.js`, `ui/hologram-image.js`, `ui/assets/holograma-oficial.jpg` e a alteração acessível de `ui/index.html`. Se o projeto local tiver mudanças em `ui/app.js`, NÃO sobrescreva. Faça rebase/mesclagem se já possuir um holograma mais recente.
4. Ajuste a versão do app para 0.1.3 ou superior ao estado do projeto real, sem regredir o versionamento. Não instale uma versão anterior por cima da atual.
5. Instale dependências com `npm ci`, execute `npm run bundle`, `npm test`, `node scripts/check-no-ollama.cjs` e `npm start` no Windows. Confira rosto, piscadas, boca com fala real, estados de escuta, Gemini/Groq, comando de abrir Brave e botão Parar Tudo.
6. Apenas após homologação, compile instalador e publique no canal de atualizações oficialmente configurado, seguindo as políticas de assinatura/integridade. Este ZIP NÃO publica no GitHub e NÃO instala no PC.

## Direitos da referência

Imagem fornecida pelo usuário e com marca d'água visível. Confirme permissão de uso/distribuição da imagem antes de tornar o código-fonte ou instalador público.

## Validação realizada

- Verificação byte a byte da imagem incorporada contra o arquivo original.
- Testes locais automatizados do código, incluindo regressões de voz, IA, política, Android e configuração.
- Sintaxe JavaScript validada.
- **Não realizado:** abertura de UI em Windows real, render WebGL integrado, testes no hardware/GPU do usuário, instalador, deploy ou atualização remota.
