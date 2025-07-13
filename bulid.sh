#!/usr/bin/env bash
# exit on error
set -o errexit

# 必要なライブラリをインストール
pip install -r requirements.txt

# Flaskのコンテキスト内でdb.create_all()を実行してテーブルを作成
flask shell <<< "from app import db; db.create_all()"