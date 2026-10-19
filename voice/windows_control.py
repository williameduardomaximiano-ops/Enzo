"""Small, explicit Windows input adapter; no shell, eval or arbitrary commands."""
import ctypes,json,sys,time
from ctypes import wintypes

def set_clipboard(text):
    kernel=ctypes.windll.kernel32;user=ctypes.windll.user32
    kernel.GlobalAlloc.restype=wintypes.HGLOBAL;kernel.GlobalLock.restype=ctypes.c_void_p
    kernel.GlobalLock.argtypes=[wintypes.HGLOBAL];kernel.GlobalUnlock.argtypes=[wintypes.HGLOBAL]
    user.SetClipboardData.argtypes=[wintypes.UINT,wintypes.HANDLE];user.SetClipboardData.restype=wintypes.HANDLE
    data=(text+'\0').encode('utf-16-le');h=kernel.GlobalAlloc(0x42,len(data));p=kernel.GlobalLock(h)
    if not p:raise RuntimeError('Falha na área de transferência')
    ctypes.memmove(p,data,len(data));kernel.GlobalUnlock(h)
    for _ in range(10):
        if user.OpenClipboard(None):break
        time.sleep(0.05)
    else:raise RuntimeError('Área de transferência ocupada')
    try:user.EmptyClipboard();user.SetClipboardData(13,h)
    finally:user.CloseClipboard()

def screen_action(action,user):
    """Clique, digitação e atalhos pedidos pelo COSMO (cada ação já foi aprovada no app)."""
    try:user.SetProcessDPIAware()  # coordenadas em pixels físicos, iguais aos da captura
    except Exception:pass
    def key(v,up=False):user.keybd_event(v,0,2 if up else 0,0)
    def combo(*vs):
        for v in vs:key(v)
        for v in reversed(vs):key(v,True)
    def click(x,y,double=False):
        w,h=user.GetSystemMetrics(0),user.GetSystemMetrics(1)
        if not(0<=x<w and 0<=y<h):raise ValueError('Posição fora da tela')
        user.SetCursorPos(int(x),int(y));time.sleep(0.05)
        for _ in range(2 if double else 1):
            user.mouse_event(0x0002,0,0,0,0);user.mouse_event(0x0004,0,0,0,0);time.sleep(0.06)
    t=action['type']
    if t=='click':
        click(int(action['x']),int(action['y']),bool(action.get('double')))
    elif t=='type_here':
        text=action.get('text','')
        if not isinstance(text,str) or not 0<len(text)<=4000:raise ValueError('Texto inválido')
        if 'x' in action and 'y' in action:click(int(action['x']),int(action['y']));time.sleep(0.15)
        set_clipboard(text);combo(0x11,0x56);time.sleep(0.05)
        if action.get('enter'):combo(0x0D)
    else:
        mapping={'enter':(0x0D,),'tab':(0x09,),'escape':(0x1B,),'copy':(0x11,0x43),'paste':(0x11,0x56),'select_all':(0x11,0x41),'undo':(0x11,0x5A),'save':(0x11,0x53),'new_tab':(0x11,0x54),'close_tab':(0x11,0x57),'alt_tab':(0x12,0x09)}
        vs=mapping.get(action.get('keys'))
        if not vs:raise ValueError('Atalho bloqueado')
        combo(*vs)
    return {'ok':True}

def run(action):
    if sys.platform!='win32':raise RuntimeError('Controle de teclado exige Windows.')
    user=ctypes.windll.user32
    class LASTINPUTINFO(ctypes.Structure): _fields_=[('cbSize',wintypes.UINT),('dwTime',wintypes.DWORD)]
    def last():
        x=LASTINPUTINFO();x.cbSize=ctypes.sizeof(x);user.GetLastInputInfo(ctypes.byref(x));return x.dwTime
    if action['type'] in ('click','type_here','keys'):
        return screen_action(action,user)
    if action['type']=='empty_recycle':
        # SHERB_NOCONFIRMATION|NOPROGRESSUI|NOSOUND; lixeira já vazia também conta como sucesso.
        hr=ctypes.windll.shell32.SHEmptyRecycleBinW(None,None,0x7)
        if hr not in (0,-2147418113):raise RuntimeError(f'Falha ao esvaziar a Lixeira ({hr})')
        return {'ok':True}
    if action['type']=='media':
        # Teclas multimídia do Windows: não dependem da janela em foco nem digitam texto.
        mapping={'volume_up':0xAF,'volume_down':0xAE,'mute':0xAD,'play_pause':0xB3,'next':0xB0,'previous':0xB1}
        v=mapping.get(action.get('key'))
        if v is None:raise ValueError('Tecla de mídia bloqueada')
        for _ in range(5 if action['key'] in ('volume_up','volume_down') else 1):
            user.keybd_event(v,0,0,0);user.keybd_event(v,0,2,0);time.sleep(0.02)
        return {'ok':True}
    original=last();target=user.GetForegroundWindow()
    # Count down lets the owner choose the target. Abort on activity after this point.
    def check():
        if user.GetForegroundWindow()!=target or last()!=original:raise RuntimeError('Entrada humana detectada: controle interrompido.')
    def key(v,up=False):user.keybd_event(v,0,2 if up else 0,0)
    if action['type']=='hotkey':
        mapping={'copy':0x43,'paste':0x56,'select_all':0x41,'undo':0x5A,'save':0x53}
        v=mapping.get(action.get('key'))
        if v is None:raise ValueError('Atalho bloqueado')
        check();key(0x11)
        try:key(v);key(v,True)
        finally:key(0x11,True)
    elif action['type']=='type_text':
        # Paste through Unicode clipboard in one atomic operation, no keyboard loop.
        text=action.get('text','')
        if not isinstance(text,str) or not 0<len(text)<=1500:raise ValueError('Texto inválido')
        kernel=ctypes.windll.kernel32
        kernel.GlobalAlloc.restype=wintypes.HGLOBAL;kernel.GlobalLock.restype=ctypes.c_void_p
        kernel.GlobalLock.argtypes=[wintypes.HGLOBAL];kernel.GlobalUnlock.argtypes=[wintypes.HGLOBAL]
        user.SetClipboardData.argtypes=[wintypes.UINT,wintypes.HANDLE];user.SetClipboardData.restype=wintypes.HANDLE
        data=(text+'\0').encode('utf-16-le');h=kernel.GlobalAlloc(0x42,len(data));p=kernel.GlobalLock(h)
        if not p:raise RuntimeError('Falha na área de transferência')
        ctypes.memmove(p,data,len(data));kernel.GlobalUnlock(h)
        check()
        if not user.OpenClipboard(None):raise RuntimeError('Área de transferência ocupada')
        try:user.EmptyClipboard();user.SetClipboardData(13,h)
        finally:user.CloseClipboard()
        check();key(0x11)
        try:key(0x56);key(0x56,True)
        finally:key(0x11,True)
    else:raise ValueError('Ação bloqueada')
    return {'ok':True}
if __name__=='__main__':
    try:print(json.dumps(run(json.load(sys.stdin))))
    except Exception as e:print(json.dumps({'error':str(e)}));sys.exit(1)
