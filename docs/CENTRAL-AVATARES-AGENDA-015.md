# ENZO 0.1.5 — Central com avatares, widgets e agenda

Este documento descreve as alterações **do código em desenvolvimento**, não um instalador já publicado.

## Aparências do ENZO
Na aba `Aparência` existem seis presets:
- ENZO Original (imagem oficial, sem alterações)
- Humanoide Azul
- Sentinela Ciano
- Fantasma Violeta
- Titânio Prata
- Fusão Âmbar

A galeria mostra uma prévia, guarda a seleção em `settings.json`, aplica o tema ao holograma por shader WebGL e permite comandos de voz como **“Enzo, troque o visual para Humanoide Azul”**.

**Limite honesto:** são seis variações visuais do mesmo holograma 2.5D, não seis modelos humanos fotorrealistas distintos nem seis malhas 3D faciais com rigging. Não confundir a imagem-conceito de humanoide com uma captura de algo já executado. A implementação de rostos 3D diferentes exige modelos e animações autorizadas, otimização e testes adicionais.

## Widgets com dados verdadeiros
- Uso de CPU calculado de duas amostras locais; mostra N/D antes de haver duas amostras.
- RAM medida em tempo real.
- GPU NVIDIA: uso, nome e temperatura via nvidia-smi somente se disponível no Windows.
- Temperatura de CPU mostra N/D quando nenhum sensor estiver conectado; nunca inventar valores.
- Atualização da interface a cada 12 segundos enquanto a janela está visível.

## Agenda local
- Calendário mensal interativo, criação e remoção de compromissos.
- Formulário de título, data e horário.
- Lista de próximos eventos e widget de compromissos de hoje.
- Persistência em `calendar.json` nos dados locais do Windows; incluído no backup antes de atualizar.
- Não existe sincronização com Google/Outlook; integração deve exigir autorização separada.

## Vozes
Catálogo masculino em desenvolvimento com Piper Faber e opções Supertonic, PocketTTS e KittenTTS.
**Aparecer no seletor não significa motor instalado.** Os motores adicionais e modelos precisam de validação de licença, instalação isolada e testes reais em português brasileiro antes de marcar como disponíveis.

## Distribuição
Branch: `feature/vozes-masculinas-015`. PR #1 em rascunho. Não publicar Release `v0.1.5` até confirmar:
1. Testes automatizados Windows e revisão do diff.
2. Executar e validar a UI instalada, voz, memória, backup, permissões e sensores.
3. Integrar versões reais das vozes opcionais, testar desempenho e qualidade; falha deve ser explícita sem substituir silenciosamente a voz.
4. Garantir que o app instalado 0.1.4 faça atualização segura para 0.1.5 usando a chave privada Ed25519 fora do GitHub, manifesto assinado, SHA-256 e aprovação do usuário.

Nenhuma atualização deste branch chega automaticamente ao ENZO 0.1.4 até que exista um instalador validado e assinado publicado como GitHub Release.
