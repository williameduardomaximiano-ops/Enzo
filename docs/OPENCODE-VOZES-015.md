# OpenCode — integrar vozes ENZO 0.1.5 no Windows

Repositório privado: https://github.com/williameduardomaximiano-ops/Enzo
Branch: feature/vozes-masculinas-015 (PR #1)

Você atua no PC Windows do usuário. Primeiro audite as alterações do PR e valide que o código instalado ainda é a versão 0.1.4. **Não substitua o ENZO instalado por clone antigo nem sobrescreva o cofre, memória e configurações.** Preserve Groq/Gemini, holograma, Modo Trabalho, Android, permissões, reconhecimento de voz e atualizador.

Objetivos:
1. Criar backups locais de instalação, userData, settings.json, vault.enc, modes.json e demais dados antes de mexer. Proteger credenciais e não subir backup ao GitHub.
2. Revisar o PR das vozes; integrar o seletor de 14 perfis e os três estilos de voz em Configuração > Voz Neural, com teste de reprodução e comandos de troca por voz.
3. Testar Faber como padrão antes de instalar novos motores; sem pacote opcional instalado, mostrar erro claro e manter seleção recuperável.
4. Instalar Supertonic 3, PocketTTS e KittenTTS em ambientes Python **isolados** do runtime atual, somente após verificar licença e pedir aceite explícito onde houver termos de uso. Validar pacotes de fonte oficial, versões fixas, pesos com SHA-256. Não desligar proteção de Windows nem permitir downloads silenciosos.
5. Testar as cinco vozes Supertonic M1–M5, Pocket Rafael/George/Michael/Paul, Kitten 2–5 masculinas. Marcar opções inglesas e sotaque não brasileiro. Medir latência, CPU e RAM em frases reais em português brasileiro; não presumir que as vozes estrangeiras funcionam perfeitamente em pt-BR.
6. Confirmar funcionamento da UI, troca por voz, persistência após reinício, TTS, STT, botão Parar Tudo, permissões, updates, modos e holograma. Corrigir incompatibilidades sem quebrar outras funções.
7. Compilar instalador Windows x64 versão 0.1.5, com manifest/sha256 e assinatura Ed25519 somente no PC usando a chave privada já armazenada fora do repo (não copie a chave para o GitHub, CI, logs ou chats).
8. Testar a atualização real 0.1.4 → 0.1.5 via Central de Atualizações do ENZO com manifesto e release de teste verificados. Conferir backups e recuperação.
9. Publicar GitHub Release v0.1.5 apenas com instalador/manifesto **validados**, nunca marcar como concluído só por compilar. Confirmar com o usuário antes da instalação final.
10. Relatar modelos com voz real funcionando, testes, erros, versão antiga/nova, commit, release e teste A→B. Não declarar atualização automática funcional se não tiver teste no PC.

Não colocar tokens, chaves privadas, gravações e dados pessoais no repositório.
