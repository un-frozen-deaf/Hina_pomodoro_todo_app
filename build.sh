#!/usr/bin/env bash
# exit on error
set -o errexit

pip install -r requirements.txt

# appのコンテキスト内で直接Pythonコードを実行し、DBテーブルを作成する
# こちらの方が確実性が高い
python -c "from app import app, db; app.app_context().push(); db.create_all()"