#!/bin/bash
cd /Users/thainguyen/IntellJProjects/Inventree
source env/bin/activate
export INVENTREE_CONFIG_FILE=$PWD/data/config.yaml
echo "Đang khởi động Background Worker..."
invoke worker &
WORKER_PID=$!

echo "Đang khởi động InvenTree Web Server..."
invoke dev.server

# Nếu tắt web server thì tắt luôn worker
kill $WORKER_PID
