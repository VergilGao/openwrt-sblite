#!/bin/sh

WORKDIR="$(cd "$(dirname "$0")" && pwd)"

start() {
    mkdir -p /tmp/sblite
    ucode "$WORKDIR/app.uc"
}

method=$1
shift
case method in
    'start') ;;
    *) ;;
esac
