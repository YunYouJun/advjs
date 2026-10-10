"""Generate local authoring voice candidates with Qwen3-TTS on Apple Silicon."""

import argparse
from contextlib import redirect_stdout
import hashlib
import importlib.metadata
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import re
import sys
import time
import uuid
import wave


def bound_path(root: Path, value: str, label: str) -> Path:
    """Resolve a project path without following symlinks outside the project."""
    path = (root / value).resolve()
    if not path.is_relative_to(root):
        raise ValueError(f'{label} must stay inside the project root')
    return path


def configure_model_cache(voice_cache: Path) -> Path:
    """Pin every Hub cache before imports or downloads, including inherited overrides."""
    model_cache = bound_path(voice_cache, 'huggingface', 'Model cache')
    hub_cache = bound_path(model_cache, 'hub', 'Hub cache')
    assets_cache = bound_path(model_cache, 'assets', 'Hub assets cache')
    xet_cache = bound_path(model_cache, 'xet', 'Xet cache')
    os.environ.update({
        'HF_HOME': str(model_cache),
        'HF_HUB_CACHE': str(hub_cache),
        'HUGGINGFACE_HUB_CACHE': str(hub_cache),
        'HF_ASSETS_CACHE': str(assets_cache),
        'HUGGINGFACE_ASSETS_CACHE': str(assets_cache),
        'HF_XET_CACHE': str(xet_cache),
    })
    return model_cache


def asset_coordinate(value: str, label: str) -> str:
    """Reject ambiguous coordinates before resolving native cache locations."""
    if not isinstance(value, str) or not value or re.search(r'[\\:?#%]', value) or any(
        ord(character) < 32 for character in value
    ) or any(part in ('', '.', '..') for part in value.split('/')):
        raise ValueError(f'{label} must be an unambiguous project-relative path')
    return value


def read_catalog(root: Path, asset_manifest_path: Path) -> dict:
    """Read inline or split native asset catalogs without escaping the project."""
    manifest_path = bound_path(root, str(asset_manifest_path), 'Asset manifest')
    catalog = json.loads(manifest_path.read_text())
    if not isinstance(catalog, dict) or catalog.get('schemaVersion') != 2:
        raise ValueError('Reference asset manifest must use native schemaVersion 2')
    profiles = catalog.get('profiles')
    if not isinstance(catalog.get('id'), str) or not catalog['id'] or not isinstance(profiles, dict) or not isinstance(
        catalog.get('defaultProfile'), str
    ) or catalog['defaultProfile'] not in profiles:
        raise ValueError('Asset manifest requires an ID, profiles, and a valid defaultProfile')
    for profile in profiles.values():
        if not isinstance(profile, dict) or profile.get('provider') not in ('project', 'http') or (
            profile['provider'] == 'http' and (not isinstance(profile.get('baseUrl'), str) or not profile['baseUrl'])
        ):
            raise ValueError('Asset profiles must declare project or HTTP locations')
    if ('assets' in catalog) == ('includes' in catalog):
        raise ValueError('Asset manifest must declare exactly one of assets or includes')
    if 'includes' in catalog:
        includes = catalog['includes']
        if not isinstance(includes, list):
            raise ValueError('Asset manifest includes must be an array')
        assets = []
        seen = set()
        for include in includes:
            coordinate = asset_coordinate(include, 'Asset manifest include')
            if coordinate in seen:
                raise ValueError('Asset manifest must not contain duplicate includes')
            seen.add(coordinate)
            fragment_path = bound_path(root, str(manifest_path.parent / coordinate), 'Asset manifest include')
            fragment = json.loads(fragment_path.read_text())
            if not isinstance(fragment, dict) or fragment.get('schemaVersion') != 2 or not isinstance(
                fragment.get('assets'), list
            ) or 'includes' in fragment:
                raise ValueError('Asset manifest fragments must declare schemaVersion 2 and assets')
            assets.extend(fragment['assets'])
        catalog['assets'] = assets
    if not isinstance(catalog['assets'], list) or not catalog['assets']:
        raise ValueError('Asset manifest must contain assets')
    ids = set()
    for asset in catalog['assets']:
        if not isinstance(asset, dict) or not isinstance(asset.get('id'), str) or not asset['id']:
            raise ValueError('Every asset must have a nonempty ID')
        if asset['id'] in ids:
            raise ValueError('Asset manifest must not contain duplicate asset IDs')
        ids.add(asset['id'])
    return catalog


def reference_path(root: Path, catalog: dict, asset: dict) -> Path:
    """Use the shared cachePath override or selected project download profile."""
    if asset.get('cachePath') is not None:
        return bound_path(root, asset_coordinate(asset['cachePath'], 'Reference cachePath'), 'Reference cachePath')
    profiles = catalog.get('profiles')
    download = catalog.get('download', {})
    if not isinstance(profiles, dict) or not isinstance(download, dict):
        raise ValueError('Asset profiles and download configuration must be objects')
    profile = profiles.get(download.get('profile', catalog.get('defaultProfile')))
    if not isinstance(profile, dict) or profile.get('provider') != 'project':
        raise ValueError('Reference path requires a project download profile or explicit cachePath')
    root_coordinate = profile.get('root', '')
    if not isinstance(root_coordinate, str):
        raise ValueError('Reference cache root must be a string')
    root_coordinate = root_coordinate.removeprefix('./').removesuffix('/')
    if root_coordinate == '.':
        root_coordinate = ''
    if root_coordinate:
        asset_coordinate(root_coordinate, 'Reference cache root')
    cache_root = bound_path(root, root_coordinate, 'Asset cache')
    coordinate = asset_coordinate(asset.get('path'), 'Reference path')
    path = (cache_root / coordinate).resolve()
    if not path.is_relative_to(cache_root):
        raise ValueError('Reference path must stay inside the asset cache')
    return path


def prepare_reference(root: Path, asset_manifest_path: Path, character: dict) -> str:
    """Verify a native audio asset before importing or loading the model."""
    root = root.resolve(strict=True)
    catalog = read_catalog(root, asset_manifest_path)
    reference = character['reference']
    asset = next((item for item in catalog['assets'] if item['id'] == reference['assetId']), None)
    if not asset or asset.get('type') != 'audio' or asset.get('kind') != 'reference' or (
        asset.get('characterId') != character['id']
    ):
        raise ValueError(f"Invalid reference asset: {reference['assetId']}")
    path = reference_path(root, catalog, asset)
    if not path.is_file():
        raise ValueError(f'Missing reference audio: {path}; pull project assets first')
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != reference['sha256'] or digest != asset['sha256']:
        raise ValueError(f"Reference SHA-256 mismatch: {reference['assetId']}")
    with wave.open(str(path), 'rb') as wav:
        if (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) != (1, 2, 24000):
            raise ValueError('Reference must be mono 16-bit PCM WAV at 24kHz')
        if not 3 <= wav.getnframes() / wav.getframerate() <= 20:
            raise ValueError('Reference must contain between 3 and 20 seconds of audio')
    return str(path)


def main() -> None:
    """Validate project input and save reproducible WAV files and provenance."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', required=True, help='Absolute project root')
    parser.add_argument('--config', required=True, help='Project preset JSON file')
    parser.add_argument('--asset-manifest', help='Native asset catalogue JSON file')
    parser.add_argument('--result-file', required=True, help='Structured result JSON inside the project')
    parser.add_argument('--preset', required=True, help='Project preset identifier for provenance')
    parser.add_argument('--character', help='Character ID from the project preset')
    parser.add_argument('--text', help='Override preview text for one character')
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--reference-mode', choices=['icl', 'embedding-only'])
    parser.add_argument('--offline', action='store_true', help='Use cached model files only')
    args = parser.parse_args()

    try:
        if not Path(args.root).is_absolute():
            raise ValueError('--root must be an absolute path')
        root = Path(args.root).resolve(strict=True)
        if not root.is_dir():
            raise ValueError('--root must identify a directory')
        cache = bound_path(root, '.advjs/voice', 'Voice cache')
        config_path = bound_path(root, args.config, 'Preset config')
        result_file = bound_path(cache, args.result_file, 'Result file')
        config = json.loads(config_path.read_text())
        for name in ('version', 'model'):
            if not isinstance(config.get(name), str) or not config[name].strip():
                raise ValueError(f'{name} must be a nonempty string')
        if not args.preset.strip():
            raise ValueError('Preset ID must be nonempty')
        if not re.fullmatch(r'[0-9a-f]{40}', config['revision']):
            raise ValueError('Model revision must be a pinned 40-character commit hash')
        if not config.get('weightSha256'):
            raise ValueError('Model weight SHA-256 hashes are required')
        for name, expected in config['weightSha256'].items():
            weight_name = Path(name)
            if not name or weight_name.is_absolute() or '..' in weight_name.parts or not re.fullmatch(r'[0-9a-f]{64}', expected):
                raise ValueError('Invalid model weight path or SHA-256')
        character_ids = [character['id'] for character in config['characters']]
        if len(character_ids) != len(set(character_ids)) or not character_ids:
            raise ValueError('Preset character IDs must be unique and nonempty')
        if any(not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]*', value) for value in character_ids):
            raise ValueError('Character IDs must be safe filename identifiers')
        if args.character and args.character not in character_ids:
            raise ValueError(f"--character must be one of: {', '.join(character_ids)}")
        if args.text is not None and (not args.character or not args.text.strip()):
            raise ValueError('--text requires --character and nonempty text')
        if args.text and len(args.text) > 500:
            raise ValueError('Preview text must contain at most 500 characters')
        if not 0 <= args.seed <= 2**32 - 1:
            raise ValueError('--seed must be an unsigned 32-bit integer')

        characters = [item.copy() for item in config['characters'] if not args.character or item['id'] == args.character]
        reference_flags = [isinstance(character.get('reference'), dict) for character in characters]
        if any(reference_flags) and not all(reference_flags):
            raise ValueError('A preview batch cannot mix reference and voice-design characters')
        is_reference = all(reference_flags)
        if args.reference_mode and not is_reference:
            raise ValueError('--reference-mode requires reference characters')
        reference_mode = args.reference_mode or 'icl'
        reference_paths = {}
        if is_reference:
            if not args.asset_manifest:
                raise ValueError('Reference generation requires an asset manifest')
            asset_manifest_path = bound_path(root, args.asset_manifest, 'Asset manifest')
            for character in characters:
                reference_paths[character['id']] = prepare_reference(root, asset_manifest_path, character)
                if reference_mode == 'icl' and not character['reference'].get('text', '').strip():
                    raise ValueError('ICL requires a nonempty reference transcript')

        for character in characters:
            if args.text is not None:
                character['text'] = args.text.strip()
            if not isinstance(character.get('text'), str) or not character['text'].strip() or len(character['text']) > 500:
                raise ValueError('Each preview text must contain 1–500 characters')
            if not is_reference and not character.get('description', '').strip():
                raise ValueError('Voice design requires a nonempty description')
            if character.get('card'):
                card = bound_path(root, character['card'], 'Character card')
                character['cardSha256'] = hashlib.sha256(card.read_bytes()).hexdigest()
    except (KeyError, TypeError, ValueError, OSError, wave.Error) as error:
        parser.error(str(error))

    # Keep local caches inside the project and disable Hub telemetry.
    model_cache = configure_model_cache(cache)
    os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
    os.environ['TOKENIZERS_PARALLELISM'] = 'false'
    if args.offline:
        os.environ['HF_HUB_OFFLINE'] = '1'
        os.environ['TRANSFORMERS_OFFLINE'] = '1'
    import mlx.core as mx
    import numpy as np
    from huggingface_hub import snapshot_download
    from mlx_audio.tts.utils import load_model

    print(f"Loading {config['model']} ({config['revision'][:12]})", flush=True)
    model_path = Path(snapshot_download(
        config['model'], revision=config['revision'], local_files_only=args.offline,
        cache_dir=str(model_cache / 'hub'),
        allow_patterns=['*.json', '*.txt', '*.safetensors'],
    )).resolve()
    for name, expected in config['weightSha256'].items():
        weights_path = (model_path / name).resolve()
        if not weights_path.is_relative_to(model_cache):
            raise ValueError('Invalid model weight path or SHA-256')
        with weights_path.open('rb') as weights:
            digest = hashlib.file_digest(weights, 'sha256').hexdigest()
        if digest != expected:
            raise RuntimeError(f'Model weight SHA-256 mismatch: {name}')
    model = load_model(str(model_path))
    if is_reference and model.config.tts_model_type != 'base':
        raise RuntimeError('Reference generation requires a Qwen Base model')
    if is_reference and model.speaker_encoder is None:
        raise RuntimeError('Reference generation requires the speaker encoder')
    if is_reference and reference_mode == 'icl' and (
        model.speech_tokenizer is None or not model.speech_tokenizer.has_encoder
    ):
        raise RuntimeError('ICL requires the speech tokenizer encoder')
    run_id = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8]
    output = bound_path(cache, f'previews/{run_id}', 'Preview output')
    output.mkdir(parents=True)
    manifest_path = output / 'manifest.json'
    language = config.get('language', 'Chinese')
    manifest = {
        'status': 'candidate', 'version': config['version'], 'preset': args.preset,
        'generationMode': f'reference-{reference_mode}' if is_reference else 'voice-design',
        'model': config['model'], 'revision': config['revision'],
        'engine': 'mlx-audio', 'engineVersion': importlib.metadata.version('mlx-audio'),
        'runtimeVersions': {name: importlib.metadata.version(name) for name in ('mlx', 'transformers', 'numpy')},
        'seed': args.seed, 'temperature': 0.7, 'maxTokens': 1200,
        'language': language, 'apiCostCny': 0, 'samples': [],
    }
    if is_reference:
        manifest.update({'topK': 50, 'topP': 1.0, 'repetitionPenalty': 1.5})

    for character in characters:
        print(f"Generating {character.get('name', character['id'])}…", flush=True)
        mx.random.seed(args.seed)
        started = time.perf_counter()
        if is_reference:
            segments = list(model.generate(
                text=character['text'], ref_audio=reference_paths[character['id']],
                ref_text=character['reference'].get('text') if reference_mode == 'icl' else None,
                lang_code=language, temperature=manifest['temperature'],
                max_tokens=manifest['maxTokens'], stream=False,
                top_k=manifest['topK'], top_p=manifest['topP'],
                repetition_penalty=manifest['repetitionPenalty'],
            ))
        else:
            segments = list(model.generate_voice_design(
                text=character['text'], instruct=character['description'],
                language=language, temperature=manifest['temperature'],
                max_tokens=manifest['maxTokens'],
            ))
        if not segments:
            raise RuntimeError(f"No audio generated for {character['id']}")
        rate = segments[0].sample_rate
        if any(segment.sample_rate != rate for segment in segments):
            raise RuntimeError('Inconsistent sample rates')
        audio = np.concatenate([np.asarray(segment.audio).reshape(-1) for segment in segments])
        if not audio.size or not np.isfinite(audio).all() or np.max(np.abs(audio)) < 1e-5:
            raise RuntimeError(f"Invalid or silent audio for {character['id']}")
        pcm = (np.clip(audio, -1, 1) * 32767).astype('<i2')
        path = output / f"{character['id']}.wav"
        with wave.open(str(path), 'wb') as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(rate)
            wav.writeframes(pcm.tobytes())
        sample = {
            **character, 'path': str(path.relative_to(root)), 'sampleRate': rate,
            'durationSeconds': round(audio.size / rate, 3),
            'generationSeconds': round(time.perf_counter() - started, 3),
            'peakMemoryBytes': mx.get_peak_memory(),
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'bytes': path.stat().st_size,
        }
        manifest['samples'].append(sample)
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        print(f"Saved {path} ({sample['durationSeconds']}s)", flush=True)
        mx.clear_cache()

    result_file.parent.mkdir(parents=True, exist_ok=True)
    result_file.write_text(json.dumps({'manifestPath': str(manifest_path), 'manifest': manifest}, ensure_ascii=False) + '\n')
    print(f'Manifest: {manifest_path}', flush=True)


if __name__ == '__main__':
    with redirect_stdout(sys.stderr):
        main()
