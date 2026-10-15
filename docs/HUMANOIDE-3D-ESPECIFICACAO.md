# ENZO — contrato do novo humanoide 3D

Este documento é a especificação para a conversa que criará o modelo 3D. O **holograma antigo 2,5D saiu da interface de desenvolvimento** nesta branch, mas seu arquivo de referência não foi apagado. Ainda **não há novo modelo 3D embutido** e o app instalado no Windows não foi alterado.

## Modelo para integração
- Entregar personagem original humanoide masculino expressivo, rigado, de preferência **glTF 2.0 (.glb)** com texturas e materiais incluídos. Sem usar a imagem de uma pessoa real como substituto do modelo 3D.
- Rig de pescoço e cabeça, olhos independentes, pálpebras, sobrancelhas, mandíbula e lábios. Preferir morph targets/facial blendshapes documentados (piscar, sorriso, mandíbula, fonemas/visemas).
- Permitir vista de cabeça (janela flutuante) e busto (central), câmera virtual ajustável e fundo transparente/opcional.
- Contrato da UI: conectar em `#avatar-slot` do `ui/index.html`. Módulo exportará `createAvatarSlot(element)` ou adaptador compatível com `setState(state)`, `setLevel(amplitude)` e `dispose()`.
- Estados atuais: idle, listening, thinking, speaking, permission, executing, paused, updating. Gestos suaves, piscadas e acompanhamento ocular não devem impedir TTS ou comandos.
- Sincronia labial: primeiro áudio RMS; evoluir para visemas quando houver alinhamento fonético real. Não inventar sincronismo fonético.
- Otimização: medir desempenho real em Windows 10/11 x64 com i3 9ª geração, 16 GB RAM e GTX 1650 4 GB; implementar redução automática de detalhes e limitar renderização quando janela oculta.

## Webcam (etapa separada; desligada por padrão)
- Usar câmera **apenas** depois de clique/consentimento explícito na UI. O rastreamento local pode controlar direção da cabeça/olhos e gestos faciais.
- Iniciar com detecção de presença/posição de cabeça, depois expressão e landmarks faciais, com suavização e calibração opcional.
- Não gravar nem enviar frames; não coletar identidade facial, não fazer reconhecimento de pessoas; não usar API remota.
- Exibir indicador persistente **CÂMERA ATIVA**, botão **Desligar câmera**, e parar as tracks ao fechar janela, pausar ENZO ou trocar de perfil.
- Atualizar `desktop/main.cjs`: a política de Electron no momento autoriza **somente microfone**, de propósito. Não liberar câmera globalmente; autorizar apenas a janela local do ENZO quando o usuário ativar a função.

## Segurança e lançamento
- Nunca substituir Groq/Gemini, cofre, permissões, Modo Trabalho, central de atualizações ou os comandos de voz.
- Antes de instalar: teste automatizado e teste real no PC; backup das configurações e rollback. Não publicar como release estável antes de testar.
- As vozes adicionais Supertonic, PocketTTS e demais opções só devem aparecer como **ativas** se o motor e os modelos forem detectados localmente. O código-fonte deste branch não confirma que todos os motores estejam instalados.
