#!/bin/sh

WORKDIR="$(cd "$(dirname "$0")" && pwd)"
APP_FILE="$WORKDIR/app.uc"

method=$1
shift
case "$method" in
    start) 
        rm -rf /tmp/sblite
        mkdir -p /tmp/sblite
        mkdir -p /tmp/sblite/rule_sets
        ucode -D action=start $APP_FILE 
        if [ -e '/tmp/sblite/config.json' ]; then 
            sing-box format -w -c /tmp/sblite/config.json
            return 0
        fi
            return -1
        ;;
    subscribe) ucode -D action=subscribe -D params="$1" $APP_FILE ;;
    *) ;;
esac
