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
import { Route } from './route.uc';
import { mkdir } from 'fs';

function start() {
    mkdir('/tmp/sblite');
    mkdir('/tmp/sblite/rule_sets');

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
        log_t('starting...');
        start_crontab();
        const outbounds = Outbound(uci);
        const rule_sets = RuleSet(uci, outbounds);
        print(values(rule_sets) + '\n');

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
        config.route = Route(uci, rule_sets, outbounds);


        print(config + '\n');
        config.write();

        log_t('Done.');
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
