"""Local JSON-lines service. Never listens on a network interface."""
import sys, os, json, base64, io, wave, time, traceback
from pathlib import Path
ROOT=Path(os.environ.get('ENZO_MODELS', str(Path(__file__).parent.parent/'resources'/'models')))
voice=None
recognizer=None

def execute(req):
    global voice, recognizer
    op=req.get('op')
    if op=='health':
        return {'tts':(ROOT/'pt_BR-faber-medium.onnx').is_file(), 'stt':(ROOT/'whisper-base'/'model.bin').is_file()}
    if op=='speak':
        text=req.get('text','')
        if not isinstance(text,str) or not 0<len(text)<=6000: raise ValueError('Texto inválido')
        if voice is None:
            from piper import PiperVoice
            voice=PiperVoice.load(str(ROOT/'pt_BR-faber-medium.onnx'))
        out=io.BytesIO()
        with wave.open(out,'wb') as wav: voice.synthesize_wav(text,wav)
        return {'audio':base64.b64encode(out.getvalue()).decode()}
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
        segments,_=recognizer.transcribe(pcm,language='pt',beam_size=1,vad_filter=True,condition_on_previous_text=False,initial_prompt='Conversa em português brasileiro. Nomes: Enzo e William.')
        return {'text':' '.join(s.text.strip() for s in segments).strip()}
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
