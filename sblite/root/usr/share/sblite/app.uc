'use strict';

import { cursor } from 'uci';
import { CONF_NAME } from './const.uc';
import { log_t, log_tab } from './utils.uc';
import { start as start_crontab, stop as stop_crontab } from './cron.uc';
import { subscribe } from './subscribe.uc';
import { SingBoxOption } from './singbox.uc';
import * as LOGLEVEL from './loglevel.uc';
import { Outbound } from './outbound.uc';
import { RuleSet } from './rule.uc';

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

    //const enable = uci.get(CONF_NAME, 'main', 'enable') == '1';
    const enable = true;

    if (enable) {
        start_crontab();
        const outbounds = Outbound(uci);
        const rule_sets = RuleSet(uci, outbounds);

        const config = SingBoxOption();
        config.logOption(true, LOGLEVEL.ERROR);
        config.cacheFileOption(true);
        config.clashOption({
            host: '127.0.0.11',
            port: 9090,
            ui: '',
            download_url: 'https://github.com/MetaCubeX/Yacd-meta/archive/gh-pages.zip',
            download_detour: 'direct',
            secret: '',
            default_mode: 'Rule',
        });

        for (let outbound in values(outbounds)) {
            push(config.outbounds, outbound);
        }

        // 然后是重头戏，路由


        print(config + '\n');
        config.write();
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
