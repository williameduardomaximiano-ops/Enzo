import sys, unittest, runpy, subprocess
from pathlib import Path
from types import SimpleNamespace
WORKER=Path(__file__).resolve().parents[1]/'voice'/'worker.py'
accepted_text=runpy.run_path(str(WORKER))['accepted_text']
def segment(text='Abra a calculadora.',**kwargs):
    return SimpleNamespace(text=text,**dict(dict(avg_logprob=-.2,no_speech_prob=.01,compression_ratio=1.1),**kwargs))
class TranscriptQualityTests(unittest.TestCase):
    def test_embedded_isolated_search_path(self):
        code="import runpy,sys; from types import SimpleNamespace; w=runpy.run_path(sys.argv[1]); assert w['accepted_text']([SimpleNamespace(text='Oi',avg_logprob=-.2,no_speech_prob=.01,compression_ratio=1)])=='Oi'"
        subprocess.run([sys.executable,'-I','-c',code,str(WORKER)],check=True,cwd=WORKER.parent.parent)
    def test_clear_portuguese(self):
        self.assertEqual(accepted_text([segment()]),'Abra a calculadora.')
    def test_silence(self):
        self.assertEqual(accepted_text([]),'')
    def test_uncertain_segment_invalidates_whole_command(self):
        for values in [dict(avg_logprob=-1.2),dict(no_speech_prob=.9),dict(compression_ratio=3)]:
            self.assertEqual(accepted_text([segment('Abra'),segment('o banco',**values)]),'')
if __name__=='__main__':unittest.main()

