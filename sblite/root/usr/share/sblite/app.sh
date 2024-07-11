#!/bin/sh

WORKDIR="$(cd "$(dirname "$0")" && pwd)"
APP_FILE="$WORKDIR/app.uc"

method=$1
shift
case "$method" in
    start) ucode -D action=start $APP_FILE ;;
    subscribe) ucode -D action=subscribe -D params="$1" $APP_FILE ;;
    *) ;;
esac
