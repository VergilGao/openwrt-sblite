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
import { DNS } from './dns.uc';

function start() {
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
        log_t('starting...');
        start_crontab();
        const outbounds = Outbound(uci);
        const rule_sets = RuleSet(uci, outbounds);
        const config = SingBoxOption();
        if (uci.get(CONF_NAME, 'main', 'loglevel') != '0') {
            let level;
            switch (uci.get(CONF_NAME, 'main', 'log')) {
                case 'trace': level = LOGLEVEL.TRACE; break;
                case 'debug': level = LOGLEVEL.DEBUG; break;
                case 'info': level = LOGLEVEL.INFO; break;
                case 'warn': level = LOGLEVEL.WARN; break;
                case 'error': level = LOGLEVEL.ERROR; break;
                case 'fatal': level = LOGLEVEL.FATAL; break;
                case 'panic': level = LOGLEVEL.PANIC; break;
                default: level = LOGLEVEL.ERROR; break;
            }
            config.logOption(true, level);
        } else {
            config.logOption(false);
        }
        config.logOption(true, LOGLEVEL.ERROR);
        config.cacheFileOption(true);
        // 出站
        config.outbounds = values(outbounds);
        const inbounds = {
            redirect_tcp: {
                type: 'redirect',
                tag: 'redirect_tcp',
                listen: '::',
                listen_port: 18008,
                sniff: true,
                sniff_override_destination: true,
            },
            tproxy_udp: {
                type: 'tproxy',
                tag: 'tproxy_udp',
                network: 'udp',
                listen: '::',
                listen_port: 18008,
                sniff: true,
                sniff_override_destination: true,
            },
        };
        config.dns = DNS(uci, rule_sets, inbounds, outbounds);
        // 然后是重头戏，路由
        config.route = Route(uci, rule_sets, outbounds);
        config.inbounds = values(inbounds);
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
    case 'stop':
        const uci = cursor();
        uci.set(CONF_NAME, 'main', 'enable', '0'); 
        uci.commit();
        start();
        break;
    case 'subscribe':
        subscribe(params);
        break;
}
