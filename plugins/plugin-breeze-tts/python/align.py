"""Offline forced alignment using the installed MLX-Audio implementation."""
import hashlib
import json
import os
import sys
from pathlib import Path

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'


def main():
    request = json.load(sys.stdin)
    model_path = Path(request['modelPath']).resolve(strict=True)
    audio_path = Path(request['path']).resolve(strict=True)
    if not model_path.is_dir() or not (model_path / 'model.safetensors').is_file():
        raise ValueError('Prepared local alignment weights are required')
    if hashlib.sha256(audio_path.read_bytes()).hexdigest() != request['sha256']:
        raise ValueError('Audio changed before forced alignment')
    from mlx_audio.stt import load
    model = load(str(model_path))
    result = model.generate(audio=str(audio_path), text=request['text'], language=request['language'])
    units = []
    cursor = 0
    for item in result:
        start = request['text'].find(item.text, cursor)
        if start < 0:
            raise ValueError('Alignment does not match the provided transcript')
        end = start + len(item.text)
        cursor = end
        # Sub-frame words can have identical boundaries. Keep a real gap rather
        # than stretching neighbouring timestamps to invent a duration.
        if item.end_time == item.start_time:
            continue
        # JavaScript text components and selections use UTF-16 coordinates.
        units.append({
            'start': len(request['text'][:start].encode('utf-16-le')) // 2,
            'end': len(request['text'][:end].encode('utf-16-le')) // 2,
            'startTime': item.start_time,
            'endTime': item.end_time,
        })
    print(json.dumps({'schemaVersion': 1, 'text': request['text'], 'audioSha256': request['sha256'],
                      'durationSeconds': request['durationSeconds'], 'engine': 'mlx-audio/qwen3-forced-aligner',
                      'model': 'Qwen3-ForcedAligner-0.6B-8bit',
                      **({'revision': request['revision']} if request.get('revision') else {}), 'units': units}))


if __name__ == '__main__':
    main()
