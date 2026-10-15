# Componentes e fontes

ENZO: GPL-3.0-or-later (LICENSE). Código completo nesta entrega.

- Electron, MIT: https://github.com/electron/electron. Licenças Chromium e componentes em LICENSE.electron.txt / LICENSES.chromium.html no pacote Windows.
- Three.js, MIT: https://github.com/mrdoob/three.js. Licença instalada pelo npm.
- CPython 3.11.9, PSF: https://www.python.org/downloads/release/python-3119/. Licença incluída no runtime.
- Piper 1.3.0, GPLv3: https://github.com/OHF-Voice/piper1-gpl/tree/v1.3.0. Arquivo-fonte upstream incluído em piper-1.3.0-source.tar.gz. ENZO não altera o motor.
- Voz pt_BR-faber-medium: https://huggingface.co/rhasspy/piper-voices/tree/main/pt/pt_BR/faber/medium. MODEL_CARD incluído; dados CC0 conforme a ficha.
- Faster Whisper 1.2.0, MIT: https://github.com/SYSTRAN/faster-whisper. CTranslate2: https://github.com/OpenNMT/CTranslate2.
- Whisper Base convertido: https://huggingface.co/Systran/faster-whisper-base. Modelo Whisper original: https://github.com/openai/whisper.
- ONNX Runtime, MIT: https://github.com/microsoft/onnxruntime.
- PyAV e suas bibliotecas FFmpeg: https://github.com/PyAV-Org/PyAV. ENZO usa PCM para o reconhecimento; PyAV é dependência transitiva do faster-whisper. Consulte as licenças dos binários e fontes upstream correspondentes antes de distribuição pública.
- Microsoft Visual C++ Redistributable: componente redistribuível proprietário Microsoft, fornecido intacto do endereço oficial https://aka.ms/vs/17/release/vc_redist.x64.exe; termos exibidos pelo instalador Microsoft.
- Demais dependências Python: versões/hashes em voice/windows-dependencies.json, licenças em cada *.dist-info do runtime.
- Ferramentas de build: electron-builder e esbuild. Não são serviços pagos nem modelos remotos.

O aplicativo é uma compilação de desenvolvimento para validação pessoal. Antes de uma distribuição pública/comercial, revisar as obrigações de todos os binários transitivos, fornecer suas fontes correspondentes quando exigido e finalizar a assinatura e o canal de distribuição. Nenhum custo/licença de modelo online está implicitamente incluído.
