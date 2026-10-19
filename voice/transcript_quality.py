"""Reject unreliable decoding rather than sending guessed words to the assistant."""
def accepted_text(segments):
    parts=[]
    for segment in segments:
        if segment.avg_logprob < -1.0 or segment.no_speech_prob > .6 or segment.compression_ratio > 2.4:
            return ''
        text=segment.text.strip()
        if text:
            parts.append(text)
    return ' '.join(parts).strip()

