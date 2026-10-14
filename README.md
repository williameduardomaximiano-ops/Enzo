# ENZO — assistente pessoal

Repositório privado do ENZO (Windows 10/11 x64).

**Estado em 14/10/2026:** repositório inicializado. O código-fonte da versão atualmente instalada no computador ainda precisa ser importado e auditado antes de publicar um instalador ou liberar atualização automática. Não confundir este projeto com JARVIS-Personal.

A distribuição futura usará GitHub Releases com manifesto assinado Ed25519, conferência SHA-256, versão e tamanho. O instalador só poderá ser executado depois da aprovação do usuário.

**Segurança:** não subir vault.enc, chaves Groq/Gemini, token GitHub, settings.json, memórias, logs, banco de dados pessoal ou cópia da instalação. A conta GitHub conectada ao ChatGPT não autentica automaticamente o aplicativo no Windows. Como este repositório é privado, o aplicativo precisará de autenticação de leitura específica, armazenada no cofre Windows (DPAPI), ou um canal público de binários assinados separado.

Antes do primeiro release real, integrar e testar o código atual no Windows, criar a chave de assinatura localmente e validar atualização entre duas versões.
