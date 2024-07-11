'use strict';

import { cursor } from 'uci';
import { PKG_NAME, CONF_NAME as config_name } from './const.uc';
import { wget, log_t, log_tab } from './utils.uc';
import { parse as vmess_parse } from './subscribe/vmess.uc';

export function subscribe() {
    log_t('subscribe starting...');
    const uci = cursor();
    let results = {};

    uci.foreach(config_name, 'subscription',
        function (section) {
            const group = section['.name'];
            const url = section.subscribe_url;
            const no_certificate = section.no_certificate;
            const ua = section.ua;

            log_t('[%s] start...', group);

            const handle = wget(url, no_certificate, ua);

            if (handle) {
                let content = handle.read('all');

                const decode = b64dec(content);

                if (decode != null) {
                    content = decode;
                }

                if (content) {
                    const lines = split(content, /[\r\n]/g);

                    for (let i = 0; i < length(lines); i++) {
                        const line = trim(lines[i]);

                        if (line != '') {
                            let result = {
                                group: group
                            };

                            if (vmess_parse(line, result)) {

                            } else {
                                continue;
                            }

                            log_tab('Get %s', result.alias);
                            results[result.hashkey] = result;
                        }
                    }
                }

                log_t('[%s] done.', group);
                handle.close();
            }
            else {
                log_t('[%s] error.', group);
            }
        }
    );

    log_t('All done.');

    uci.foreach(config_name, 'node', section => {
        const group = section.group;
        if (group != null && group != '') {
            uci.delete(config_name, section['.name']);
        }
    });

    const hashkeys = keys(results);

    for (let i = 0; i < length(hashkeys); i++) {
        const hashkey = hashkeys[i];
        const result = results[hashkey];

        const sid = uci.add(config_name, 'node');

        const result_keys = keys(result);

        for (let j = 0; j < length(result_keys); j++) {
            uci.set(config_name, sid, result_keys[j], result[result_keys[j]]);
        }
    }

    if (uci.commit(config_name)) {
        return results;
    }
    else {
        die('commit failed!');
    }
};
