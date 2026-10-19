"""Local JSON-lines service. Never listens on a network interface."""
import sys, os, json, base64, io, wave, time, importlib.util
from pathlib import Path
ROOT=Path(os.environ.get('ENZO_MODELS', str(Path(__file__).parent.parent/'resources'/'models')))
voice=None
recognizer=None
engines={}
voices_state={}
ALLOWED_SUPERTONIC={'supertonic-m1':'M1','supertonic-m2':'M2','supertonic-m3':'M3','supertonic-m4':'M4','supertonic-m5':'M5'}
ALLOWED_POCKET={'pocket-rafael':('portuguese','rafael'),'pocket-george':('english','george'),'pocket-michael':('english','michael'),'pocket-paul':('english','paul')}
ALLOWED_KITTEN={f'kitten-{i}-m':f'expr-voice-{i}-m' for i in range(2,6)}
SPEED={'natural':1.0,'profissional':0.93,'descontraido':1.12}

def pcm_wav(audio,rate):
    import numpy as np
    mono=np.asarray(audio,dtype=np.float32).reshape(-1)
    pcm=(np.clip(mono,-1,1)*32767).astype('<i2').tobytes()
    out=io.BytesIO()
    with wave.open(out,'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(pcm)
    return out.getvalue()

def optional_speak(text,profile,tone):
    speed=SPEED[tone]
    if profile in ALLOWED_SUPERTONIC:
        if not importlib.util.find_spec('supertonic'):raise RuntimeError('Supertonic não instalado. Solicite instalação pelo OpenCode.')
        if 'supertonic' not in engines:
            from supertonic import TTS
            engines['supertonic']=TTS(auto_download=False)
        model=engines['supertonic']
        style=model.get_voice_style(voice_name=ALLOWED_SUPERTONIC[profile])
        audio,_=model.synthesize(text,voice_style=style,lang='pt',speed=speed)
        return pcm_wav(audio,44100)
    if profile in ALLOWED_POCKET:
        if not importlib.util.find_spec('pocket_tts'):raise RuntimeError('PocketTTS não instalado. Solicite instalação pelo OpenCode.')
        lang,preset=ALLOWED_POCKET[profile]
        key='pocket-'+lang
        if key not in engines:
            from pocket_tts import TTSModel
            engines[key]=TTSModel.load_model(language=lang)
        model=engines[key]
        voicekey=(key,preset)
        if voicekey not in voices_state:voices_state[voicekey]=model.get_state_for_audio_prompt(preset)
        generated=model.generate_audio(voices_state[voicekey],text)
        return pcm_wav(generated.detach().cpu().numpy(),model.sample_rate)
    if profile in ALLOWED_KITTEN:
        if not importlib.util.find_spec('kittentts'):raise RuntimeError('KittenTTS não instalado. Solicite instalação pelo OpenCode.')
        if 'kitten' not in engines:
            from kittentts import KittenTTS
            engines['kitten']=KittenTTS('KittenML/kitten-tts-nano-0.1')
        generated=engines['kitten'].generate(text,voice=ALLOWED_KITTEN[profile],speed=speed)
        return pcm_wav(generated,24000)
    raise ValueError('Voz não autorizada')


def execute(req):
    global voice, recognizer
    op=req.get('op')
    if op=='health':
        return {'tts':(ROOT/'pt_BR-faber-medium.onnx').is_file(), 'stt':(ROOT/'whisper-base'/'model.bin').is_file(), 'engines':{name:bool(importlib.util.find_spec(module)) for name,module in [('supertonic','supertonic'),('pocket','pocket_tts'),('kitten','kittentts')]}}
    if op=='speak':
        text=req.get('text','')
        if not isinstance(text,str) or not 0<len(text)<=6000: raise ValueError('Texto inválido')
        profile=req.get('voice','piper-faber')
        tone=req.get('tone','natural')
        if not isinstance(profile,str) or not isinstance(tone,str) or tone not in SPEED:
            raise ValueError('Voz ou estilo inválido')
        if profile=='piper-faber':
            if voice is None:
                from piper import PiperVoice
                voice=PiperVoice.load(str(ROOT/'pt_BR-faber-medium.onnx'))
            out=io.BytesIO()
            with wave.open(out,'wb') as wav: voice.synthesize_wav(text,wav)
            audio_bytes=out.getvalue()
        else:
            audio_bytes=optional_speak(text,profile,tone)
        return {'audio':base64.b64encode(audio_bytes).decode()}
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
        segments,_=recognizer.transcribe(pcm,language='pt',beam_size=1,vad_filter=True,condition_on_previous_text=False,initial_prompt='Conversa em português brasileiro. Nome do assistente: Cosmo. Nome anterior: Enzo.')
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
