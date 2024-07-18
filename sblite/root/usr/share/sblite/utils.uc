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

            if (content != null) {
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

export function delete_empty_arr(obj, arr_name) {
    if (length(obj[arr_name]) == 0) {
        delete obj[arr_name];
    }
};

/**
 * 将字符串转化为 ip
 * @returns {Object} ip
 * @returns {number} ip.version
 * @returns {string} ip.address
 * @returns {number} ip.cidr
 */
export function asip(str) {
    const result = match(str, /^([0-9a-fA-F:.]+)(\/([0-9]+))?$/);
    if (result) {
        const ip = iptoarr(result[1]);

        if (ip) {
            let cidr = (result[3] == null ? null : int(result[3]));

            if (length(ip) == 4) {
                cidr ??= 32;

                if (cidr <= 32) {
                    return { version: 4, address: arrtoip(ip), cidr: cidr };
                }
            } else if (length(ip) == 16) {
                cidr ??= 128;

                if (cidr <= 128) {
                    return { version: 6, address: arrtoip(ip), cidr: cidr };
                }
            }
        }
    }

    return null;
};

export function asport(str) {
    const result = match(str, /^([0-9]+)(-([0-9]+))?$/);
    if (result) {
        const port0 = int(result[1]);

        if (port0 >= 0 && port0 <= 65535) {
            const port1 = result[3] == null ? null : int(result[3]);

            if (port1) {
                if (port1 > port0 && port1 <= 65535) {
                    return { range: true, start: port0, end: port1 };
                }

            } else {
                return { range: false, value: port0 };
            }
        }
    }

    return null;
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
