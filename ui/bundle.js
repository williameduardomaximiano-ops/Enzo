(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // core/wake.cjs
  var require_wake = __commonJS({
    "core/wake.cjs"(exports, module) {
      var NAME = "(?:enzo|enso|\xEAnzo|jarvis)";
      var GREET = "(?:bom dia|boa tarde|boa noite|ol\xE1|ola|oi|e a\xED|e ai|fala)";
      var START = new RegExp(`^(?:(?:ei|ok|${GREET})[, ]+)?${NAME}\\b[,.!? ]*`, "i");
      var END = new RegExp(`[, ]+${NAME}[.!? ]*$`, "i");
      function wakeWord2(text) {
        if (typeof text !== "string") return null;
        const s = text.trim().replace(/^[^\p{L}]+/u, "");
        const m = s.match(START);
        if (m) {
          const rest = s.slice(m[0].length).trim();
          const greet = m[0].match(new RegExp(`^${GREET}`, "i"));
          return rest || (greet ? greet[0] : "");
        }
        const e = s.match(END);
        if (e && e.index > 0) return s.slice(0, e.index).trim();
        return null;
      }
      function stripName(text) {
        return String(text).trim().replace(new RegExp(`^(?:ei|ok)?[, ]*${NAME}[, ]+`, "i"), "").replace(END, "").trim() || String(text).trim();
      }
      module.exports = { wakeWord: wakeWord2, stripName };
    }
  });

  // ui/app.js
  var import_wake = __toESM(require_wake());
  var $ = (s) => document.querySelector(s);
  var holo;
  function voiceLevel(v) {
    $(".presence")?.style.setProperty("--lvl", Math.min(1, v * 4).toFixed(3));
  }
  var armed = 0;
  var greeted = false;
  var batteryWarned = false;
  var turn = null;
  var secs = (ms) => (ms / 1e3).toFixed(1).replace(".", ",");
  function mark(k) {
    if (turn) turn[k] = performance.now();
  }
  function reportTurn() {
    if (!turn?.heard || !turn.stt) return;
    const t = turn, now = performance.now();
    const think = (t.chat || t.stt) - t.stt, voice = now - (t.chat || t.stt);
    $("#voice-metric").textContent = `\xDAltima resposta por voz: ${secs(now - t.end)} s \u2014 entender a fala ${secs(t.stt - t.end)} s \xB7 pensar ${secs(think)} s \xB7 gerar a voz ${secs(voice)} s`;
    notice(`Respondi em ${secs(now - t.end)} s.`);
    turn = null;
  }
  var api = window.enzo;
  var settings = {};
  var active = false;
  var busy = false;
  var audioCtx;
  var stream;
  var processor;
  var source;
  var frames = [];
  var samples = 0;
  var heard = false;
  var silent = 0;
  var generation = 0;
  var playing;
  var playCtx;
  var uiState = "idle";
  var SENS = { alta: 8e-3, normal: 0.013, baixa: 0.022 };
  var micPeak = 0;
  var testing = false;
  var names = { idle: "DISPON\xCDVEL", listening: "OUVINDO", thinking: "PENSANDO", speaking: "FALANDO", permission: "AGUARDANDO AUTORIZA\xC7\xC3O", executing: "EXECUTANDO", paused: "PAUSADO", updating: "ATUALIZANDO" };
  function notice(t) {
    $("#notice").textContent = t || "";
  }
  function state(s) {
    uiState = s;
    $("#state-label").textContent = names[s] || s;
    holo?.setState(s);
    $("#holo-text").textContent = { listening: settings.wake && !armed ? "Diga \u201CEnzo\u201D para me chamar." : "Pode falar. Estou ouvindo.", thinking: "Um instante, estou pensando.", speaking: "Vamos conversar.", paused: "Seu espa\xE7o est\xE1 em modo privacidade.", permission: "A decis\xE3o \xE9 sua.", executing: "Executando sua solicita\xE7\xE3o." }[s] || "Pronto quando voc\xEA precisar.";
  }
  function setMeter(v) {
    const m = $("#mic-level");
    if (m) m.style.width = Math.round(Math.min(1, Math.max(0, v)) * 100) + "%";
  }
  async function invoke(name, ...args) {
    const r = await api[name](...args);
    if (!r.ok) throw Error(r.error);
    return r.data;
  }
  function message(text, who = "assistant") {
    const node = document.createElement("article");
    node.className = who;
    const label = document.createElement("label");
    label.textContent = who === "user" ? "VOC\xCA" : "ENZO";
    const p = document.createElement("p");
    p.textContent = text;
    node.append(label, p);
    $("#messages").append(node);
    $("#messages").scrollTop = $("#messages").scrollHeight;
  }
  function stopAudio() {
    if (playing) {
      playing.onended = null;
      try {
        playing.stop();
      } catch {
      }
      playing = null;
    }
    if (playCtx) {
      playCtx.close();
      playCtx = null;
    }
    voiceLevel(0);
  }
  function closeMic() {
    active = false;
    setMeter(0);
    stream?.getTracks().forEach((t) => t.stop());
    processor?.disconnect();
    source?.disconnect();
    audioCtx?.close();
    stream = null;
    processor = null;
    source = null;
    audioCtx = null;
    frames = [];
    samples = 0;
    heard = false;
    silent = 0;
    $("#mic").textContent = "Ativar microfone";
    $("#micro-status").textContent = "MICROFONE DESLIGADO";
  }
  async function emergency() {
    generation++;
    closeMic();
    stopAudio();
    busy = false;
    $("#send").disabled = false;
    await invoke("stop");
    state("paused");
    $("#resume").hidden = false;
    notice("Pausado. Use Retomar para permitir novos pedidos.");
  }
  async function speak(text, token = generation) {
    const start = performance.now();
    try {
      let animate = function() {
        if (done) return;
        analyser.getByteTimeDomainData(arr);
        voiceLevel(Math.sqrt(arr.reduce((s, v) => s + ((v - 128) / 128) ** 2, 0) / arr.length));
        requestAnimationFrame(animate);
      };
      const data = await invoke("speak", text);
      if (token !== generation) return;
      $("#voice-metric").textContent = `S\xEDntese: ${data.ms} ms \xB7 Espera total: ${Math.round(performance.now() - start)} ms`;
      const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
      playCtx = new AudioContext();
      const buffer = await playCtx.decodeAudioData(bytes.buffer);
      if (token !== generation) {
        stopAudio();
        return;
      }
      const player = playCtx.createBufferSource();
      playing = player;
      const analyser = playCtx.createAnalyser();
      analyser.fftSize = 256;
      player.buffer = buffer;
      player.connect(analyser);
      analyser.connect(playCtx.destination);
      state("speaking");
      const arr = new Uint8Array(analyser.fftSize);
      let done = false;
      animate();
      await new Promise((resolve) => {
        player.onended = () => {
          done = true;
          resolve();
        };
        player.start();
        reportTurn();
        const check = setInterval(() => {
          if (token !== generation) {
            done = true;
            clearInterval(check);
            resolve();
          }
          if (done) clearInterval(check);
        }, 100);
      });
      stopAudio();
    } catch (e) {
      if (token === generation) notice("Voz neural indispon\xEDvel: " + e.message + " A resposta permanece em texto.");
    } finally {
      if (token === generation) state(active ? "listening" : "idle");
    }
  }
  async function send(text) {
    if (busy) {
      notice("Aguarde a resposta ou use Parar tudo.");
      return;
    }
    busy = true;
    const token = generation;
    $("#send").disabled = true;
    message(text, "user");
    notice("");
    state("thinking");
    try {
      const r = await invoke("chat", text);
      mark("chat");
      if (token !== generation) return;
      message(r.text || r.say);
      await speak(r.say, token);
    } catch (e) {
      if (token === generation) {
        message(e.message);
        notice(e.message);
      }
    } finally {
      if (token === generation) {
        busy = false;
        $("#send").disabled = false;
        frames = [];
        samples = 0;
        silent = 0;
        heard = false;
        state(active ? "listening" : "idle");
      }
    }
  }
  function wavBase64(chunks) {
    const total = chunks.reduce((n, x) => n + x.length, 0);
    const b = new ArrayBuffer(44 + total * 2), v = new DataView(b);
    const str = (o, s2) => {
      for (let i = 0; i < s2.length; i++) v.setUint8(o + i, s2.charCodeAt(i));
    };
    str(0, "RIFF");
    v.setUint32(4, 36 + total * 2, true);
    str(8, "WAVE");
    str(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, 16e3, true);
    v.setUint32(28, 32e3, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    str(36, "data");
    v.setUint32(40, total * 2, true);
    let at = 44;
    for (const chunk of chunks) for (const x of chunk) {
      v.setInt16(at, Math.max(-1, Math.min(1, x)) * 32767, true);
      at += 2;
    }
    const bytes = new Uint8Array(b);
    let s = "";
    for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(s);
  }
  async function transcribe(chunks) {
    const token = generation;
    busy = true;
    state("thinking");
    try {
      const data = await invoke("transcribe", wavBase64(chunks));
      mark("stt");
      if (token !== generation) return;
      busy = false;
      const heardText = (data.text || "").trim();
      if (settings.wake) {
        const cmd = (0, import_wake.wakeWord)(heardText);
        if (cmd === null) {
          if (heardText && Date.now() < armed) {
            armed = 0;
            await send(heardText);
          }
        } else if (!cmd) {
          message("Pois n\xE3o, senhor?");
          await speak("Pois n\xE3o, senhor?", token);
          frames = [];
          samples = 0;
          heard = false;
          silent = 0;
          armed = Date.now() + 8e3;
          state("listening");
        } else {
          armed = 0;
          await send(cmd);
        }
      } else if (heardText) await send(heardText);
      else notice("N\xE3o identifiquei fala. Tente novamente.");
    } catch (e) {
      if (token === generation) notice("Falha no reconhecimento: " + e.message);
    } finally {
      if (token === generation) {
        busy = false;
        frames = [];
        samples = 0;
        heard = false;
        silent = 0;
        if (!settings.continuous && !settings.wake) closeMic();
        state(active ? "listening" : "idle");
      }
    }
  }
  async function toggleMic() {
    if (active) {
      generation++;
      closeMic();
      stopAudio();
      await invoke("stop");
      $("#resume").hidden = false;
      state("paused");
      return;
    }
    if (busy) return;
    await invoke("resume");
    $("#resume").hidden = true;
    const token = ++generation;
    notice("");
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: settings.micDevice || $("#device").value ? { exact: settings.micDevice || $("#device").value } : void 0, channelCount: 1, echoCancellation: settings.micEcho !== false, noiseSuppression: settings.micNoise !== false, autoGainControl: settings.micGain !== false }, video: false });
      if (token !== generation) {
        closeMic();
        return;
      }
      audioCtx = new AudioContext({ sampleRate: 16e3 });
      if (audioCtx.sampleRate !== 16e3) throw Error("O dispositivo n\xE3o aceitou 16 kHz. Selecione outro microfone.");
      source = audioCtx.createMediaStreamSource(stream);
      processor = audioCtx.createScriptProcessor(2048, 1, 1);
      source.connect(processor);
      processor.connect(audioCtx.destination);
      active = true;
      state("listening");
      $("#mic").textContent = "Desligar microfone";
      $("#micro-status").textContent = "MICROFONE ATIVO";
      await refreshMics();
      processor.onaudioprocess = (e) => {
        if (!active || busy || uiState === "speaking") return;
        const input = new Float32Array(e.inputBuffer.getChannelData(0));
        const rms = Math.sqrt(input.reduce((s, x) => s + x * x, 0) / input.length);
        setMeter(Math.min(1, rms / 0.1));
        const thr = SENS[settings.micSensitivity] || 0.013;
        if (rms > thr) {
          heard = true;
          silent = 0;
        } else silent += input.length;
        frames.push(input);
        samples += input.length;
        if (!heard && samples > 16e3) {
          frames = frames.slice(-3);
          samples = frames.reduce((n, x) => n + x.length, 0);
        }
        if (heard && (silent > 16e3 * 0.7 || samples >= 16e3 * 28)) {
          const chunks = frames;
          frames = [];
          samples = 0;
          heard = false;
          silent = 0;
          turn = { end: performance.now(), heard: true };
          transcribe(chunks);
        }
      };
    } catch (e) {
      closeMic();
      notice("Microfone: " + e.message);
      state("idle");
    }
  }
  $("#chat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("#input").value.trim();
    if (text) {
      $("#input").value = "";
      send(text);
    }
  });
  $("#input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      $("#chat-form").requestSubmit();
    }
  });
  document.querySelectorAll("[data-command]").forEach((b) => b.onclick = () => send(b.dataset.command));
  $("#mic").onclick = () => toggleMic().catch((e) => notice(e.message));
  $("#stop").onclick = emergency;
  $("#resume").onclick = async () => {
    await invoke("resume");
    $("#resume").hidden = true;
    notice("");
    state("idle");
  };
  $("#compact").onclick = () => invoke("window", "compact");
  document.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x.id === b.dataset.tab));
    document.querySelectorAll("[data-tab]").forEach((x) => x.classList.toggle("selected", x === b));
    $("#heading").textContent = { home: "Intelig\xEAncia com presen\xE7a.", settings: "Voc\xEA no controle.", android: "Uma presen\xE7a, dois dispositivos.", updates: "Sempre evoluindo." }[b.dataset.tab];
  });
  async function save() {
    settings = await invoke("configure", { agent: $("#agent").value, agentFull: $("#agent-full").checked, quickOpen: $("#quick-open").checked, wake: $("#wake").checked, greet: $("#greet").checked, city: $("#city").value.trim(), provider: $("#provider").value, groqModel: $("#groq-model").value.trim(), geminiModel: $("#gemini-model").value.trim(), autoUpdate: $("#auto-update").checked, micDevice: $("#device").value, micSensitivity: $("#mic-sensitivity").value, micNoise: $("#mic-noise").checked, micEcho: $("#mic-echo").checked, micGain: $("#mic-gain").checked, continuous: $("#continuous").checked, remember: $("#remember").checked });
    notice("Configura\xE7\xE3o salva.");
  }
  $("#save-settings").onclick = () => save().catch((e) => notice(e.message));
  $("#continuous").onchange = save;
  $("#remember").onchange = save;
  $("#test-voice").onclick = () => speak("Ol\xE1, William. Eu sou o Enzo. Minha voz est\xE1 sendo gerada aqui, no seu computador. Vamos trabalhar?");
  $("#clear").onclick = async () => {
    await invoke("clearHistory");
    $("#messages").replaceChildren();
    notice("Conversa apagada.");
  };
  $("#pair").onclick = async () => {
    try {
      const r = await invoke("android", true);
      $("#pair-info").textContent = r ? `Abra no Android:
${r.urls.join("\n")}

C\xF3digo: ${r.code}
V\xE1lido at\xE9 ${new Date(r.expires).toLocaleTimeString()}` : "Conex\xE3o desativada.";
    } catch (e) {
      notice(e.message);
    }
  };
  $("#unpair").onclick = async () => {
    await invoke("android", false);
    $("#pair-info").textContent = "Conex\xE3o desativada.";
  };
  $("#check-update").onclick = async () => {
    try {
      $("#update-info").textContent = await invoke("checkUpdate");
    } catch (e) {
      $("#update-info").textContent = e.message;
    }
  };
  $("#install-update").onclick = async () => {
    try {
      $("#update-info").textContent = await invoke("installUpdate");
    } catch (e) {
      $("#update-info").textContent = e.message;
    }
  };
  api.onEvent((e) => {
    if (e.type === "state" && e.state !== "idle") state(e.state);
    if (e.type === "notice") notice(e.text);
    if (e.type === "stop") {
      generation++;
      closeMic();
      stopAudio();
      busy = false;
      $("#send").disabled = false;
      $("#resume").hidden = false;
      state("paused");
    }
    if (e.type === "toggle-mic") toggleMic();
    if (e.type === "compact") document.body.classList.toggle("compact", e.enabled);
    if (e.type === "proactive") proactive(e.text);
    if (e.type === "agent") agentEvent(e);
    if (e.type === "hud") window.dispatchEvent(new Event("enzo-hud"));
    if (e.type === "remote") {
      message("[Android] " + e.text, "user");
      message(e.reply);
    }
    if (e.type === "update" && e.update) {
      $("#update-info").textContent = `Vers\xE3o ${e.update.version}
${e.update.notes}`;
      notice("H\xE1 uma atualiza\xE7\xE3o verificada dispon\xEDvel.");
    }
  });
  invoke("status").then((s) => {
    settings = s.settings;
    $("#provider").value = settings.provider || "auto";
    $("#groq-model").value = settings.groqModel || "openai/gpt-oss-120b";
    $("#gemini-model").value = settings.geminiModel || "gemini-3.5-flash";
    $("#continuous").checked = settings.continuous;
    $("#remember").checked = settings.remember;
    $("#auto-update").checked = settings.autoUpdate !== false;
    $("#device").value = settings.micDevice || "";
    $("#mic-sensitivity").value = settings.micSensitivity || "normal";
    $("#mic-noise").checked = settings.micNoise !== false;
    $("#mic-echo").checked = settings.micEcho !== false;
    $("#mic-gain").checked = settings.micGain !== false;
    refreshMics().catch(() => {
    });
    $("#version").textContent = s.version;
    $("#hardware").textContent = `Detectado: ${s.ramGB} GB de RAM \xB7 ${s.cpus} processadores l\xF3gicos`;
    const p = s.providers || {};
    $("#vault-status").textContent = `Cofre: Groq ${p.groq ? "\u2713" : "\u2014"} \xB7 Gemini ${p.gemini ? "\u2713" : "\u2014"} \xB7 GitHub ${p.github ? "\u2713" : "\u2014"}${s.encryption ? "" : " \xB7 criptografia indispon\xEDvel"}`;
  }).catch((e) => notice(e.message));
  $("#get-vc").onclick = () => invoke("dependency", "vc").catch((e) => notice(e.message));
  $("#diagnostics").onclick = async () => {
    try {
      const d = await invoke("diagnostics");
      const p = d.providers || {};
      notice(`Voz: ${d.voice.tts ? "modelo presente" : "modelo ausente"} \xB7 Reconhecimento: ${d.voice.stt ? "modelo presente" : "modelo ausente"} \xB7 Nuvem: Groq ${p.groq ? "\u2713" : "\u2014"} Gemini ${p.gemini ? "\u2713" : "\u2014"} GitHub ${p.github ? "\u2713" : "\u2014"}. A presen\xE7a dos modelos n\xE3o substitui o teste de \xE1udio.`);
    } catch (e) {
      notice(e.message);
    }
  };
  function vaultText(st) {
    return `Cofre: Groq ${st.groq ? "\u2713" : "\u2014"} \xB7 Gemini ${st.gemini ? "\u2713" : "\u2014"} \xB7 GitHub ${st.github ? "\u2713" : "\u2014"}`;
  }
  $("#save-vault").onclick = async () => {
    try {
      const ids = { groq: "#groq-key", gemini: "#gemini-key", github: "#github-key" };
      let st = null;
      for (const k of Object.keys(ids)) {
        const v = $(ids[k]).value.trim();
        if (!v) continue;
        st = await invoke("vaultSet", { provider: k, key: v });
        $(ids[k]).value = "";
      }
      if (!st) st = await invoke("vaultStatus").then((r) => r.configured);
      $("#vault-status").textContent = vaultText(st) + " \xB7 salvo criptografado.";
      notice("Chaves salvas no cofre criptografado.");
    } catch (e) {
      notice("Cofre: " + e.message);
    }
  };
  $("#vault-state").onclick = async () => {
    try {
      const r = await invoke("vaultStatus");
      $("#vault-status").textContent = vaultText(r.configured) + (r.encryption ? "" : " \xB7 criptografia indispon\xEDvel");
    } catch (e) {
      notice(e.message);
    }
  };
  $("#clear-vault").onclick = async () => {
    try {
      for (const k of ["groq", "gemini", "github"]) await invoke("vaultClear", k);
      $("#vault-status").textContent = "Cofre vazio.";
      notice("Chaves apagadas.");
    } catch (e) {
      notice(e.message);
    }
  };
  $("#provider").onchange = save;
  $("#groq-model").onchange = save;
  $("#gemini-model").onchange = save;
  $("#auto-update").onchange = save;
  async function refreshMics() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const selected = settings.micDevice || $("#device").value;
    $("#device").replaceChildren(new Option("Padr\xE3o do sistema", ""));
    let n = 0;
    devices.filter((d) => d.kind === "audioinput").forEach((d) => {
      n++;
      $("#device").add(new Option(d.label || "Microfone " + n, d.deviceId));
    });
    $("#device").value = selected || "";
    return n;
  }
  $("#refresh-mics").onclick = async () => {
    try {
      let t;
      try {
        t = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch (e) {
        notice("Microfone: permita o acesso no navegador do ENZO para listar os dispositivos.");
        return;
      }
      t.getTracks().forEach((x) => x.stop());
      const n = await refreshMics();
      notice(n ? "Microfones atualizados. Escolha o seu, salve e fa\xE7a o teste." : "Nenhum microfone encontrado.");
    } catch (e) {
      notice(e.message);
    }
  };
  $("#test-mic").onclick = async () => {
    if (testing || busy) {
      notice("Aguarde o teste terminar.");
      return;
    }
    testing = true;
    micPeak = 0;
    const token = ++generation;
    notice("Teste: fale normalmente por 3 segundos\u2026");
    try {
      const dev = settings.micDevice || $("#device").value;
      const s = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: dev ? { exact: dev } : void 0, echoCancellation: settings.micEcho !== false, noiseSuppression: settings.micNoise !== false, autoGainControl: settings.micGain !== false }, video: false });
      if (token !== generation) {
        s.getTracks().forEach((t) => t.stop());
        testing = false;
        return;
      }
      const ctx = new AudioContext({ sampleRate: 16e3 });
      const src = ctx.createMediaStreamSource(s);
      const proc = ctx.createScriptProcessor(2048, 1, 1);
      src.connect(proc);
      proc.connect(ctx.destination);
      const stop = () => {
        try {
          proc.disconnect();
          src.disconnect();
          ctx.close();
        } catch {
        }
        s.getTracks().forEach((t) => t.stop());
      };
      proc.onaudioprocess = (e) => {
        const ch = new Float32Array(e.inputBuffer.getChannelData(0));
        const r = Math.sqrt(ch.reduce((a, x) => a + x * x, 0) / ch.length);
        if (r > micPeak) micPeak = r;
        setMeter(Math.min(1, r / 0.1));
      };
      await new Promise((r) => setTimeout(r, 3e3));
      if (token !== generation) {
        stop();
        testing = false;
        return;
      }
      stop();
      testing = false;
      setMeter(0);
      const pct = Math.round(Math.min(1, micPeak / 0.1) * 100);
      $("#mic-test").textContent = "N\xEDvel m\xE1ximo captado: " + pct + "%.";
      notice(pct < 1 ? "Quase nenhum sinal. Verifique o dispositivo escolhido e o volume no Windows." : pct < 8 ? "Sinal fraco. Fale mais perto/alto ou use sensibilidade Alta." : "Sinal bom. Pode ativar o microfone e falar.");
    } catch (e) {
      testing = false;
      setMeter(0);
      notice("Microfone: " + e.message);
    }
  };
  $("#device").onchange = save;
  $("#mic-sensitivity").onchange = save;
  $("#mic-noise").onchange = save;
  $("#mic-echo").onchange = save;
  $("#mic-gain").onchange = save;
  function proactive(text) {
    message(text);
    const go = () => {
      if (busy || uiState === "speaking") {
        setTimeout(go, 1500);
        return;
      }
      speak(text);
    };
    go();
  }
  function hudMode() {
    const el = $("#hud-mode");
    if (el) el.textContent = settings.wake ? "SENTINELA" : "LOCAL FIRST";
  }
  async function renderMemory() {
    try {
      const r = await invoke("memoryList");
      const list = $("#memory-list");
      list.replaceChildren();
      if (!r.facts.length) {
        const li = document.createElement("li");
        li.className = "muted";
        li.textContent = "Nada guardado ainda. Diga: \u201CEnzo, lembre que\u2026\u201D.";
        list.append(li);
      }
      r.facts.forEach((f, i) => {
        const li = document.createElement("li");
        const span = document.createElement("span");
        span.textContent = f;
        const b = document.createElement("button");
        b.className = "icon";
        b.title = "Esquecer";
        b.textContent = "\xD7";
        b.onclick = async () => {
          await invoke("memoryDelete", i);
          renderMemory();
        };
        li.append(span, b);
        list.append(li);
      });
      $("#memory-status").textContent = r.persistent ? "Mem\xF3ria criptografada neste computador." : "Criptografia indispon\xEDvel: a mem\xF3ria dura s\xF3 at\xE9 fechar o ENZO.";
    } catch (e) {
      notice(e.message);
    }
  }
  $("#memory-clear").onclick = async () => {
    if (!confirm("Apagar toda a mem\xF3ria do ENZO?")) return;
    await invoke("memoryClear");
    renderMemory();
    notice("Mem\xF3ria apagada.");
  };
  $("#wake").onchange = async () => {
    await save();
    hudMode();
    if (settings.wake && !active) toggleMic().catch((e) => notice(e.message));
  };
  $("#greet").onchange = save;
  $("#city").onchange = save;
  document.querySelectorAll('[data-tab="settings"]').forEach((b) => b.addEventListener("click", renderMemory));
  navigator.getBattery?.().then((b) => {
    const check = () => {
      if (b.charging) {
        batteryWarned = false;
        return;
      }
      if (b.level <= 0.2 && !batteryWarned) {
        batteryWarned = true;
        proactive(`Senhor, a bateria est\xE1 em ${Math.round(b.level * 100)}%. Sugiro conectar o carregador.`);
      }
    };
    b.addEventListener("levelchange", check);
    b.addEventListener("chargingchange", check);
    check();
  }).catch(() => {
  });
  invoke("status").then(async (s) => {
    settings = s.settings;
    $("#wake").checked = !!s.settings.wake;
    $("#greet").checked = s.settings.greet !== false;
    $("#city").value = s.settings.city || "";
    hudMode();
    if (s.settings.greet !== false && !greeted) {
      greeted = true;
      const g = await invoke("greeting");
      message(g);
      await speak(g);
    }
    if (s.settings.wake && !active) toggleMic().catch((e) => notice("Palavra de ativa\xE7\xE3o: " + e.message));
  }).catch(() => {
  });
  var agentCard = null;
  function agentEvent(e) {
    if (e.status === "start") {
      agentCard = document.createElement("article");
      agentCard.className = "assistant agent";
      const l = document.createElement("label");
      l.textContent = e.agent.toUpperCase() + " \xB7 TRABALHANDO";
      const p = document.createElement("p");
      p.textContent = e.task;
      const steps = document.createElement("ol");
      agentCard.append(l, p, steps);
      $("#messages").append(agentCard);
    } else if (agentCard && e.status === "progress") {
      const steps = agentCard.querySelector("ol");
      const li = document.createElement("li");
      li.textContent = e.text;
      steps.append(li);
      while (steps.children.length > 8) steps.firstChild.remove();
    } else if (agentCard && (e.status === "done" || e.status === "error")) {
      agentCard.querySelector("label").textContent = agentCard.querySelector("label").textContent.replace("TRABALHANDO", e.status === "done" ? "CONCLU\xCDDO" : "FALHOU");
      agentCard.classList.add(e.status);
      if (e.text) {
        const p = document.createElement("p");
        p.textContent = e.text.slice(0, 3e3);
        agentCard.append(p);
      }
      agentCard = null;
    }
    $("#messages").scrollTop = $("#messages").scrollHeight;
  }
  async function renderAgent() {
    try {
      const a = await invoke("agentStatus");
      $("#agent").value = a.agent || "claude";
      $("#projects-dir").textContent = a.projectsDir;
      const av = a.available || {};
      $("#agent-found").textContent = `No PC: Claude Code ${av.claude ? "\u2713 encontrado" : "\u2014 n\xE3o encontrado"} \xB7 OpenCode ${av.opencode ? "\u2713 encontrado" : "\u2014 n\xE3o encontrado"}`;
    } catch (e) {
      notice(e.message);
    }
  }
  $("#pick-projects").onclick = async () => {
    try {
      $("#projects-dir").textContent = await invoke("pickProjects");
    } catch (e) {
      notice(e.message);
    }
  };
  $("#agent").onchange = save;
  $("#agent-full").onchange = async () => {
    if ($("#agent-full").checked && !confirm("Liberar todos os comandos? O agente poder\xE1 instalar programas e apagar arquivos sem perguntar. Use s\xF3 se confiar na tarefa.")) {
      $("#agent-full").checked = false;
      return;
    }
    save();
  };
  $("#quick-open").onchange = save;
  document.querySelectorAll('[data-tab="settings"]').forEach((b) => b.addEventListener("click", renderAgent));
  invoke("status").then((s) => {
    $("#agent-full").checked = !!s.settings.agentFull;
    $("#quick-open").checked = s.settings.quickOpen !== false;
  }).catch(() => {
  });
})();
