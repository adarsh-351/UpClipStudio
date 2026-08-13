from app import create_app


def test_youtube_download_requires_valid_url():
    app = create_app()
    client = app.test_client()

    response = client.post('/download/youtube', json={'url': 'not-a-url'})

    assert response.status_code == 400
    payload = response.get_json()
    assert 'valid YouTube URL' in payload['error']
