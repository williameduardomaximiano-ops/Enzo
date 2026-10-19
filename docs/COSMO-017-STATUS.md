# COSMO 0.1.7 — implementado e pendente

## Novo neste branch, ainda dependente de testes reais no Windows

- **Holograma:** seletor de foto JPEG original (até 3 MB), preservando a arte enviada sem redesenhar o personagem. Animador WebGL 2,5D com movimentos leves de cabeça, boca pela amplitude da voz e brilho dourado que reduz no silêncio/microfone desligado. A foto importada fica salva em 'cosmo-hologram.jpg'. **Não é rig 3D nem lip sync fonético**. A imagem preta/dourada não consta no repositório, e precisa ser importada uma vez no app.
- **Controle do Windows:** Windows UI Automation lista processos e botões, invoca botão único mediante aprovação no computador e exige reinspeção entre cliques; alguns nomes sensíveis ficam bloqueados. Ainda não há movimentos livres de mouse ou navegação autônoma completa.
- **Memória:** comandos "Cosmo, memorize que..." e "Cosmo, o que você lembra sobre..." e aba Memória, notas cifradas com Windows DPAPI e pesquisa textual local. Não é memória semântica, não compartilha dados automaticamente com a nuvem.
- **Backups:** arquivos locais autorizados, inclusive cofre já cifrado, memória e foto. SHA-256 e restauração com confirmação + cópia pré-restauração. Não substitui rollback do executável assinado.
- **Prospecção:** consulta pontual a Nominatim/Overpass/OpenStreetMap para mostrar até cinco restaurantes da cidade informada. Ausência de website no cadastro OSM não significa ausência real. Sem contato automático nem verificação comercial.
- **Funções 0.1.6 mantidas:** missões, OpenCode supervisionado, prévia Vercel mediante aprovação e rascunho WhatsApp sem envio.

## Pendente — não anunciar como completo

1. Wake-word "Ei, Cosmo" sempre ativo com baixo consumo e indicador de privacidade.
2. Modelo 3D real preto/dourado com rotação 3D e sincronização da boca por visemas/fonemas.
3. Automação integral de mouse, teclado, navegador e aplicativos; controles acessíveis estão limitados.
4. Vibe-coding autônomo ponta-a-ponta com testes de segurança, autenticação, banco, GitHub e Vercel produção.
5. Pesquisa comercial com prova de dados, checagem de empresa e ranking real, além de OSM.
6. Memória semântica de longo prazo com fontes e retenção autorizadas.
7. Todos os perfis de voz local instalados, validados quanto a licença, sotaque e latência.
8. Android remoto seguro fora da rede local; companion atual só conecta na LAN.
9. Recuperação automática de instalador/versão com rollback assinado.
10. Teste real no Windows 10/11 e controle de CPU, RAM e GPU com app aberto.

## Antes de considerar pronto

Executar todos testes automatizados e compilação do Windows. Validar com instalação real em máquina de teste: voz, reconhecimento, UI, seleção de foto, controles acessíveis, Vercel, OpenCode, memória cifrada, backups e ausência de vazamentos. Não desativar Defender nem usar dados reais de cliente no teste.

Estado: branch experimental 0.1.7, não lançamento estável.
