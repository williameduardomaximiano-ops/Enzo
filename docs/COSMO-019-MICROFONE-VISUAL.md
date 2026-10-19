# COSMO 0.1.9 — microfone e aparência original

## Problemas reportados no Windows 0.1.8
- Ao ativar microfone, ele ligava e desligava.
- A aparência continuava no holograma antigo azul e só alternava cores.

## Diagnóstico e correções
- O ui/app.js encerrava o microfone após transcrição se a opção de conversa contínua estivesse desmarcada. A captura agora fica aberta até o usuário desligar, acionar parada de emergência ou perder o dispositivo.
- Ativação reentrante bloqueada com micStarting. Indicador e mensagem esclarecem situação, inclusive quando o hardware desconecta.
- Removida a opção ambígua de uma única fala da interface. Microfone inicia apenas com o botão ou atalho.
- Os seis filtros de cor antigos deixam de aparecer como modelos novos na galeria.
- Para usar EXATAMENTE a cabeça preta com cérebro dourado, uma cópia JPEG original precisa ser selecionada uma vez pelo usuário no botão da tela inicial ou na aba Aparência.
- O JPEG é salvo nos dados locais e recuperado ao reabrir COSMO. Sem esse arquivo, a imagem azul antiga não aparece e a interface solicita a importação correta.
- Movimentos são 2,5D e boca reage à intensidade do áudio. A sincronização fonética completa e rig 3D permanecem pendentes.
- A foto original preta/dourada não estava no repositório. Não foram geradas versões semelhantes nem substituídas as cores da imagem enviada.

## Teste presencial
1. Fazer backup e fechar COSMO; reinstalar 0.1.9 no diretório atual, sem apagar os dados.
2. Na primeira abertura, escolher o JPEG original da cabeça preta e dourada.
3. Conferir identidade visual intacta, brilho e movimentos suaves.
4. Ativar microfone, falar, aguardar resposta e verificar se permanece ativo. Repetir três vezes.
5. Desligar manualmente e confirmar que fica inativo; testar o atalho Ctrl+Alt+Espaço.
6. Se houver falha, guardar mensagem de erro e resultado do teste do microfone nas configurações.

Estado: compilação e testes automatizados necessários; validação do microfone e GPU em máquina real ainda será feita.
