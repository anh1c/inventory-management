#!/bin/bash
cd /Users/thainguyen/IntellJProjects/Inventree
source env/bin/activate
export INVENTREE_CONFIG_FILE=$PWD/data/config.yaml
echo "Đang khởi tạo tài khoản Admin (Superuser)..."
invoke superuser
