import importlib.util,pathlib,time,base64,json,wave,io,math,numpy as np
from scipy.signal import resample_poly
root=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('worker',root/'voice/worker.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
start=time.perf_counter();r=w.execute({'op':'speak','text':'Olá, William. Eu sou o Enzo. Abra a calculadora.'});tts=time.perf_counter()-start
raw=base64.b64decode(r['audio']);(root/'docs/voz-enzo.wav').write_bytes(raw)
with wave.open(io.BytesIO(raw)) as a:sr=a.getframerate();x=np.frombuffer(a.readframes(a.getnframes()),dtype=np.int16)
y=resample_poly(x.astype(float),16000,sr).clip(-32768,32767).astype(np.int16);out=io.BytesIO()
with wave.open(out,'wb') as a:a.setnchannels(1);a.setsampwidth(2);a.setframerate(16000);a.writeframes(y.tobytes())
start=time.perf_counter();stt=w.execute({'op':'transcribe','audio':base64.b64encode(out.getvalue()).decode()});elapsed=time.perf_counter()-start
start=time.perf_counter();w.execute({'op':'speak','text':'Pronto. Vamos trabalhar.'});warm=time.perf_counter()-start
report={'environment':'Linux CPU; synthetic voice roundtrip, not microphone or Windows','tts_seconds_cold':tts,'tts_seconds_warm':warm,'stt_seconds_cold':elapsed,'transcription':stt['text'],'audio_seconds':len(x)/sr}
(root/'docs/voice-test.json').write_text(json.dumps(report,indent=2,ensure_ascii=False));print(report)
assert 'calculadora' in stt['text'].lower()
