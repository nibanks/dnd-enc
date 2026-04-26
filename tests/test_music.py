"""
Tests for the encounter-music endpoints (`/api/music`, `/music/<file>`).

These exercise just the file-listing and file-serving paths; playback
behaviour lives entirely in the frontend music service and is tested in
tests/services/test_musicService.js.
"""
import json


class TestListMusic:
    """Tests for GET /api/music."""

    def test_empty_directory_returns_empty_list(self, client, app):
        from app import MUSIC_DIR
        # Fresh test dir is created empty by conftest
        assert MUSIC_DIR.exists()

        response = client.get('/api/music')
        assert response.status_code == 200
        assert json.loads(response.data) == []

    def test_lists_audio_files_alphabetically(self, client, app):
        from app import MUSIC_DIR
        # Create files out of order; expect alphabetical response
        for name in ["zelda.mp3", "battle.ogg", "ambient.flac"]:
            (MUSIC_DIR / name).write_bytes(b"\x00\x00")

        response = client.get('/api/music')
        assert response.status_code == 200
        files = json.loads(response.data)
        assert files == ["ambient.flac", "battle.ogg", "zelda.mp3"]

    def test_ignores_non_audio_files(self, client, app):
        """Random files in music/ shouldn't pollute the catalog."""
        from app import MUSIC_DIR
        (MUSIC_DIR / "track.mp3").write_bytes(b"\x00\x00")
        (MUSIC_DIR / "notes.txt").write_text("not music")
        (MUSIC_DIR / "cover.png").write_bytes(b"\x00\x00")

        response = client.get('/api/music')
        files = json.loads(response.data)
        assert files == ["track.mp3"]

    def test_supports_common_audio_extensions(self, client, app):
        """All the formats we advertise should round-trip the listing."""
        from app import MUSIC_DIR
        names = [
            "a.mp3", "b.ogg", "c.oga", "d.m4a", "e.aac",
            "f.wav", "g.flac", "h.opus", "i.webm",
        ]
        for n in names:
            (MUSIC_DIR / n).write_bytes(b"\x00\x00")

        response = client.get('/api/music')
        assert response.status_code == 200
        files = json.loads(response.data)
        assert sorted(files) == sorted(names)


class TestServeMusic:
    """Tests for GET /music/<filename>."""

    def test_serves_existing_file(self, client, app):
        from app import MUSIC_DIR
        contents = b"FAKEMP3HEADER\x00\x00DATA"
        (MUSIC_DIR / "battle.mp3").write_bytes(contents)

        response = client.get('/music/battle.mp3')
        assert response.status_code == 200
        assert response.data == contents

    def test_serves_filename_with_spaces(self, client, app):
        """User-uploaded files often contain spaces - URL-encoded path."""
        from app import MUSIC_DIR
        (MUSIC_DIR / "tense battle.mp3").write_bytes(b"abc")

        response = client.get('/music/tense%20battle.mp3')
        assert response.status_code == 200
        assert response.data == b"abc"

    def test_missing_file_returns_404(self, client):
        response = client.get('/music/no-such-file.mp3')
        assert response.status_code == 404

    def test_rejects_non_audio_extension(self, client, app):
        """Even if someone drops a foo.txt next to tracks, it's not served."""
        from app import MUSIC_DIR
        (MUSIC_DIR / "secrets.txt").write_text("nope")

        response = client.get('/music/secrets.txt')
        assert response.status_code == 404

    def test_path_traversal_blocked(self, client, app):
        """Make sure ../etc/passwd style paths can't escape the music dir."""
        response = client.get('/music/../../etc/passwd')
        # Flask's send_from_directory normalizes and rejects this; the
        # extension guard would also reject it. Either 404 or 400 is fine.
        assert response.status_code in (400, 404)
