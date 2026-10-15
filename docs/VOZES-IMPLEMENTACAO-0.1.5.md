# ENZO — catálogo de vozes masculinas: alterações da próxima versão

## Incluído no código da branch de desenvolvimento
O seletor em Configuração > Voz Neural recebe 14 perfis:
- Piper Faber pt-BR, preservado como opção padrão.
- Supertonic 3: M1, M2, M3, M4, M5 (português, sotaque brasileiro não garantido).
- PocketTTS: Rafael (português), George, Michael e Paul (amostras inglesas).
- KittenTTS: expr-voice-2-m, -3-m, -4-m, -5-m (somente inglês).

Estilos Natural, Profissional e Descontraído. O efeito de velocidade depende
do motor; Piper e Pocket não recebem ajuste de velocidade nesta integração.
Comandos falados para trocar voz e estilo, com validação local de nomes.
Configuração persiste em settings.json local.

## Instalação e licenças
Os motores e pesos externos NÃO são incluídos nesta branch: o app mostra
indicação de dependência ausente até serem provisionados. Download requer
verificar origem, licença e hash. Não instalar globalmente nem desativar
Defender. O backend proíbe download automático por HF_HUB_OFFLINE=1,
e Supertonic usa auto_download=False.
Supertonic 3: pacote SDK sob MIT; pesos com OpenRAIL-M.
PocketTTS: código MIT; pesos sujeitos a termos do provedor (exigem aceite).
KittenTTS: verificar licença da versão do modelo antes de distribuir.
Modelos opcionais deverão viver em ambiente Python isolado apropriado para
Windows 10/11 x64, sem sobrescrever dependências do runtime do ENZO.
Testar desempenho no i3, 16 GB RAM e GTX 1650 antes de manter
mais de um motor carregado.

## Para concluir
1. Auditar scripts, licenças, versões fixadas e arquivos de voz.
2. No PC: instalar dependências opcionais e pesos somente com permissão,
   validar reprodução real de cada voz e queda limpa para texto se faltar motor.
3. Testar microfone, Groq/Gemini, modos, holograma, pausa e config persistida.
4. Compilar 0.1.5, testar backup/recuperação e atualizar de 0.1.4 a 0.1.5.
5. Usuário assina manifestos Ed25519 com chave privada fora do repositório.
6. Publicar release estável apenas após Windows validar ciclo completo.

Sem os passos 2–6, não existe atualização automática distribuída para o PC.
