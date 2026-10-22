"""Local JSON-lines service. Never listens on a network interface."""
import sys, os, json, base64, io, wave, time, traceback
from pathlib import Path
ROOT=Path(os.environ.get('ENZO_MODELS', str(Path(__file__).parent.parent/'resources'/'models')))
voice=None
recognizer=None

def jarvis_style(raw):
    """Timbre estilo assistente de IA: mais grave e calmo, leve brilho metálico e eco curto."""
    import numpy as np
    with wave.open(io.BytesIO(raw),'rb') as wav:
        rate,width,channels=wav.getframerate(),wav.getsampwidth(),wav.getnchannels()
        if width!=2 or channels!=1: return raw
        x=np.frombuffer(wav.readframes(wav.getnframes()),dtype=np.int16).astype(np.float32)/32768.0
    y=x.copy()
    d=int(rate*0.0045); y[d:]+=0.28*x[:-d]          # filtro pente: timbre metálico
    t=np.arange(len(y))/rate; y*=1+0.06*np.sin(2*np.pi*55*t)   # modulação sutil "eletrônica"
    for delay,gain in ((0.045,0.16),(0.09,0.08)):   # eco curto de sala
        d=int(rate*delay); y[d:]+=gain*x[:-d]
    y=np.concatenate([y,np.zeros(int(rate*0.12),dtype=np.float32)])
    y/=max(1.0,float(np.abs(y).max())/0.92)
    out=io.BytesIO()
    with wave.open(out,'wb') as wav:
        wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(int(rate*0.92))   # ~8% mais grave e pausado
        wav.writeframes((y*32767).astype(np.int16).tobytes())
    return out.getvalue()

def prepare_audio(pcm):
    """Remove deslocamento DC e ajusta o volume: voz baixa ou distante vira volume de conversa, sem estourar."""
    import numpy as np
    x=pcm.astype(np.float32)-float(np.mean(pcm)) if len(pcm) else pcm.astype(np.float32)
    if not len(x):return x
    rms=float(np.sqrt(np.mean(x*x)));peak=float(np.max(np.abs(x)))
    if rms<1e-4:return x
    gain=min(0.1/rms,0.95/peak,20.0)  # alvo ~ -20 dBFS, sem passar do pico e no máximo 20x
    return (x*gain if gain>1 else x).astype(np.float32)  # só amplifica; voz normal ou alta fica como está

def execute(req):
    global voice, recognizer
    op=req.get('op')
    if op=='health':
        return {'tts':(ROOT/'pt_BR-faber-medium.onnx').is_file(), 'stt':(ROOT/'whisper-base'/'model.bin').is_file()}
    if op=='warmup':
        # Carrega voz e reconhecimento ao abrir o COSMO, para a primeira resposta não esperar o carregamento.
        if voice is None and (ROOT/'pt_BR-faber-medium.onnx').is_file():
            from piper import PiperVoice
            voice=PiperVoice.load(str(ROOT/'pt_BR-faber-medium.onnx'))
        if recognizer is None and (ROOT/'whisper-base'/'model.bin').is_file():
            from faster_whisper import WhisperModel
            recognizer=WhisperModel(str(ROOT/'whisper-base'),device='cpu',compute_type='int8',cpu_threads=max(1,min(4,os.cpu_count() or 2)),local_files_only=True)
        return {'tts':voice is not None,'stt':recognizer is not None}
    if op=='speak':
        text=req.get('text','')
        if not isinstance(text,str) or not 0<len(text)<=6000: raise ValueError('Texto inválido')
        if voice is None:
            from piper import PiperVoice
            voice=PiperVoice.load(str(ROOT/'pt_BR-faber-medium.onnx'))
        out=io.BytesIO()
        with wave.open(out,'wb') as wav: voice.synthesize_wav(text,wav)
        return {'audio':base64.b64encode(jarvis_style(out.getvalue())).decode()}
    if op=='transcribe':
        encoded=req.get('audio','')
        if not isinstance(encoded,str) or len(encoded)>3000000: raise ValueError('Áudio excede o limite')
        raw=base64.b64decode(encoded,validate=True)
        import numpy as np
        with wave.open(io.BytesIO(raw),'rb') as wav:
            if wav.getnchannels()!=1 or wav.getsampwidth()!=2 or wav.getframerate()!=16000 or wav.getnframes()>16000*35: raise ValueError('Formato de áudio inválido')
            pcm=np.frombuffer(wav.readframes(wav.getnframes()),dtype=np.int16).astype(np.float32)/32768.0
        if recognizer is None:
            from faster_whisper import WhisperModel
            recognizer=WhisperModel(str(ROOT/'whisper-base'),device='cpu',compute_type='int8',cpu_threads=max(1,min(4,os.cpu_count() or 2)),local_files_only=True)
        prompt=req.get('prompt') if isinstance(req.get('prompt'),str) else ''
        segments,_=recognizer.transcribe(prepare_audio(pcm),language='pt',beam_size=5,best_of=5,temperature=(0.0,0.2,0.4),
            vad_filter=True,vad_parameters={'min_silence_duration_ms':400,'speech_pad_ms':300},no_speech_threshold=0.6,
            condition_on_previous_text=False,initial_prompt=(prompt[:900] or 'Conversa em português do Brasil com o assistente Cosmo. Nomes: Cosmo e William.'))
        items=list(segments)
        text=' '.join(s.text.strip() for s in items).strip()
        # Evita executar comandos quando TODAS as partes foram reconhecidas com baixíssima confiança.
        very_low=bool(items) and all(getattr(s,'avg_logprob',0.0)<-1.2 for s in items)
        return {'text':text,'uncertain':bool(text and very_low)}
    raise ValueError('Operação desconhecida')

if __name__=='__main__':
    for line in sys.stdin:
        req={}
        try:
            if len(line)>3100000: raise ValueError('Requisição excede o limite')
            req=json.loads(line);start=time.monotonic();result=execute(req)
            print(json.dumps({'id':req.get('id'),'result':result,'ms':round((time.monotonic()-start)*1000)},ensure_ascii=True),flush=True)
        except Exception as e:
            print(json.dumps({'id':req.get('id'),'error':str(e)[:300]},ensure_ascii=True),flush=True)
