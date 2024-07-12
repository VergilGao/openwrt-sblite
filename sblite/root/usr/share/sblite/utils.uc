'use strict';

import { popen, open as fopen } from 'fs';

const LOG_FILE = '/tmp/log/sblite.log';

// return the content of wget output
export function wget(url, ua, no_certificate) {
    let addition_parameters = '';

    if (ua) {
        addition_parameters += ('--user-agent="' + ua + '" ');
    }

    if (no_certificate) {
        addition_parameters += ('--no-check-certificate ');
    }

    return popen('wget -q ' + addition_parameters + '-t 3 -T 10 -O- ' + url);
};

// return the md5 value of str
export function md5(str) {
    for (let i = 0; i < 3; i++) {
        const handle = popen('echo -n "' + str + '" | md5sum');
        if (handle) {
            let content = handle.read(' ');
            handle.close();
            content = trim(content);

            if(content != null) {
                return content;
            }
        }
    }
};

export function parse_port(port) {
    port = int(port);

    if (port <= 0 || port >= 65535) {
        port = 'NaN';
    }

    return port;
};

export function get_loopback(ipv6) {
    let loopback = '127.0.0.1';
    if (ipv6) {
        loopback = '::1';
    }

    return loopback;
};

function log(fmt, ...args) {
    const fp = fopen(LOG_FILE, 'a');

    if (fp) {
        fp.write(sprintf(fmt, ...args));
        fp.write('\n');
        fp.close();
    }
};

export function log_t(fmt, ...args) {
    let s = sprintf(fmt, ...args);
    const now = localtime(time());

    log('[%04d-%02d-%02d %02d:%02d:%02d] %s', now.year, now.mon, now.mday, now.hour, now.min, now.sec, s);
};

export function log_tab(fmt, ...args) {
    log('    %s', sprintf(fmt, ...args));
};

export function clearlog() {
    system('echo "" > ' + LOG_FILE);
};
