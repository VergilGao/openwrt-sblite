'use strict';

import { cursor } from 'uci';
import { CONF_NAME } from './const.uc';
import { log_t } from './utils.uc';
import { start as start_crontab, stop as stop_crontab } from './cron.uc';
import { subscribe } from './subscribe.uc';

function start() {
    system('mkdir -p /tmp/sblite');

    const uci = cursor();

    // purne node config
    uci.foreach(CONF_NAME, 'node', section => {
        const group = section.group;
        if (group == null || group == '') {
            uci.set(CONF_NAME, section['.name'], 'hashkey', null);
        }
    });

    uci.commit();

    const enable = uci.get(CONF_NAME, 'main', 'enable') == '1';

    if (enable) {
        start_crontab();
    } else {
        stop_crontab();
    }
}

switch (action) {
    case 'start':
        start();
        break;

    case 'subscribe':
        subscribe(params);
        break;
}
