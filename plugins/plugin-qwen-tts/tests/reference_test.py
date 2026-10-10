"""Exercise portable reference checks without importing MLX or downloading models."""

import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import wave


SPEC = importlib.util.spec_from_file_location(
    'qwen_preview', Path(__file__).resolve().parents[1] / 'python/preview.py'
)
PREVIEW = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PREVIEW)


class ModelCacheTests(unittest.TestCase):
    """Check cache isolation without importing inference or download dependencies."""

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='advjs-qwen-cache-')
        self.root = Path(self.temporary.name).resolve()
        self.voice_cache = self.root / '.advjs/voice'

    def tearDown(self):
        self.temporary.cleanup()

    def test_inherited_cache_overrides_are_replaced_without_creating_files(self):
        expected = {
            'HF_HOME': 'huggingface',
            'HF_HUB_CACHE': 'huggingface/hub',
            'HUGGINGFACE_HUB_CACHE': 'huggingface/hub',
            'HF_ASSETS_CACHE': 'huggingface/assets',
            'HUGGINGFACE_ASSETS_CACHE': 'huggingface/assets',
            'HF_XET_CACHE': 'huggingface/xet',
        }
        inherited = {name: str(self.root / 'external-cache') for name in expected}
        with patch.dict(os.environ, inherited):
            self.assertEqual(PREVIEW.configure_model_cache(self.voice_cache), self.voice_cache / 'huggingface')
            for name, path in expected.items():
                self.assertEqual(os.environ[name], str(self.voice_cache / path))
        self.assertFalse(self.voice_cache.exists())

    def test_cache_directory_symlinks_are_rejected_before_environment_changes(self):
        model_cache = self.voice_cache / 'huggingface'
        model_cache.mkdir(parents=True)
        outside = self.root / 'outside'
        outside.mkdir()
        for name in ('hub', 'assets', 'xet'):
            with self.subTest(cache=name), patch.dict(os.environ, {'HF_HOME': 'unchanged'}):
                path = model_cache / name
                path.symlink_to(outside, target_is_directory=True)
                try:
                    with self.assertRaisesRegex(ValueError, 'inside the project root'):
                        PREVIEW.configure_model_cache(self.voice_cache)
                    self.assertEqual(os.environ['HF_HOME'], 'unchanged')
                finally:
                    path.unlink()


class ReferenceTests(unittest.TestCase):
    """Verify that cache boundaries and input audio are checked before inference."""

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='advjs-qwen-reference-')
        self.root = Path(self.temporary.name).resolve()
        self.audio = self.root / 'assets/reference.wav'
        self.audio.parent.mkdir()
        self.write_wav()
        self.digest = hashlib.sha256(self.audio.read_bytes()).hexdigest()
        self.character = {'id': 'speaker', 'reference': {'assetId': 'reference', 'sha256': self.digest}}
        self.asset = {'id': 'reference', 'type': 'audio', 'kind': 'reference', 'characterId': 'speaker',
                      'path': 'reference.wav', 'sha256': self.digest}
        self.manifest = self.root / 'assets.json'
        self.write_manifest()

    def tearDown(self):
        self.temporary.cleanup()

    def write_wav(self, channels=1, rate=24000, duration=3):
        with wave.open(str(self.audio), 'wb') as audio:
            audio.setnchannels(channels)
            audio.setsampwidth(2)
            audio.setframerate(rate)
            audio.writeframes(b'\0\0' * channels * rate * duration)

    def write_manifest(self, root='assets'):
        self.manifest.write_text(json.dumps({'schemaVersion': 2, 'id': 'test-assets', 'defaultProfile': 'local',
                                             'profiles': {'local': {'provider': 'project', 'root': root}},
                                             'assets': [self.asset]}))

    def refresh_hash(self):
        digest = hashlib.sha256(self.audio.read_bytes()).hexdigest()
        self.character['reference']['sha256'] = digest
        self.asset['sha256'] = digest
        self.write_manifest()

    def test_valid_reference_returns_absolute_path(self):
        self.assertEqual(PREVIEW.prepare_reference(self.root, self.manifest, self.character), str(self.audio))

    def test_mismatched_hash_is_rejected(self):
        self.character['reference']['sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'SHA-256 mismatch'):
            PREVIEW.prepare_reference(self.root, self.manifest, self.character)

    def test_wrong_character_is_rejected(self):
        self.asset['characterId'] = 'other'
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, 'Invalid reference asset'):
            PREVIEW.prepare_reference(self.root, self.manifest, self.character)

    def test_format_and_duration_are_rejected(self):
        for channels, rate, duration in [(2, 24000, 3), (1, 16000, 3), (1, 24000, 2), (1, 24000, 21)]:
            with self.subTest(channels=channels, rate=rate, duration=duration):
                self.write_wav(channels, rate, duration)
                self.refresh_hash()
                with self.assertRaises(ValueError):
                    PREVIEW.prepare_reference(self.root, self.manifest, self.character)

    def test_asset_cache_cannot_escape_project(self):
        self.write_manifest('../outside')
        with self.assertRaisesRegex(ValueError, 'project-relative path'):
            PREVIEW.prepare_reference(self.root, self.manifest, self.character)

    def test_asset_symlink_cannot_escape_cache(self):
        outside = self.root / 'outside.wav'
        outside.write_bytes(self.audio.read_bytes())
        self.audio.unlink()
        self.audio.symlink_to(outside)
        with self.assertRaisesRegex(ValueError, 'inside the asset cache'):
            PREVIEW.prepare_reference(self.root, self.manifest, self.character)

    def write_split_manifest(self):
        fragment = self.root / 'fragments/audio.json'
        fragment.parent.mkdir(exist_ok=True)
        fragment.write_text(json.dumps({'schemaVersion': 2, 'assets': [self.asset]}))
        catalog = json.loads(self.manifest.read_text())
        del catalog['assets']
        catalog['includes'] = ['fragments/audio.json']
        self.manifest.write_text(json.dumps(catalog))
        return fragment

    def test_split_manifest_resolves_the_same_reference(self):
        self.write_split_manifest()
        self.assertEqual(PREVIEW.prepare_reference(self.root, self.manifest, self.character), str(self.audio))

    def test_explicit_cache_path_overrides_http_runtime_profile(self):
        catalog = json.loads(self.manifest.read_text())
        catalog['defaultProfile'] = 'published'
        catalog['profiles']['published'] = {'provider': 'http', 'baseUrl': 'https://example.com/assets/'}
        self.asset['cachePath'] = 'assets/reference.wav'
        self.asset.pop('path')
        catalog['assets'] = [self.asset]
        self.manifest.write_text(json.dumps(catalog))
        self.assertEqual(PREVIEW.prepare_reference(self.root, self.manifest, self.character), str(self.audio))

    def test_download_profile_selects_local_cache_with_http_runtime_default(self):
        catalog = json.loads(self.manifest.read_text())
        catalog['defaultProfile'] = 'published'
        catalog['profiles']['published'] = {'provider': 'http', 'baseUrl': 'https://example.com/assets/'}
        catalog['download'] = {'profile': 'local', 'source': {'provider': 'http', 'baseUrl': 'https://example.com/assets/'}}
        self.manifest.write_text(json.dumps(catalog))
        self.write_split_manifest()
        self.assertEqual(PREVIEW.prepare_reference(self.root, self.manifest, self.character), str(self.audio))

    def test_missing_project_profile_requires_explicit_cache_path(self):
        catalog = json.loads(self.manifest.read_text())
        catalog['profiles']['local'] = {'provider': 'http', 'baseUrl': 'https://example.com/assets/'}
        self.manifest.write_text(json.dumps(catalog))
        with self.assertRaisesRegex(ValueError, 'project download profile or explicit cachePath'):
            PREVIEW.prepare_reference(self.root, self.manifest, self.character)

    def test_split_catalog_duplicates_and_ambiguous_roots_are_rejected(self):
        fragment = self.write_split_manifest()
        catalog = json.loads(self.manifest.read_text())
        catalog['includes'].append(catalog['includes'][0])
        self.manifest.write_text(json.dumps(catalog))
        with self.assertRaisesRegex(ValueError, 'duplicate includes'):
            PREVIEW.prepare_reference(self.root, self.manifest, self.character)
        catalog['includes'] = ['fragments/audio.json']
        self.manifest.write_text(json.dumps(catalog))
        fragment.write_text(json.dumps({'schemaVersion': 2, 'assets': [self.asset, self.asset]}))
        with self.assertRaisesRegex(ValueError, 'duplicate asset IDs'):
            PREVIEW.prepare_reference(self.root, self.manifest, self.character)
        catalog['assets'] = [self.asset]
        self.manifest.write_text(json.dumps(catalog))
        with self.assertRaisesRegex(ValueError, 'exactly one'):
            PREVIEW.prepare_reference(self.root, self.manifest, self.character)

    def test_fragment_and_cache_path_escapes_are_rejected(self):
        self.write_split_manifest()
        catalog = json.loads(self.manifest.read_text())
        catalog['includes'] = ['../outside.json']
        self.manifest.write_text(json.dumps(catalog))
        with self.assertRaisesRegex(ValueError, 'project-relative path'):
            PREVIEW.prepare_reference(self.root, self.manifest, self.character)
        self.asset['cachePath'] = '../outside.wav'
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, 'project-relative path'):
            PREVIEW.prepare_reference(self.root, self.manifest, self.character)

    def test_fragment_and_cache_path_symlinks_cannot_escape_project(self):
        outside_temp = tempfile.TemporaryDirectory(prefix='advjs-qwen-outside-')
        self.addCleanup(outside_temp.cleanup)
        outside = Path(outside_temp.name)
        fragment = self.write_split_manifest()
        (outside / 'fragment.json').write_bytes(fragment.read_bytes())
        fragment.unlink()
        fragment.symlink_to(outside / 'fragment.json')
        with self.assertRaisesRegex(ValueError, 'inside the project root'):
            PREVIEW.prepare_reference(self.root, self.manifest, self.character)
        (outside / 'reference.wav').write_bytes(self.audio.read_bytes())
        self.audio.unlink()
        self.audio.symlink_to(outside / 'reference.wav')
        self.asset['cachePath'] = 'assets/reference.wav'
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, 'inside the project root'):
            PREVIEW.prepare_reference(self.root, self.manifest, self.character)

    def test_project_profile_without_root_uses_project_relative_asset_path(self):
        catalog = json.loads(self.manifest.read_text())
        self.asset['path'] = 'assets/reference.wav'
        catalog['assets'] = [self.asset]
        for root_coordinate in (None, '.', './'):
            with self.subTest(root=root_coordinate):
                if root_coordinate is None:
                    catalog['profiles']['local'].pop('root')
                else:
                    catalog['profiles']['local']['root'] = root_coordinate
                self.manifest.write_text(json.dumps(catalog))
                self.assertEqual(PREVIEW.prepare_reference(self.root, self.manifest, self.character), str(self.audio))


if __name__ == '__main__':
    unittest.main()
